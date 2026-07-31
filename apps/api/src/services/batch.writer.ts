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

/**
 * Strict global limit on the number of Redis items processed across ALL queues in one flush cycle.
 * Prevents memory spikes regardless of the number of active company/user queues.
 */
export const GLOBAL_MAX_BATCH_SIZE = 1000;

let writeApi: WriteApi | null = null;
let consecutiveFailures = 0;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

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
 * Key: hr_buffer:{company_id}:{user_id}
 */
export async function addToBuffer(point: HRDataPoint): Promise<void> {
  const redis = getRedis();
  const key = `hr_buffer:${point.companyId}:${point.userId}`;
  await redis.rpush(key, JSON.stringify(point));
}

/**
 * Atomically claims hr_buffer:* keys into hr_processing:* keys.
 * If hr_processing key already exists (from previous crash/failed write),
 * it is processed first before claiming new buffer data.
 */
async function claimProcessingKeys(): Promise<string[]> {
  const redis = getRedis();
  const processingKeys = new Set<string>();

  // 1. Scan for any existing hr_processing:* keys (un-flushed from crash/retry)
  const existingProcessingKeys = await redis.keys("hr_processing:*");
  for (const k of existingProcessingKeys) {
    processingKeys.add(k);
  }

  // 2. Scan for active hr_buffer:* keys and claim them
  const bufferKeys = await redis.keys("hr_buffer:*");
  for (const bufferKey of bufferKeys) {
    const processingKey = bufferKey.replace("hr_buffer:", "hr_processing:");

    // If processing key already exists, skip claiming new buffer until processing key is flushed
    if (processingKeys.has(processingKey)) continue;

    // Atomically rename hr_buffer -> hr_processing if hr_processing does not exist
    const renamed = await redis.renamenx(bufferKey, processingKey);
    if (renamed === 1) {
      processingKeys.add(processingKey);
    }
  }

  return Array.from(processingKeys);
}

/**
 * Validates that an un-parsed or parsed object satisfies the HRDataPoint contract
 * required to safely construct an InfluxDB Point.
 */
export function isValidHRDataPoint(raw: unknown): raw is HRDataPoint {
  if (typeof raw !== "object" || raw === null) return false;

  const obj = raw as Record<string, unknown>;

  // Required numeric fields (must be finite integers within domain bounds)
  if (
    typeof obj.hr !== "number" ||
    !Number.isFinite(obj.hr) ||
    !Number.isInteger(obj.hr) ||
    obj.hr < 20 ||
    obj.hr > 300
  ) {
    return false;
  }

  if (
    typeof obj.timestamp !== "number" ||
    !Number.isFinite(obj.timestamp) ||
    obj.timestamp <= 0
  ) {
    return false;
  }

  // Required string identifiers
  if (typeof obj.sessionId !== "string" || obj.sessionId.trim().length === 0) {
    return false;
  }

  if (typeof obj.companyId !== "string" || obj.companyId.trim().length === 0) {
    return false;
  }

  if (typeof obj.userId !== "string" || obj.userId.trim().length === 0) {
    return false;
  }

  if (typeof obj.hrZone !== "string" || obj.hrZone.trim().length === 0) {
    return false;
  }

  // Optional rr validation (must be undefined if absent, or a finite number within 200-2000 ms if present; null is invalid)
  if (obj.rr !== undefined) {
    if (
      typeof obj.rr !== "number" ||
      !Number.isFinite(obj.rr) ||
      obj.rr < 200 ||
      obj.rr > 2000
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Flushes all buffered HR data points to InfluxDB using at-least-once semantics.
 * On failure, data stays in hr_processing:* Redis keys for retry.
 */
export async function flush(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const redis = getRedis();
    const processingKeys = await claimProcessingKeys();
    if (processingKeys.length === 0) return;

    const api = getWriteApi();
    const batchesToWrite: {
      processingKey: string;
      points: HRDataPoint[];
      itemsReadCount: number;
      totalCount: number;
    }[] = [];

    let globalItemCount = 0;

    for (const processingKey of processingKeys) {
      if (globalItemCount >= GLOBAL_MAX_BATCH_SIZE) break;

      const remainingQuota = GLOBAL_MAX_BATCH_SIZE - globalItemCount;
      const items = await redis.lrange(processingKey, 0, remainingQuota - 1);
      if (items.length === 0) {
        await redis.del(processingKey);
        continue;
      }

      globalItemCount += items.length;
      const totalCount = await redis.llen(processingKey);
      const points: HRDataPoint[] = [];
      let malformedCount = 0;

      for (const item of items) {
        try {
          const parsed = JSON.parse(item);
          if (isValidHRDataPoint(parsed)) {
            points.push(parsed);
          } else {
            malformedCount++;
            console.warn(
              "[BatchWriter] Dropping malformed entry (invalid payload structure):",
              item.slice(0, 100),
            );
          }
        } catch {
          malformedCount++;
          console.warn(
            "[BatchWriter] Dropping malformed entry (invalid JSON):",
            item.slice(0, 100),
          );
        }
      }

      batchesToWrite.push({
        processingKey,
        points,
        itemsReadCount: items.length,
        totalCount,
      });

      if (malformedCount > 0) {
        console.warn(
          `[BatchWriter] Key ${processingKey} contained ${malformedCount} malformed entries out of ${items.length} read items.`,
        );
      }
    }

    if (batchesToWrite.length === 0) return;

    // Write all valid points from claimed batches to InfluxDB
    let hasPointsToWrite = false;
    for (const { points } of batchesToWrite) {
      if (points.length > 0) {
        hasPointsToWrite = true;
        for (const p of points) {
          const influxPoint = new Point("hr_data")
            .tag("company_id", p.companyId)
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
    }

    // Flush batch to InfluxDB if there are valid points
    if (hasPointsToWrite) {
      await api.flush();
    }

    // Acknowledge and clear/trim processed items from Redis based on itemsReadCount
    for (const { processingKey, itemsReadCount, totalCount } of batchesToWrite) {
      if (itemsReadCount >= totalCount) {
        await redis.del(processingKey);
      } else {
        // Bounded batch: trim exact number of items read (valid + malformed)
        await redis.ltrim(processingKey, itemsReadCount, -1);
      }
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
        "[BatchWriter] CRITICAL: Flush gagal > 10 siklus berturut-turut. Data HR tersimpan aman di Redis untuk retry.",
      );
    }
  } finally {
    isFlushing = false;
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
  isFlushing = false;
}



