/**
 * BatchWriter — Akumulasi data HR di Redis buffer dan flush ke InfluxDB setiap 1 detik.
 * Requirements: 7.2, 7.3, 7.4, 16.4
 */

import { InfluxDB, Point, WriteApi } from "@influxdata/influxdb-client";
import { config } from "../config";
import { getRedis } from "../db/redis";
import { HRDataPoint } from "./mqtt.consumer";

const FLUSH_INTERVAL_MS = 1000;
const MAX_CONSECUTIVE_FAILURES = 10;

let writeApi: WriteApi | null = null;
let consecutiveFailures = 0;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function getWriteApi(): WriteApi {
  if (!writeApi) {
    const client = new InfluxDB({
      url: config.influx.url,
      token: config.influx.token,
    });
    writeApi = client.getWriteApi(
      config.influx.org,
      config.influx.bucket,
      "ms",
    );
  }
  return writeApi;
}

/**
 * Adds a data point to the Redis buffer.
 * Key: hr_buffer:{club_id}:{user_id}
 */
export async function addToBuffer(point: HRDataPoint): Promise<void> {
  const redis = getRedis();
  const key = `hr_buffer:${point.clubId}:${point.userId}`;
  await redis.rpush(key, JSON.stringify(point));
}

/**
 * Flushes all buffered HR data points to InfluxDB.
 * On failure, data stays in Redis for retry.
 */
async function flush(): Promise<void> {
  const redis = getRedis();

  // Find all buffer keys
  const keys = await redis.keys("hr_buffer:*");
  if (keys.length === 0) return;

  const api = getWriteApi();
  const pointsToWrite: { key: string; points: HRDataPoint[] }[] = [];

  for (const key of keys) {
    const items = await redis.lrange(key, 0, -1);
    if (items.length === 0) continue;

    const points: HRDataPoint[] = [];
    for (const item of items) {
      try {
        points.push(JSON.parse(item) as HRDataPoint);
      } catch {
        console.warn(
          "[BatchWriter] Failed to parse buffered item:",
          item.slice(0, 100),
        );
      }
    }
    if (points.length > 0) {
      pointsToWrite.push({ key, points });
    }
  }

  if (pointsToWrite.length === 0) return;

  try {
    for (const { points } of pointsToWrite) {
      for (const p of points) {
        const influxPoint = new Point("hr_data")
          .tag("club_id", p.clubId)
          .tag("user_id", p.userId)
          .tag("session_id", p.sessionId)
          .intField("hr", p.hr)
          .stringField("hr_zone", p.hrZone)
          .timestamp(p.timestamp);

        if (p.rr !== undefined) {
          influxPoint.floatField("rr", p.rr);
        }

        api.writePoint(influxPoint);
      }
    }

    await api.flush();

    // Clear flushed buffers
    for (const { key } of pointsToWrite) {
      await redis.del(key);
    }

    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures++;
    console.error(
      `[BatchWriter] Flush ke InfluxDB gagal (attempt ${consecutiveFailures}):`,
      (err as Error).message,
    );

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(
        "[BatchWriter] CRITICAL: Flush gagal > 10 siklus berturut-turut. Data HR mungkin hilang!",
      );
      // In production this would trigger an external alert
    }
    // Data stays in Redis — will retry on next cycle
  }
}

/**
 * Starts the BatchWriter flush interval.
 */
export function startBatchWriter(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flush().catch((err) => {
      console.error(
        "[BatchWriter] Unexpected flush error:",
        (err as Error).message,
      );
    });
  }, FLUSH_INTERVAL_MS);
  console.log("[BatchWriter] Started — flushing every 1 second");
}

/**
 * Stops the BatchWriter (for testing/cleanup).
 */
export function stopBatchWriter(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
