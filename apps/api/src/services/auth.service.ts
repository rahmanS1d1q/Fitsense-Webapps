import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../db/client";
import { config } from "../config";
import { getRedis } from "../db/redis";

export interface JwtPayload {
  userId: string;
  companyId: string | null;
  role: "super_admin" | "club_owner" | "trainer" | "member";
  exp: number;
}

export interface MqttTokenPayload {
  userId: string;
  companyId: string;
  role: string;
  allowedTopics: string[];
  exp: number;
}

export interface LoginResult {
  jwt: string;
  mqttToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    companyId: string | null;
  };
}

export interface RefreshResult {
  jwt: string;
  mqttToken: string;
}

// Parse duration string like "7d", "30m" into seconds
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return value * multipliers[unit];
}

function getMqttAllowedTopics(
  role: string,
  companyId: string | null,
  userId: string,
): string[] {
  switch (role) {
    case "member":
      return [
        `fitsense/${companyId}/${userId}/hr`,
        `fitsense/${companyId}/${userId}/alerts`,
      ];
    case "trainer":
    case "club_owner":
      return [`fitsense/${companyId}/#`];
    case "super_admin":
      return ["fitsense/#"];
    default:
      return [];
  }
}

export function generateJwt(
  userId: string,
  companyId: string | null,
  role: string,
): string {
  const expiresInSeconds = parseDurationToSeconds(config.jwt.expiresIn);
  const payload = { userId, companyId, role };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: expiresInSeconds });
}

export function generateMqttToken(
  userId: string,
  companyId: string | null,
  role: string,
): string {
  const expiresInSeconds = parseDurationToSeconds(config.mqtt.tokenExpiresIn);
  const allowedTopics = getMqttAllowedTopics(role, companyId, userId);
  const payload = { userId, companyId: companyId ?? "", role, allowedTopics };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: expiresInSeconds });
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const pool = getPool();

  // Step 1: fetch user — no JOIN to avoid issues with schema changes
  const userResult = await pool.query(
    "SELECT id, first_name, last_name, email, password_hash, role as users_role, status FROM users WHERE email = $1",
    [email],
  );

  if (userResult.rows.length === 0) {
    throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
  }

  const user = userResult.rows[0];

  if (user.status !== "active") {
    throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
  }

  // Step 2: determine role and companyId
  let effectiveRole: string;
  let companyId: string | null = null;

  if (user.users_role === "super_admin") {
    effectiveRole = "super_admin";
  } else {
    const ucResult = await pool.query(
      "SELECT role, company_id FROM users_companies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [user.id],
    );
    if (ucResult.rows.length === 0) {
      throw Object.assign(new Error("User has no role assigned"), {
        statusCode: 401,
      });
    }
    effectiveRole = ucResult.rows[0].role;
    companyId = ucResult.rows[0].company_id;
  }

  const jwtToken = generateJwt(user.id, companyId, effectiveRole);
  const mqttToken = generateMqttToken(user.id, companyId, effectiveRole);
  const refreshToken = uuidv4();

  const redis = getRedis();
  const jwtExpiresInSeconds = parseDurationToSeconds(config.jwt.expiresIn);
  await redis.set(
    `refresh_token:${user.id}`,
    refreshToken,
    "EX",
    jwtExpiresInSeconds,
  );

  return {
    jwt: jwtToken,
    mqttToken,
    refreshToken,
    user: {
      id: user.id,
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      email: user.email,
      role: effectiveRole,
      companyId,
    },
  };
}

