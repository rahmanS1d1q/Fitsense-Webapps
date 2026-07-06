/**
 * MqttConsumer — Subscribe ke fitsense/# dan distribusikan data HR.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 17.1, 17.2, 17.3, 17.4, 17.5
 */

import mqtt from "mqtt";
import { config } from "../config";
import { getRedis } from "../db/redis";
import { getPool } from "../db/client";
import { classifyZone, HRZone } from "./hr-zone.service";
import { addToBuffer } from "./batch.writer";
import { resolveDeviceByMac } from "./device.service";

export interface RawHRPayload {
  hr: number;
  rr?: number;
  session_id: string;
  timestamp: number;
  mac_address?: string; // optional — sent by mobile app
}

export interface HRDataPoint {
  hr: number;
  rr?: number;
  sessionId: string;
  timestamp: number;
  companyId: string;
  userId: string;
  hrZone: HRZone;
}

const SESSION_LAST_HR_TTL = 7200; // 2 hours
const ZONE_STATE_TTL = 7200; // 2 hours

/**
 * Validates and parses a raw MQTT payload.
 * Returns null if invalid.
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
export function validateHRPayload(raw: unknown): RawHRPayload | null {
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;

  // Required fields
  if (typeof obj.hr !== "number" || !Number.isInteger(obj.hr)) return null;
  if (obj.hr < 20 || obj.hr > 300) return null;
  if (typeof obj.session_id !== "string" || obj.session_id.length === 0)
    return null;
  if (typeof obj.timestamp !== "number") return null;

  // Optional rr
  if (obj.rr !== undefined && obj.rr !== null) {
    if (typeof obj.rr !== "number") return null;
    if (obj.rr < 200 || obj.rr > 2000) return null;
  }

  return {
    hr: obj.hr,
    rr: obj.rr as number | undefined,
    session_id: obj.session_id,
    timestamp: obj.timestamp,
    mac_address:
      typeof obj.mac_address === "string" ? obj.mac_address : undefined,
  };
}

/**
 * Parses companyId and userId from topic: fitsense/{company_id}/{user_id}/hr
 */
function parseTopic(
  topic: string,
): { companyId: string; userId: string } | null {
  const parts = topic.split("/");
  if (parts.length !== 4 || parts[0] !== "fitsense" || parts[3] !== "hr")
    return null;
  return { companyId: parts[1], userId: parts[2] };
}

/**
 * Auto-assign device to session based on MAC address in the HR payload.
 * Called only when mac_address is present in the payload.
 * Fires-and-forgets — never blocks HR data processing.
 */
async function autoAssignDevice(
  macAddress: string,
  userId: string,
  companyId: string,
  sessionId: string,
): Promise<void> {
  try {
    const pool = getPool();

    // Check if session already has a device assigned
    const sessionCheck = await pool.query(
      "SELECT device_id FROM sessions WHERE id = $1",
      [sessionId],
    );
    if (sessionCheck.rows[0]?.device_id) return; // already assigned, skip

    // Resolve device from MAC address
    const device = await resolveDeviceByMac(macAddress, userId, companyId);
    if (!device) return; // device not registered, skip

    // Assign device to session
    await pool.query("UPDATE sessions SET device_id = $1 WHERE id = $2", [
      device.id,
      sessionId,
    ]);

    // If company device, mark as 'borrowed'
    if (device.owner_type === "company") {
      await pool.query(
        "UPDATE devices SET status = 'borrowed', updated_at = NOW() WHERE id = $1",
        [device.id],
      );
    }
  } catch (err) {
    console.warn(
      "[MqttConsumer] autoAssignDevice error:",
      (err as Error).message,
    );
    // Never throw — HR data must still be processed
  }
}

async function callMlAnomalyCheck(point: HRDataPoint): Promise<void> {
  // Skip ML service if not configured
  if (
    !config.ml.serviceUrl ||
    config.ml.serviceUrl === "http://localhost:8000"
  ) {
    console.log("[mqtt] ML service not configured, skipping anomaly check");
    return;
  }

  try {
    const res = await fetch(`${config.ml.serviceUrl}/ml/anomaly-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hr: point.hr,
        rr: point.rr,
        session_id: point.sessionId,
        user_id: point.userId,
        company_id: point.companyId,
        timestamp: point.timestamp,
        hr_zone: point.hrZone,
      }),
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) {
      console.warn(`[MqttConsumer] ML Service returned ${res.status}`);
    }
  } catch (err) {
    console.warn(
      "[MqttConsumer] ML Service tidak dapat dijangkau:",
      (err as Error).message,
    );
    // Do NOT throw — BatchWriter must still process the data
  }
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  // Parse topic
  const parsed = parseTopic(topic);
  if (!parsed) return; // not an HR topic

  // Parse JSON
  let rawObj: unknown;
  try {
    rawObj = JSON.parse(payload.toString());
  } catch {
    console.warn(
      "[MqttConsumer] Payload bukan JSON valid:",
      payload.toString().slice(0, 200),
    );
    return;
  }

  // Validate payload
  const validated = validateHRPayload(rawObj);
  if (!validated) {
    console.warn(
      "[MqttConsumer] Payload tidak valid:",
      JSON.stringify(rawObj).slice(0, 200),
    );
    return;
  }

  const { companyId, userId } = parsed;

  // Classify HR zone (age unknown at this layer — zone will be 'unknown' unless enriched)
  // The BatchWriter enriches with age from DB; here we use 'unknown' as default
  const hrZone: HRZone = "unknown";

  const point: HRDataPoint = {
    hr: validated.hr,
    rr: validated.rr,
    sessionId: validated.session_id,
    timestamp: validated.timestamp,
    companyId,
    userId,
    hrZone,
  };

  const redis = getRedis();

  // Write session_last_hr to Redis (TTL 2h)
  await redis.setex(
    `session_last_hr:${validated.session_id}`,
    SESSION_LAST_HR_TTL,
    String(validated.timestamp),
  );

  // Write zone_state to Redis (TTL 2h)
  const existingZone = await redis.hget(`zone_state:${userId}`, "current_zone");
  if (existingZone !== hrZone) {
    await redis.hset(`zone_state:${userId}`, {
      current_zone: hrZone,
      entered_at: String(validated.timestamp),
    });
    await redis.expire(`zone_state:${userId}`, ZONE_STATE_TTL);
  }

  // Distribute in parallel: BatchWriter + ML Service + autoAssignDevice
  const tasks: Promise<void>[] = [
    addToBuffer(point),
    callMlAnomalyCheck(point),
  ];
  if (validated.mac_address) {
    tasks.push(
      autoAssignDevice(
        validated.mac_address,
        userId,
        companyId,
        validated.session_id,
      ),
    );
  }
  await Promise.all(tasks);
}

export function startMqttConsumer(): void {
  const client = mqtt.connect(config.mqtt.brokerInternal, {
    clientId: `api_consumer_${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log("[MqttConsumer] Connected to MQTT broker");
    client.subscribe("fitsense/#", { qos: 1 }, (err) => {
      if (err) console.error("[MqttConsumer] Subscribe error:", err.message);
      else console.log("[MqttConsumer] Subscribed to fitsense/#");
    });
  });

  client.on("message", (topic, payload) => {
    handleMessage(topic, payload).catch((err) => {
      console.error("[MqttConsumer] handleMessage error:", err.message);
    });
  });

  client.on("error", (err) => {
    console.error("[MqttConsumer] MQTT error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MqttConsumer] Reconnecting to MQTT broker...");
  });
}
