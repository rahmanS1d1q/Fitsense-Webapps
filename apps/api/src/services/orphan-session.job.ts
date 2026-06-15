/**
 * OrphanSessionJob — Cron job setiap 30 menit untuk menutup sesi terbengkalai.
 * Requirements: 10.7, 10.8
 */

import cron from "node-cron";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";
import { config } from "../config";

const ORPHAN_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

async function closeOrphanSessions(): Promise<void> {
  const redis = getRedis();
  const pool = getPool();

  // Find all session_last_hr keys
  const keys = await redis.keys("session_last_hr:*");
  if (keys.length === 0) return;

  const now = Date.now();

  for (const key of keys) {
    const sessionId = key.replace("session_last_hr:", "");
    const lastHrTs = await redis.get(key);
    if (!lastHrTs) continue;

    const lastHrTime = parseInt(lastHrTs, 10);
    if (isNaN(lastHrTime)) continue;

    const elapsed = now - lastHrTime;
    if (elapsed < ORPHAN_TIMEOUT_MS) continue;

    // Session is orphaned — close it
    try {
      const result = await pool.query(
        `UPDATE sessions
         SET ended_at = to_timestamp($1 / 1000.0),
             auto_closed = TRUE
         WHERE id = $2 AND ended_at IS NULL
         RETURNING id, user_id, company_id, started_at,
                   EXTRACT(EPOCH FROM (to_timestamp($1 / 1000.0) - started_at)) / 60 AS duration_minutes`,
        [lastHrTime, sessionId],
      );

      if (result.rows.length === 0) {
        // Session already closed or not found
        await redis.del(key);
        continue;
      }

      const session = result.rows[0];
      const durationMinutes = parseFloat(session.duration_minutes ?? "0");

      console.log(
        `[OrphanSessionJob] Auto-closed session ${sessionId} (duration: ${durationMinutes.toFixed(1)} min)`,
      );

      // Clean up Redis key
      await redis.del(key);

      // Return company device to 'available' if session used one
      try {
        const deviceCheck = await pool.query(
          `SELECT d.id, d.owner_type
           FROM sessions s
           LEFT JOIN devices d ON s.device_id = d.id
           WHERE s.id = $1`,
          [sessionId],
        );
        const dev = deviceCheck.rows[0];
        if (dev?.id && dev.owner_type === "company") {
          await pool.query(
            "UPDATE devices SET status = 'available', updated_at = NOW() WHERE id = $1",
            [dev.id],
          );
        }
      } catch (devErr) {
        console.warn(
          "[OrphanSessionJob] device return error:",
          (devErr as Error).message,
        );
      }

      // Call ML analyze-session async if duration > 5 minutes
      if (durationMinutes > 5) {
        callMlAnalyzeSession(
          sessionId,
          session.user_id,
          session.company_id,
        ).catch((err) => {
          console.warn(
            "[OrphanSessionJob] ML analyze-session failed:",
            (err as Error).message,
          );
        });
      }
    } catch (err) {
      console.error(
        `[OrphanSessionJob] Failed to close session ${sessionId}:`,
        (err as Error).message,
      );
    }
  }
}

async function callMlAnalyzeSession(
  sessionId: string,
  userId: string,
  companyId: string,
): Promise<void> {
  try {
    await fetch(`${config.ml.serviceUrl}/ml/analyze-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        company_id: companyId,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn(
      "[OrphanSessionJob] ML tidak dapat dijangkau:",
      (err as Error).message,
    );
  }
}

export function startOrphanSessionJob(): void {
  // Run every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    closeOrphanSessions().catch((err) => {
      console.error("[OrphanSessionJob] Error:", (err as Error).message);
    });
  });
  console.log("[OrphanSessionJob] Scheduled — runs every 30 minutes");
}