export async function refresh(
  userId: string,
  refreshToken: string,
): Promise<RefreshResult> {
  const redis = getRedis();
  const stored = await redis.get(`refresh_token:${userId}`);

  if (!stored || stored !== refreshToken) {
    throw Object.assign(new Error("Invalid refresh token"), {
      statusCode: 401,
    });
  }

  const pool = getPool();
  const result = await pool.query(
    "SELECT id, role as users_role, status FROM users WHERE id = $1",
    [userId],
  );

  if (result.rows.length === 0 || result.rows[0].status !== "active") {
    throw Object.assign(new Error("User not found"), { statusCode: 401 });
  }

  const user = result.rows[0];
  let effectiveRole: string;
  let companyId: string | null = null;

  if (user.users_role === "super_admin") {
    effectiveRole = "super_admin";
  } else {
    const ucResult = await pool.query(
      "SELECT role, company_id FROM users_companies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    if (ucResult.rows.length === 0) {
      throw Object.assign(new Error("User has no role assigned"), {
        statusCode: 401,
      });
    }
    effectiveRole = ucResult.rows[0].role;
    companyId = ucResult.rows[0].company_id;
  }

  const jwtToken = generateJwt(userId, companyId, effectiveRole);
  const mqttToken = generateMqttToken(userId, companyId, effectiveRole);

  // Rotate refresh token
  const newRefreshToken = uuidv4();
  const jwtExpiresInSeconds = parseDurationToSeconds(config.jwt.expiresIn);
  await redis.set(
    `refresh_token:${userId}`,
    newRefreshToken,
    "EX",
    jwtExpiresInSeconds,
  );

  return { jwt: jwtToken, mqttToken };
}

/**
 * Logout: invalidates refresh token AND blacklists the access token in Redis.
 * The access token hash (sha256) is stored with TTL = remaining token lifetime.
 * Plaintext JWT is never stored in Redis.
 */
export async function logout(userId: string, accessToken: string): Promise<void> {
  const redis = getRedis();

  // Always revoke the refresh token
  await redis.del(`refresh_token:${userId}`);

  // Blacklist the access token for its remaining lifetime
  try {
    const payload = jwt.decode(accessToken) as { exp?: number } | null;
    if (payload?.exp) {
      const now = Math.floor(Date.now() / 1000);
      const ttl = payload.exp - now;
      if (ttl > 0) {
        // Store sha256 hash — never store the plaintext token
        const tokenHash = crypto
          .createHash("sha256")
          .update(accessToken)
          .digest("hex");
        await redis.set(`jwt_blacklist:${tokenHash}`, "1", "EX", ttl);
      }
    }
  } catch {
    // Non-fatal: if blacklisting fails, the refresh token is already revoked
    // which limits damage to the token's natural expiry
  }
}

export async function issueMqttToken(
  userId: string,
  companyId: string | null,
  role: string,
): Promise<string> {
  return generateMqttToken(userId, companyId, role);
}

export interface RegisterCompanyInput {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  ownerFirstName: string;
  ownerLastName?: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface RegisterCompanyResult {
  company: { id: string; name: string; slug: string; status: string };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

export async function registerCompany(
  input: RegisterCompanyInput,
): Promise<RegisterCompanyResult> {
  if (!SLUG_REGEX.test(input.slug)) {
    throw Object.assign(new Error("Invalid slug format"), {
      statusCode: 400,
      field: "slug",
    });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const slugCheck = await client.query(
      "SELECT id FROM companies WHERE slug = $1",
      [input.slug],
    );
    if (slugCheck.rows.length > 0) {
      throw Object.assign(
        new Error(`Slug '${input.slug}' sudah digunakan oleh company lain.`),
        { statusCode: 409, code: "SLUG_CONFLICT", field: "slug" },
      );
    }

    const companyResult = await client.query(
      "INSERT INTO companies (name, slug, address, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, slug, status",
      [input.name, input.slug, input.address ?? null, input.phone ?? null],
    );
    const company = companyResult.rows[0];

    // Owner: role stored in users_companies, not in users.role
    const passwordHash = await bcrypt.hash(input.ownerPassword, 10);
    const ownerResult = await client.query(
      "INSERT INTO users (first_name, last_name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'club_owner', 'active') RETURNING id, first_name, last_name, email",
      [
        input.ownerFirstName,
        input.ownerLastName || input.ownerFirstName,
        input.ownerEmail,
        passwordHash,
      ],
    );
    const owner = ownerResult.rows[0];

    await client.query(
      "INSERT INTO users_companies (user_id, company_id, role) VALUES ($1, $2, 'club_owner')",
      [owner.id, company.id],
    );

    await client.query("COMMIT");
    return {
      company,
      owner: {
        id: owner.id,
        firstName: owner.first_name,
        lastName: owner.last_name ?? "",
        email: owner.email,
        role: "club_owner",
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Backward compat alias
export { registerCompany as registerClub };
export type { RegisterCompanyInput as RegisterClubInput };
