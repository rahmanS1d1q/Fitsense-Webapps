import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";
import { config } from "../config";
import { validatePassword } from "./invite.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return `${uuidv4()}-${Date.now()}`;
}

async function sendResetEmail(
  toEmail: string,
  rawToken: string,
): Promise<void> {
  if (!config.smtp.host) {
    console.warn("[password-reset] SMTP not configured, skipping email send.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  const domain = process.env.APP_DOMAIN || "localhost:3000";
  const resetUrl = `https://${domain}/reset-password?token=${rawToken}`;

  await transporter.sendMail({
    from: config.smtp.from,
    to: toEmail,
    subject: "Reset Password FitSense",
    text: `Klik tautan berikut untuk mereset password Anda (berlaku 1 jam):\n\n${resetUrl}\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
    html: `<p>Klik tautan berikut untuk mereset password Anda (berlaku 1 jam):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Jika Anda tidak meminta reset password, abaikan email ini.</p>`,
  });
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

const RESET_RATE_LIMIT_MAX = 3;
const RESET_RATE_LIMIT_TTL = 3600; // 1 hour in seconds

async function checkResetRateLimit(email: string): Promise<boolean> {
  const redis = getRedis();
  const key = `rate_limit:reset:${email}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RESET_RATE_LIMIT_TTL);
  }
  return count > RESET_RATE_LIMIT_MAX;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RequestResetResult {
  sent: boolean;
}

/**
 * Request a password reset for the given email.
 * Always returns HTTP 200 to prevent email enumeration.
 * Requirements: 19.1, 19.2, 19.6
 */
export async function requestReset(email: string): Promise<RequestResetResult> {
  const pool = getPool();

  // Rate limit check (per email)
  const rateLimited = await checkResetRateLimit(email);
  if (rateLimited) {
    // Return success-looking result to prevent enumeration
    return { sent: false };
  }

  // Look up user — do NOT reveal whether email exists
  const userResult = await pool.query(
    "SELECT id, email FROM users WHERE email = $1 AND status = 'active'",
    [email],
  );

  if (userResult.rows.length === 0) {
    // Email not registered — return same response as success
    return { sent: false };
  }

  const user = userResult.rows[0];
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt],
  );

  // Send email asynchronously — don't await to keep response fast
  sendResetEmail(user.email, rawToken).catch((err) => {
    console.error("[password-reset] Failed to send reset email:", err.message);
  });

  return { sent: true };
}

/**
 * Reset password using a raw token.
 * Requirements: 19.3–19.5
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  // Validate new password
  if (!validatePassword(newPassword)) {
    throw Object.assign(
      new Error(
        "Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.",
      ),
      { statusCode: 400, code: "WEAK_PASSWORD" },
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenHash = hashToken(rawToken);

    // Look up token
    const tokenResult = await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      throw Object.assign(
        new Error("Token tidak valid atau sudah kedaluwarsa."),
        {
          statusCode: 410,
          code: "TOKEN_INVALID",
        },
      );
    }

    const token = tokenResult.rows[0];

    // Check if already used
    if (token.used_at !== null) {
      throw Object.assign(
        new Error("Token tidak valid atau sudah kedaluwarsa."),
        {
          statusCode: 410,
          code: "TOKEN_USED",
        },
      );
    }

    // Check expiry
    if (new Date(token.expires_at) < new Date()) {
      throw Object.assign(
        new Error("Token tidak valid atau sudah kedaluwarsa."),
        {
          statusCode: 410,
          code: "TOKEN_EXPIRED",
        },
      );
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      token.user_id,
    ]);

    // Mark token as used
    await client.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
      [token.id],
    );

    // Invalidate all active sessions (delete refresh token from Redis)
    const redis = getRedis();
    await redis.del(`refresh_token:${token.user_id}`);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
