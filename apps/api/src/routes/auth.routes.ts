import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import * as AuthService from "../services/auth.service";
import * as InviteService from "../services/invite.service";
import * as PasswordResetService from "../services/password-reset.service";
import { getRedis } from "../db/redis";

const router = Router();

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL = 900; // 15 minutes in seconds

async function checkLoginRateLimit(ip: string): Promise<boolean> {
  const redis = getRedis();
  const key = `rate_limit:login:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_TTL);
  }
  return count > RATE_LIMIT_MAX;
}

async function recordFailedLogin(ip: string): Promise<void> {
  console.warn(
    "[auth] Failed login attempt from IP:",
    ip,
    "at",
    new Date().toISOString(),
  );
}

/**
 * POST /api/auth/login
 * Requirements: 2.1, 2.2, 2.9, 2.10
 */
router.post("/login", async (req: Request, res: Response) => {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  // Check rate limit before attempting login
  const redis = getRedis();
  const rateLimitKey = `rate_limit:login:${ip}`;
  const currentCount = parseInt((await redis.get(rateLimitKey)) ?? "0", 10);

  if (currentCount >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many failed login attempts. Try again in 15 minutes.",
      },
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Email and password are required",
      },
    });
  }

  try {
    const result = await AuthService.login(email, password);
    // Reset rate limit on successful login
    await redis.del(rateLimitKey);
    return res.json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    if (error.statusCode === 401) {
      // Increment counter and log failed attempt
      await checkLoginRateLimit(ip);
      await recordFailedLogin(ip);
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }
    console.error("[auth] Login error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * POST /api/auth/refresh
 * Requirements: 2.3
 */
router.post("/refresh", async (req: Request, res: Response) => {
  const { userId, refreshToken } = req.body;

  if (!userId || !refreshToken) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "userId and refreshToken are required",
      },
    });
  }

  try {
    const result = await AuthService.refresh(userId, refreshToken);
    return res.json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid or expired refresh token",
        },
      });
    }
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * POST /api/auth/logout
 * Requirements: 2.4
 */
router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await AuthService.logout(userId);
  return res.json({ message: "Logged out successfully" });
});

/**
 * POST /api/auth/mqtt-token
 * Requirements: 2.8
 */
router.post(
  "/mqtt-token",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { userId, companyId, role } = req.user!;
    const mqttToken = await AuthService.issueMqttToken(userId, companyId, role);
    return res.json({ mqttToken });
  },
);

/**
 * POST /api/auth/register-company
 * Requirements: 1.1, 1.2, 1.3
 */
router.post("/register-company", async (req: Request, res: Response) => {
  const {
    name,
    slug,
    address,
    phone,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    ownerPassword,
  } = req.body;

  if (!name || !slug || !ownerFirstName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "name, slug, ownerFirstName, ownerEmail, ownerPassword are required",
      },
    });
  }

  try {
    const result = await AuthService.registerCompany({
      name,
      slug,
      address,
      phone,
      ownerFirstName,
      ownerLastName: ownerLastName ?? "",
      ownerEmail,
      ownerPassword,
    });
    return res.status(201).json(result);
  } catch (err: unknown) {
    const error = err as {
      statusCode?: number;
      code?: string;
      message?: string;
      field?: string;
    };
    if (error.statusCode === 409)
      return res.status(409).json({
        error: {
          code: error.code ?? "CONFLICT",
          message: error.message,
          field: error.field,
        },
      });
    if (error.statusCode === 400)
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          field: error.field,
        },
      });
    console.error("[auth] register-company error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * POST /api/auth/register-club — backward compat alias
 */
router.post("/register-club", async (req: Request, res: Response) => {
  const { name, slug, address, phone, ownerName, ownerEmail, ownerPassword } =
    req.body;
  const parts = (ownerName ?? "").split(" ");
  const ownerFirstName = parts[0] ?? "";
  const ownerLastName = parts.slice(1).join(" ");

  if (!name || !slug || !ownerFirstName || !ownerEmail || !ownerPassword) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "name, slug, ownerName, ownerEmail, ownerPassword are required",
      },
    });
  }

  try {
    const result = await AuthService.registerCompany({
      name,
      slug,
      address,
      phone,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      ownerPassword,
    });
    return res.status(201).json(result);
  } catch (err: unknown) {
    const error = err as {
      statusCode?: number;
      code?: string;
      message?: string;
      field?: string;
    };
    if (error.statusCode === 409)
      return res.status(409).json({
        error: {
          code: error.code ?? "CONFLICT",
          message: error.message,
          field: error.field,
        },
      });
    if (error.statusCode === 400)
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          field: error.field,
        },
      });
    console.error("[auth] register-club error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * POST /api/auth/register-member
 * Self-registration via invite code.
 * Requirements: 18.2–18.7
 */
router.post("/register-member", async (req: Request, res: Response) => {
  const { code, firstName, lastName, name, email, password, date_of_birth } = req.body;

  // Support both firstName and legacy name field
  const resolvedFirstName =
    firstName ?? (name ? name.split(" ")[0] : undefined);
  const resolvedLastName =
    lastName ?? (name ? name.split(" ").slice(1).join(" ") : undefined);

  if (!code || !resolvedFirstName || !email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "code, firstName, email, and password are required",
      },
    });
  }

  try {
    const result = await InviteService.validateAndUseInvite({
      code,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email,
      password,
      date_of_birth,
    });
    return res.status(201).json(result);
  } catch (err: unknown) {
    const error = err as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (error.statusCode === 410)
      return res.status(410).json({
        error: {
          code: error.code ?? "INVITE_INVALID",
          message: error.message,
        },
      });
    if (error.statusCode === 409)
      return res
        .status(409)
        .json({ error: { code: "EMAIL_CONFLICT", message: error.message } });
    if (error.statusCode === 400)
      return res.status(400).json({
        error: {
          code: error.code ?? "VALIDATION_ERROR",
          message: error.message,
        },
      });
    console.error("[auth] register-member error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email. Always returns HTTP 200 (anti-enumeration).
 * Requirements: 19.1, 19.2, 19.6
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "email is required" },
    });
  }

  try {
    const result = await PasswordResetService.requestReset(email);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    console.error("[auth] forgot-password error:", error.message);
    // Always return 200 to prevent enumeration
    return res.status(200).json({ sent: false });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token.
 * Requirements: 19.3–19.5
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "token and newPassword are required",
      },
    });
  }

  try {
    await PasswordResetService.resetPassword(token, newPassword);
    return res.status(200).json({ message: "Password berhasil diperbarui." });
  } catch (err: unknown) {
    const error = err as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (error.statusCode === 410) {
      return res.status(410).json({
        error: { code: error.code ?? "TOKEN_INVALID", message: error.message },
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: {
          code: error.code ?? "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }
    console.error("[auth] reset-password error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * PATCH /api/auth/change-password
 * Change password for the authenticated user.
 */
router.patch(
  "/change-password",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "currentPassword dan newPassword wajib diisi",
        },
      });
    }

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      return res.status(400).json({
        error: {
          code: "WEAK_PASSWORD",
          message:
            "Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka",
        },
      });
    }

    try {
      const { getPool } = await import("../db/client");
      const bcrypt = await import("bcryptjs");
      const pool = getPool();

      const userResult = await pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId],
      );
      if (userResult.rows.length === 0) {
        return res
          .status(404)
          .json({
            error: { code: "NOT_FOUND", message: "User tidak ditemukan" },
          });
      }

      const valid = await bcrypt.compare(
        currentPassword,
        userResult.rows[0].password_hash,
      );
      if (!valid) {
        return res
          .status(401)
          .json({
            error: { code: "INVALID_PASSWORD", message: "Password lama salah" },
          });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [newHash, userId],
      );

      return res.json({ message: "Password berhasil diubah" });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[auth] change-password error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

export default router;
