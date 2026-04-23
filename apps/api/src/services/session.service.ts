/**
 * SessionService — Manajemen sesi latihan.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */

import { getPool } from "../db/client";
import { config } from "../config";

export interface Session {
  id: string;
  user_id: string;
  club_id: string;
  started_at: Date;
  ended_at: Date | null;
  avg_hr: number | null;
  max_hr: number | null;
  min_hr: number | null;
  duration_minutes: number | null;
  hr_zone: string | null;
  auto_closed: boolean;
  created_at: Date;
}

/**
 * Starts a new session for a member.
 * Returns HTTP 409 if an active session already exists.
 * Requirements: 10.1, 10.2
 */
export async function startSession(
  userId: string,
  clubId: string,
): Promise<Session> {
  const pool = getPool();

  // Check for existing active session
  const existing = await pool.query(
    "SELECT id FROM sessions WHERE user_id = $1 AND ended_at IS NULL",
    [userId],
  );

  if (existing.rows.length > 0) {
    throw Object.assign(new Error("Sesi aktif sudah ada."), {
      statusCode: 409,
      code: "SESSION_CONFLICT",
      activeSessionId: existing.rows[0].id,
    });
  }

  const result = await pool.query(
    `INSERT INTO sessions (user_id, club_id, started_at)
     VALUES ($1, $2, NOW())
     RETURNING id, user_id, club_id, started_at, ended_at, avg_hr, max_hr, min_hr,
               duration_minutes, hr_zone, auto_closed, created_at`,
    [userId, clubId],
  );

  return result.rows[0] as Session;
}

/**
 * Ends an active session, computing stats from InfluxDB.
 * Calls ML analyze-session async (fire-and-forget).
 * Requirements: 10.3, 10.4
 */
export async function endSession(
  sessionId: string,
  userId: string,
): Promise<Session> {
  const pool = getPool();

  // Verify session exists and belongs to user
  const sessionCheck = await pool.query(
    "SELECT id, club_id, started_at FROM sessions WHERE id = $1 AND user_id = $2 AND ended_at IS NULL",
    [sessionId, userId],
  );

  if (sessionCheck.rows.length === 0) {
    throw Object.assign(
      new Error("Sesi tidak ditemukan atau sudah berakhir."),
      { statusCode: 404 },
    );
  }

  const session = sessionCheck.rows[0];

  // Query HR stats from InfluxDB
  const stats = await querySessionStats(sessionId, session.club_id, userId);

  const result = await pool.query(
    `UPDATE sessions
     SET ended_at = NOW(),
         avg_hr = $1,
         max_hr = $2,
         min_hr = $3,
         duration_minutes = $4,
         hr_zone = $5
     WHERE id = $6
     RETURNING id, user_id, club_id, started_at, ended_at, avg_hr, max_hr, min_hr,
               duration_minutes, hr_zone, auto_closed, created_at`,
    [
      stats.avgHr,
      stats.maxHr,
      stats.minHr,
      stats.durationMinutes,
      stats.dominantZone,
      sessionId,
    ],
  );

  const ended = result.rows[0] as Session;

  // Fire-and-forget ML analyze-session
  callMlAnalyzeSession(sessionId, userId, session.club_id).catch((err) => {
    console.warn(
      "[SessionService] ML analyze-session failed:",
      (err as Error).message,
    );
  });

  return ended;
}

/**
 * Lists historical sessions for a member.
 * Requirements: 10.5
 */
export async function listSessions(
  clubId: string,
  userId: string,
): Promise<Session[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, club_id, started_at, ended_at, avg_hr, max_hr, min_hr,
            duration_minutes, hr_zone, auto_closed, created_at
     FROM sessions
     WHERE user_id = $1 AND club_id = $2
     ORDER BY started_at DESC`,
    [userId, clubId],
  );
  return result.rows as Session[];
}

/**
 * Gets a single session by ID.
 * Requirements: 10.6
 */
export async function getSession(
  clubId: string,
  userId: string,
  sessionId: string,
): Promise<Session> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, club_id, started_at, ended_at, avg_hr, max_hr, min_hr,
            duration_minutes, hr_zone, auto_closed, created_at
     FROM sessions
     WHERE id = $1 AND user_id = $2 AND club_id = $3`,
    [sessionId, userId, clubId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Sesi tidak ditemukan."), {
      statusCode: 404,
    });
  }
  return result.rows[0] as Session;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface SessionStats {
  avgHr: number | null;
  maxHr: number | null;
  minHr: number | null;
  durationMinutes: number | null;
  dominantZone: string | null;
}

async function querySessionStats(
  sessionId: string,
  clubId: string,
  userId: string,
): Promise<SessionStats> {
  try {
    const { InfluxDB } = await import("@influxdata/influxdb-client");
    const client = new InfluxDB({
      url: config.influx.url,
      token: config.influx.token,
    });
    const queryApi = client.getQueryApi(config.influx.org);

    const fluxQuery = `
      from(bucket: "${config.influx.bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["_measurement"] == "hr_data")
        |> filter(fn: (r) => r["club_id"] == "${clubId}")
        |> filter(fn: (r) => r["user_id"] == "${userId}")
        |> filter(fn: (r) => r["session_id"] == "${sessionId}")
        |> filter(fn: (r) => r["_field"] == "hr")
    `;

    const rows: number[] = [];
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          if (typeof obj._value === "number") rows.push(obj._value);
        },
        error: reject,
        complete: resolve,
      });
    });

    if (rows.length === 0) {
      return {
        avgHr: null,
        maxHr: null,
        minHr: null,
        durationMinutes: null,
        dominantZone: null,
      };
    }

    const avgHr = Math.round(rows.reduce((a, b) => a + b, 0) / rows.length);
    const maxHr = Math.max(...rows);
    const minHr = Math.min(...rows);
    const durationMinutes = Math.round(rows.length / 60); // ~1 data point per second

    return { avgHr, maxHr, minHr, durationMinutes, dominantZone: null };
  } catch (err) {
    console.warn(
      "[SessionService] InfluxDB query failed, using null stats:",
      (err as Error).message,
    );
    return {
      avgHr: null,
      maxHr: null,
      minHr: null,
      durationMinutes: null,
      dominantZone: null,
    };
  }
}

async function callMlAnalyzeSession(
  sessionId: string,
  userId: string,
  clubId: string,
): Promise<void> {
  try {
    await fetch(`${config.ml.serviceUrl}/ml/analyze-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        club_id: clubId,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn(
      "[SessionService] ML analyze-session tidak dapat dijangkau:",
      (err as Error).message,
    );
  }
}
