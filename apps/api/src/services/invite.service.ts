import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getPool } from "../db/client";
import { config } from "../config";

// ─── Password Validation ────────────────────────────────────────────────────

export function validatePassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// ─── Invite Code Generation ─────────────────────────────────────────────────

function generateCode(): string {
  return crypto.randomBytes(32).toString("hex"); // 64-char hex string
}

export interface CreateInviteResult {
  code: string;
  registrationUrl: string;
  expiresAt: Date;
}

/**
 * Generate a unique invite code for a club.
 * Requirements: 18.1
 */
export async function generateInvite(
  companyId: string,
  createdBy: string,
): Promise<CreateInviteResult> {
  const pool = getPool();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await pool.query(
    `INSERT INTO invite_codes (company_id, code, created_by, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [companyId, code, createdBy, expiresAt],
  );

  const domain = process.env.APP_DOMAIN || "localhost:3000";
  const registrationUrl = `https://${domain}/register?invite=${code}`;

  return { code, registrationUrl, expiresAt };
}

// ─── Member Registration via Invite ─────────────────────────────────────────

export interface RegisterMemberInput {
  code: string;
  firstName: string;
  lastName?: string;
  name?: string; // backward compat
  email: string;
  password: string;
  date_of_birth?: string;
}

export interface RegisterMemberResult {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    companyId: string;
  };
}

/**
 * Validate invite code and register a new member.
 * Requirements: 18.2–18.7
 */
export async function validateAndUseInvite(
  input: RegisterMemberInput,
): Promise<RegisterMemberResult> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Look up invite code
    const inviteResult = await client.query(
      `SELECT id, company_id, expires_at, used_at
       FROM invite_codes
       WHERE code = $1
       FOR UPDATE`,
      [input.code],
    );

    if (inviteResult.rows.length === 0) {
      // Code not found → 410
      throw Object.assign(
        new Error(
          "Kode undangan tidak valid atau sudah habis masa berlakunya.",
        ),
        {
          statusCode: 410,
          code: "INVITE_INVALID",
        },
      );
    }

    const invite = inviteResult.rows[0];

    // 2. Check if already used (single use)
    if (invite.used_at !== null) {
      throw Object.assign(
        new Error(
          "Kode undangan tidak valid atau sudah habis masa berlakunya.",
        ),
        {
          statusCode: 410,
          code: "INVITE_USED",
        },
      );
    }

    // 3. Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      throw Object.assign(
        new Error(
          "Kode undangan tidak valid atau sudah habis masa berlakunya.",
        ),
        {
          statusCode: 410,
          code: "INVITE_EXPIRED",
        },
      );
    }

    // 4. Check email uniqueness
    const emailCheck = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [input.email],
    );
    if (emailCheck.rows.length > 0) {
      throw Object.assign(new Error("Email sudah terdaftar di platform."), {
        statusCode: 409,
        code: "EMAIL_CONFLICT",
      });
    }

    // 5. Validate password
    if (!validatePassword(input.password)) {
      throw Object.assign(
        new Error(
          "Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.",
        ),
        { statusCode: 400, code: "WEAK_PASSWORD" },
      );
    }

    // 6. Create member — role stored in users table (NOT NULL in schema)
    const passwordHash = await bcrypt.hash(input.password, 10);
    const firstName =
      input.firstName ?? (input.name ? input.name.split(" ")[0] : "");
    const lastName =
      input.lastName ??
      (input.name ? input.name.split(" ").slice(1).join(" ") : "");

    const userResult = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, date_of_birth, role, status)
       VALUES ($1, $2, $3, $4, $5, 'member', 'active')
       RETURNING id, first_name, last_name, email`,
      [
        firstName,
        lastName || firstName,
        input.email,
        passwordHash,
        input.date_of_birth ?? null,
      ],
    );
    const user = userResult.rows[0];

    // Link to company via users_companies
    await client.query(
      "INSERT INTO users_companies (user_id, company_id, role) VALUES ($1, $2, 'member')",
      [user.id, invite.company_id],
    );

    // 7. Mark invite as used
    await client.query(
      `UPDATE invite_codes SET used_by = $1, used_at = NOW() WHERE id = $2`,
      [user.id, invite.id],
    );

    await client.query("COMMIT");

    return {
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name ?? "",
        email: user.email,
        role: "member",
        companyId: invite.company_id,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
