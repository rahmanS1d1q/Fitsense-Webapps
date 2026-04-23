/**
 * Admin routes — storage stats dan health check.
 * Requirements: 16.2, 16.3, 20.5
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";
import { InfluxDB } from "@influxdata/influxdb-client";
import { config } from "../config";

const router = Router();

/**
 * GET /api/health
 * Health check — verifies PostgreSQL, InfluxDB, Redis connections.
 * Must respond in < 200ms.
 * Requirements: 16.3
 */
router.get("/health", async (_req: Request, res: Response) => {
  const start = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  // PostgreSQL check
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  // Redis check
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  // InfluxDB check
  try {
    const client = new InfluxDB({
      url: config.influx.url,
      token: config.influx.token,
    });
    const queryApi = client.getQueryApi(config.influx.org);
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows("buckets() |> limit(n: 1)", {
        next() {},
        error: reject,
        complete: resolve,
      });
    });
    checks.influxdb = "ok";
  } catch {
    checks.influxdb = "error";
  }

  const elapsed = Date.now() - start;
  const allOk = Object.values(checks).every((v) => v === "ok");

  return res.status(200).json({
    status: allOk ? "ok" : "degraded",
    checks,
    responseTimeMs: elapsed,
  });
});

/**
 * GET /api/admin/storage/stats
 * Returns InfluxDB storage stats per club (super_admin only).
 * Requirements: 20.5
 */
router.get(
  "/admin/storage/stats",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const pool = getPool();

      // Get all clubs
      const clubsResult = await pool.query(
        "SELECT id, name, slug FROM clubs WHERE status = 'active' ORDER BY name",
      );

      const stats = clubsResult.rows.map((club) => ({
        clubId: club.id,
        clubName: club.name,
        clubSlug: club.slug,
        // In production these would be queried from InfluxDB
        // For now return placeholder values
        dataPoints: null,
        storageMb: null,
        estimatedDaysRemaining: null,
      }));

      return res.json({ stats });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[admin] storage stats error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;
