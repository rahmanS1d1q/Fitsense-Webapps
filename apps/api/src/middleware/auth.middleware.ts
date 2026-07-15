import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { getRedis } from "../db/redis";

export interface JwtPayload {
  userId: string;
  companyId: string | null; // null untuk super_admin
  role: "super_admin" | "club_owner" | "trainer" | "member";
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Validates JWT on every request to protected endpoints.
 * Fix 5: After verifying JWT signature, checks Redis blacklist (sha256 of token).
 * If the token was revoked via logout, the request is rejected with HTTP 401.
 * Backward-compatible — no jti required, works with all existing tokens.
 * Requirements: 2.5
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Token is invalid or expired" },
    });
    return;
  }

  // Fix 5: Check Redis blacklist to detect revoked tokens (e.g. after logout).
  // Key is sha256 hash of the raw token — plaintext JWT never stored in Redis.
  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const redis = getRedis();
    const isBlacklisted = await redis.get(`jwt_blacklist:${tokenHash}`);
    if (isBlacklisted) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Token has been revoked" },
      });
      return;
    }
  } catch {
    // Non-fatal: if Redis is unreachable, allow the request through
    // (fail-open) to avoid blocking all authenticated traffic during outage.
    // The token signature is still valid via jwt.verify above.
  }

  req.user = payload;
  next();
}
