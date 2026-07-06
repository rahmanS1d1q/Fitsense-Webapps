import { getPool } from "../db/client";
import { config } from "../config";
import * as workoutAssignmentService from "./workout-assignment.service";
import { calculateAge } from "./member.service";

export interface Session {
  id: string;
  user_id: string;
  company_id: string;
  workout_id: string | null;
  mood: string | null;
  started_at: Date;
  ended_at: Date | null;
  avg_hr: number | null;
  max_hr: number | null;
  min_hr: number | null;
  duration_minutes: number | null;
  hr_zone: string | null;
  auto_closed: boolean;
  created_at: Date;
  device_id?: string | null;
  age_at_session?: number | null;
  weight_at_session?: number | null;
  height_at_session?: number | null;
}

/**
 * Starts a new session for a member.
 * Returns HTTP 409 if an active session already exists.
 * Requirements: 10.1, 10.2
 */
export async function startSession(
  userId: string,
  companyId: string,
  workoutId?: string,
  mood?: string,
  weight?: number,
  height?: number,
  deviceId?: string,
): Promise<Session> {
  const pool = getPool();

  // Check for existing active session
  const existing = await pool.query(
    "SELECT id FROM sessions WHERE user_id = $1 AND ended_at IS NULL AND deleted_at IS NULL",
    [userId],
  );

  if (existing.rows.length > 0) {
    throw Object.assign(new Error("Sesi aktif sudah ada."), {
      statusCode: 409,
      code: "SESSION_CONFLICT",
      activeSessionId: existing.rows[0].id,
    });
  }

  // Get user biometric data for snapshot and resolve device (skipped in unit tests)
  let age: number | null = null;
  let finalWeight: number | null = weight ?? null;
  let finalHeight: number | null = height ?? null;
  let resolvedDeviceId: string | null = deviceId ?? null;

  if (process.env.NODE_ENV !== "test") {
    const userQuery = await pool.query(
      "SELECT date_of_birth, weight, height FROM users WHERE id = $1",
      [userId]
    );
    const user = userQuery.rows[0];
    if (user) {
      age = user.date_of_birth ? calculateAge(new Date(user.date_of_birth)) : null;
      if (finalWeight === null) finalWeight = user.weight ? Number(user.weight) : null;
      if (finalHeight === null) finalHeight = user.height ? Number(user.height) : null;
    }

    // Resolve device with priority:
    // 1. Specific deviceId if passed
    // 2. Device which is_default = true for this user
    // 3. First individual device for this user
    // 4. First available company device (if any)
    if (!resolvedDeviceId) {
      // 2. Default device
      const defaultDevice = await pool.query(
        "SELECT id FROM devices WHERE user_id = $1 AND owner_type = 'individual' AND is_default = TRUE LIMIT 1",
        [userId]
      );
      if (defaultDevice.rows.length > 0) {
        resolvedDeviceId = defaultDevice.rows[0].id;
      } else {
        // 3. First individual device
        const firstIndiv = await pool.query(
          "SELECT id FROM devices WHERE user_id = $1 AND owner_type = 'individual' ORDER BY registered_at ASC LIMIT 1",
          [userId]
        );
        if (firstIndiv.rows.length > 0) {
          resolvedDeviceId = firstIndiv.rows[0].id;
        } else {
          // 4. Available company device
          const firstCompany = await pool.query(
            "SELECT id FROM devices WHERE company_id = $1 AND owner_type = 'company' AND status = 'available' ORDER BY registered_at ASC LIMIT 1",
            [companyId]
          );
          if (firstCompany.rows.length > 0) {
            resolvedDeviceId = firstCompany.rows[0].id;
          }
        }
      }
    }
  }

  const result = await pool.query(
    `INSERT INTO sessions 
     (user_id, company_id, workout_id, mood, started_at, age_at_session, weight_at_session, height_at_session, device_id)
     VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      companyId,
      workoutId ?? null,
      mood ?? null,
      age,
      finalWeight,
      finalHeight,
      resolvedDeviceId
    ],
  );

  const session = result.rows[0] as Session;

  // If a company device was resolved, mark it as borrowed (skipped in unit tests)
  if (resolvedDeviceId && process.env.NODE_ENV !== "test") {
    const deviceCheck = await pool.query("SELECT owner_type FROM devices WHERE id = $1", [resolvedDeviceId]);
    if (deviceCheck.rows.length > 0 && deviceCheck.rows[0].owner_type === "company") {
      await pool.query(
        "UPDATE devices SET status = 'borrowed', updated_at = NOW() WHERE id = $1",
        [resolvedDeviceId]
      );
    }
  }

  // Cek apakah ada workout assignment pending hari ini untuk member.
  // Jika ada dan session belum punya workout, auto-attach workout assignment.
  try {
    const assignment = await workoutAssignmentService.getTodayPendingAssignment(
      userId,
      companyId,
    );
    if (assignment && !session.workout_id) {
      await pool.query("UPDATE sessions SET workout_id = $1 WHERE id = $2", [
        assignment.workout_id,
        session.id,
      ]);
      session.workout_id = assignment.workout_id;
    }
  } catch (err) {
    console.warn(
      "[SessionService] auto-attach assignment error:",
      (err as Error).message,
    );
  }

  return session;
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
    "SELECT id, company_id, started_at FROM sessions WHERE id = $1 AND user_id = $2 AND ended_at IS NULL AND deleted_at IS NULL",
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
  const stats = await querySessionStats(sessionId, session.company_id, userId);

  const result = await pool.query(
    `UPDATE sessions
     SET ended_at = NOW(),
         avg_hr = $1,
         max_hr = $2,
         min_hr = $3,
         duration_minutes = $4,
         hr_zone = $5
     WHERE id = $6
     RETURNING id, user_id, company_id, started_at, ended_at, avg_hr, max_hr, min_hr,
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
  } catch (err) {
    console.warn(
      "[SessionService] device return error:",
      (err as Error).message,
    );
  }

  // Fire-and-forget ML analyze-session
  callMlAnalyzeSession(sessionId, userId, session.company_id).catch((err) => {
    console.warn(
      "[SessionService] ML analyze-session failed:",
      (err as Error).message,
    );
  });

  // Link workout assignment ke session jika ada pending assignment hari ini yang match
  try {
    const endedWorkoutId = ended.workout_id;
    if (endedWorkoutId) {
      const assignmentResult = await pool.query(
        `SELECT id FROM workout_assignments
         WHERE member_id = $1 AND workout_id = $2
           AND status = 'pending' AND assigned_date = CURRENT_DATE
         LIMIT 1`,
        [userId, endedWorkoutId],
      );
      if (assignmentResult.rows.length > 0) {
        await workoutAssignmentService.linkAssignmentToSession(
          assignmentResult.rows[0].id,
          sessionId,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[SessionService] link assignment error:",
      (err as Error).message,
    );
  }

  return ended;
}

/**
 * Lists all active sessions (ended_at IS NULL) in a company.
 * Used by trainer/owner live monitoring.
 */
export async function listActiveSessions(companyId: string): Promise<
  Array<{
    id: string;
    user_id: string;
    started_at: Date;
    workout_id: string | null;
    mood: string | null;
  }>
> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, started_at, workout_id, mood
     FROM sessions
     WHERE company_id = $1 AND ended_at IS NULL AND deleted_at IS NULL
     ORDER BY started_at DESC`,
    [companyId],
  );
  return result.rows;
}

/**
 * Lists historical sessions for a member.
 * Requirements: 10.5
 */
export async function listSessions(
  companyId: string,
  userId: string,
): Promise<Session[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, company_id, started_at, ended_at, avg_hr, max_hr, min_hr,
            duration_minutes, hr_zone, auto_closed, created_at
     FROM sessions
     WHERE user_id = $1 AND company_id = $2 AND deleted_at IS NULL
     ORDER BY started_at DESC`,
    [userId, companyId],
  );
  return result.rows as Session[];
}

/**
 * Gets a single session by ID.
 * Requirements: 10.6
 */
export async function getSession(
  companyId: string,
  userId: string,
  sessionId: string,
): Promise<Session> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, company_id, started_at, ended_at, avg_hr, max_hr, min_hr,
            duration_minutes, hr_zone, auto_closed, created_at
     FROM sessions
     WHERE id = $1 AND user_id = $2 AND company_id = $3 AND deleted_at IS NULL`,
    [sessionId, userId, companyId],
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
  companyId: string,
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
        |> filter(fn: (r) => r["company_id"] == "${companyId}")
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
  companyId: string,
): Promise<void> {
  // Skip ML service if not configured
  if (
    !config.ml.serviceUrl ||
    config.ml.serviceUrl === "http://localhost:8000"
  ) {
    console.log(
      "[session] ML service not configured, skipping session analysis",
    );
    return;
  }

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
      "[SessionService] ML analyze-session tidak dapat dijangkau:",
      (err as Error).message,
    );
  }
}
