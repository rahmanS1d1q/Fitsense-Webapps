/**
 * WorkoutAssignmentService — Trainer/owner assign workout ke member.
 * Web dashboard membuat assignment; mobile app membaca assignment pending saat start session.
 */

import { z } from "zod";
import { getPool } from "../db/client";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const createAssignmentSchema = z.object({
  member_id: z.string().uuid(),
  workout_id: z.string().uuid(),
  assigned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal: YYYY-MM-DD"),
  notes: z.string().max(500).optional(),
});

export const updateAssignmentSchema = z.object({
  status: z.enum(["pending", "completed", "skipped"]).optional(),
  notes: z.string().max(500).optional(),
  workout_id: z.string().uuid().optional(),
  assigned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export type AssignmentStatus = "pending" | "completed" | "skipped";

export interface WorkoutAssignment {
  id: string;
  company_id: string;
  member_id: string;
  trainer_id: string;
  workout_id: string;
  assigned_date: string;
  notes: string | null;
  status: AssignmentStatus;
  session_id: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields (optional, populated by list/get queries)
  member_name?: string;
  workout_name?: string;
  trainer_name?: string;
  intro_activities?: string | null;
  intro_duration?: number | null;
}

export interface ListAssignmentFilters {
  member_id?: string;
  trainer_id?: string;
  status?: AssignmentStatus;
  assigned_date?: string;
  from?: string;
  to?: string;
}

export interface MemberAssignmentFilters {
  status?: AssignmentStatus;
  from?: string;
  to?: string;
}

function httpError(message: string, statusCode: number, code?: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

// ─── Functions ────────────────────────────────────────────────────────────

/**
 * Buat assignment baru. Status selalu 'pending'.
 */
export async function createAssignment(
  companyId: string,
  trainerId: string,
  data: CreateAssignmentInput,
): Promise<WorkoutAssignment> {
  const pool = getPool();

  // Validasi member ada di company yang sama
  const memberCheck = await pool.query(
    "SELECT 1 FROM users_companies WHERE user_id = $1 AND company_id = $2",
    [data.member_id, companyId],
  );
  if (memberCheck.rows.length === 0) {
    throw httpError("Member tidak ditemukan di company ini", 404, "NOT_FOUND");
  }

  // Validasi workout ada di company yang sama
  const workoutCheck = await pool.query(
    "SELECT 1 FROM workouts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
    [data.workout_id, companyId],
  );
  if (workoutCheck.rows.length === 0) {
    throw httpError("Workout tidak ditemukan di company ini", 404, "NOT_FOUND");
  }

  // Cek tidak ada assignment pending untuk member yang sama di tanggal yang sama
  const dupeCheck = await pool.query(
    `SELECT 1 FROM workout_assignments
     WHERE member_id = $1 AND company_id = $2
       AND assigned_date = $3 AND status = 'pending' AND deleted_at IS NULL`,
    [data.member_id, companyId, data.assigned_date],
  );
  if (dupeCheck.rows.length > 0) {
    throw httpError(
      "Member sudah punya assignment di tanggal ini",
      409,
      "ASSIGNMENT_CONFLICT",
    );
  }

  const result = await pool.query(
    `INSERT INTO workout_assignments
       (company_id, member_id, trainer_id, workout_id, assigned_date, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [
      companyId,
      data.member_id,
      trainerId,
      data.workout_id,
      data.assigned_date,
      data.notes ?? null,
    ],
  );

  return result.rows[0] as WorkoutAssignment;
}

/**
 * List assignment per company (trainer/owner) dengan filter opsional.
 * Include nama member, workout, dan trainer.
 */
export async function listAssignments(
  companyId: string,
  filters: ListAssignmentFilters = {},
): Promise<WorkoutAssignment[]> {
  const pool = getPool();

  const conditions: string[] = ["wa.company_id = $1", "wa.deleted_at IS NULL"];
  const values: unknown[] = [companyId];
  let idx = 2;

  if (filters.member_id) {
    conditions.push(`wa.member_id = $${idx++}`);
    values.push(filters.member_id);
  }
  if (filters.trainer_id) {
    conditions.push(`wa.trainer_id = $${idx++}`);
    values.push(filters.trainer_id);
  }
  if (filters.status) {
    conditions.push(`wa.status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.assigned_date) {
    conditions.push(`wa.assigned_date = $${idx++}`);
    values.push(filters.assigned_date);
  }
  if (filters.from) {
    conditions.push(`wa.assigned_date >= $${idx++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`wa.assigned_date <= $${idx++}`);
    values.push(filters.to);
  }

  const result = await pool.query(
    `SELECT wa.*,
            TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name,
            TRIM(CONCAT(t.first_name, ' ', t.last_name)) AS trainer_name,
            w.name AS workout_name
     FROM workout_assignments wa
     JOIN users m ON m.id = wa.member_id
     JOIN users t ON t.id = wa.trainer_id
     JOIN workouts w ON w.id = wa.workout_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY wa.assigned_date DESC, wa.created_at DESC`,
    values,
  );

  return result.rows as WorkoutAssignment[];
}

/**
 * Get satu assignment by id (terbatas pada company).
 */
export async function getAssignment(
  companyId: string,
  assignmentId: string,
): Promise<WorkoutAssignment> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT wa.*,
            TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name,
            TRIM(CONCAT(t.first_name, ' ', t.last_name)) AS trainer_name,
            w.name AS workout_name,
            w.intro_activities,
            w.intro_duration
     FROM workout_assignments wa
     JOIN users m ON m.id = wa.member_id
     JOIN users t ON t.id = wa.trainer_id
     JOIN workouts w ON w.id = wa.workout_id
     WHERE wa.id = $1 AND wa.company_id = $2 AND wa.deleted_at IS NULL`,
    [assignmentId, companyId],
  );
  if (result.rows.length === 0) {
    throw httpError("Assignment tidak ditemukan", 404, "NOT_FOUND");
  }
  return result.rows[0] as WorkoutAssignment;
}

/**
 * List assignment per member (untuk member lihat jadwal sendiri).
 * Include data workout (nama, intro_activities, intro_duration).
 */
export async function listMemberAssignments(
  memberId: string,
  companyId: string,
  filters: MemberAssignmentFilters = {},
): Promise<WorkoutAssignment[]> {
  const pool = getPool();

  const conditions: string[] = ["wa.member_id = $1", "wa.company_id = $2", "wa.deleted_at IS NULL"];
  const values: unknown[] = [memberId, companyId];
  let idx = 3;

  if (filters.status) {
    conditions.push(`wa.status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.from) {
    conditions.push(`wa.assigned_date >= $${idx++}`);
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`wa.assigned_date <= $${idx++}`);
    values.push(filters.to);
  }

  const result = await pool.query(
    `SELECT wa.*,
            TRIM(CONCAT(t.first_name, ' ', t.last_name)) AS trainer_name,
            w.name AS workout_name,
            w.intro_activities,
            w.intro_duration
     FROM workout_assignments wa
     JOIN users t ON t.id = wa.trainer_id
     JOIN workouts w ON w.id = wa.workout_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY wa.assigned_date DESC, wa.created_at DESC`,
    values,
  );

  return result.rows as WorkoutAssignment[];
}

/**
 * Get assignment pending hari ini untuk member (dipanggil mobile app saat start session).
 * Return satu assignment atau null.
 */
export async function getTodayPendingAssignment(
  memberId: string,
  companyId: string,
): Promise<WorkoutAssignment | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT wa.*,
            w.name AS workout_name,
            w.intro_activities,
            w.intro_duration
     FROM workout_assignments wa
     JOIN workouts w ON w.id = wa.workout_id
     WHERE wa.member_id = $1 AND wa.company_id = $2
       AND wa.assigned_date = CURRENT_DATE AND wa.status = 'pending' AND wa.deleted_at IS NULL
     ORDER BY wa.created_at ASC
     LIMIT 1`,
    [memberId, companyId],
  );
  return (result.rows[0] as WorkoutAssignment) ?? null;
}

/**
 * Update assignment. Tidak bisa update jika status sudah 'completed'.
 */
export async function updateAssignment(
  assignmentId: string,
  companyId: string,
  data: UpdateAssignmentInput,
): Promise<WorkoutAssignment> {
  const pool = getPool();

  const existing = await pool.query(
    "SELECT status FROM workout_assignments WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
    [assignmentId, companyId],
  );
  if (existing.rows.length === 0) {
    throw httpError("Assignment tidak ditemukan", 404, "NOT_FOUND");
  }
  if (existing.rows[0].status === "completed") {
    throw httpError(
      "Assignment sudah selesai, tidak bisa diubah",
      409,
      "ASSIGNMENT_COMPLETED",
    );
  }

  // Jika mengubah workout_id, validasi workout ada di company
  if (data.workout_id) {
    const workoutCheck = await pool.query(
      "SELECT 1 FROM workouts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [data.workout_id, companyId],
    );
    if (workoutCheck.rows.length === 0) {
      throw httpError(
        "Workout tidak ditemukan di company ini",
        404,
        "NOT_FOUND",
      );
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(data.status);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(data.notes);
  }
  if (data.workout_id !== undefined) {
    fields.push(`workout_id = $${idx++}`);
    values.push(data.workout_id);
  }
  if (data.assigned_date !== undefined) {
    fields.push(`assigned_date = $${idx++}`);
    values.push(data.assigned_date);
  }

  if (fields.length === 0) {
    throw httpError("Tidak ada field yang diupdate", 400, "VALIDATION_ERROR");
  }

  fields.push("updated_at = NOW()");
  values.push(assignmentId, companyId);

  const result = await pool.query(
    `UPDATE workout_assignments SET ${fields.join(", ")}
     WHERE id = $${idx++} AND company_id = $${idx}
     RETURNING *`,
    values,
  );

  return result.rows[0] as WorkoutAssignment;
}

/**
 * Hapus assignment. Hanya bisa hapus jika status 'pending'.
 */
export async function deleteAssignment(
  assignmentId: string,
  companyId: string,
): Promise<void> {
  const pool = getPool();

  const existing = await pool.query(
    "SELECT status FROM workout_assignments WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
    [assignmentId, companyId],
  );
  if (existing.rows.length === 0) {
    throw httpError("Assignment tidak ditemukan", 404, "NOT_FOUND");
  }
  if (existing.rows[0].status !== "pending") {
    throw httpError(
      "Hanya assignment pending yang bisa dihapus",
      409,
      "ASSIGNMENT_NOT_PENDING",
    );
  }

  await pool.query(
    "UPDATE workout_assignments SET deleted_at = NOW() WHERE id = $1 AND company_id = $2",
    [assignmentId, companyId],
  );
}

/**
 * Link assignment ke session (dipanggil saat session end).
 * Update session_id + status jadi 'completed'.
 */
export async function linkAssignmentToSession(
  assignmentId: string,
  sessionId: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE workout_assignments
     SET session_id = $1, status = 'completed', updated_at = NOW()
     WHERE id = $2`,
    [sessionId, assignmentId],
  );
}
