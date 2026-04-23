import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../db/client";
import { config } from "../config";
import { getRedis } from "../db/redis";

export interface JwtPayload {
  userId: string;
  clubId: string | null;
  role: "super_admin" | "club_owner" | "trainer" | "member";
  exp: number;
}

export interface MqttTokenPayload {
  userId: string;
  clubId: string;
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
    name: string;
    email: string;
    role: string;
    clubId: string | null;
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
  clubId: string | null,
  userId: string,
): string[] {
  switch (role) {
    case "member":
      return [
        `fitsense/${clubId}/${userId}/hr`,
        `fitsense/${clubId}/${userId}/alerts`,
      ];
    case "trainer":
    case "club_owner":
      return [`fitsense/${clubId}/#`];
    case "super_admin":
      return ["fitsense/#"];
    default:
      return [];
  }
}

export function generateJwt(
  userId: string,
  clubId: string | null,
  role: string,
): string {
  const expiresInSeconds = parseDurationToSeconds(config.jwt.expiresIn);
  const payload: Omit<JwtPayload, "exp"> & { iat?: number } = {
    userId,
    clubId,
    role: role as JwtPayload["role"],
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: expiresInSeconds });
}

export function generateMqttToken(
  userId: string,
  clubId: string | null,
  role: string,
): string {
  const expiresInSeconds = parseDurationToSeconds(config.mqtt.tokenExpiresIn);
  const allowedTopics = getMqttAllowedTopics(role, clubId, userId);
  const payload: Omit<MqttTokenPayload, "exp"> = {
    userId,
    clubId: clubId ?? "",
    role,
    allowedTopics,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: expiresInSeconds });
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, name, email, password_hash, role, club_id FROM users WHERE email = $1 AND status = $2",
    [email, "active"],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
  }

  const user = result.rows[0];
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
  }

  const jwtToken = generateJwt(user.id, user.club_id, user.role);
  const mqttToken = generateMqttToken(user.id, user.club_id, user.role);
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
      name: user.name,
      email: user.email,
      role: user.role,
      clubId: user.club_id,
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
    "SELECT id, club_id, role FROM users WHERE id = $1 AND status = $2",
    [userId, "active"],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("User not found"), { statusCode: 401 });
  }

  const user = result.rows[0];
  const jwtToken = generateJwt(user.id, user.club_id, user.role);
  const mqttToken = generateMqttToken(user.id, user.club_id, user.role);

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

export async function logout(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`refresh_token:${userId}`);
}

export async function issueMqttToken(
  userId: string,
  clubId: string | null,
  role: string,
): Promise<string> {
  return generateMqttToken(userId, clubId, role);
}

export interface RegisterClubInput {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface RegisterClubResult {
  club: { id: string; name: string; slug: string; status: string };
  owner: { id: string; name: string; email: string; role: string };
}

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

export async function registerClub(
  input: RegisterClubInput,
): Promise<RegisterClubResult> {
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

    // Check slug uniqueness
    const slugCheck = await client.query(
      "SELECT id FROM clubs WHERE slug = $1",
      [input.slug],
    );
    if (slugCheck.rows.length > 0) {
      throw Object.assign(
        new Error(`Slug '${input.slug}' sudah digunakan oleh club lain.`),
        {
          statusCode: 409,
          code: "SLUG_CONFLICT",
          field: "slug",
        },
      );
    }

    // Create club
    const clubResult = await client.query(
      "INSERT INTO clubs (name, slug, address, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, slug, status",
      [input.name, input.slug, input.address ?? null, input.phone ?? null],
    );
    const club = clubResult.rows[0];

    // Hash password and create club_owner
    const passwordHash = await bcrypt.hash(input.ownerPassword, 10);
    const ownerResult = await client.query(
      "INSERT INTO users (club_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role",
      [club.id, input.ownerName, input.ownerEmail, passwordHash, "club_owner"],
    );
    const owner = ownerResult.rows[0];

    await client.query("COMMIT");
    return { club, owner };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
