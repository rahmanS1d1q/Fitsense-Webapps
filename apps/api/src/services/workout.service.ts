import { getPool } from "../db/client";

export interface Workout {
  id: string;
  company_id: string;
  asset_id: string | null;
  name: string;
  intro_activities: string | null;
  intro_duration: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateWorkoutInput {
  name: string;
  intro_activities?: string;
  intro_duration?: number;
  asset_id?: string;
}

export interface UpdateWorkoutInput {
  name?: string;
  intro_activities?: string;
  intro_duration?: number;
  asset_id?: string | null;
}

export async function createWorkout(
  companyId: string,
  data: CreateWorkoutInput,
): Promise<Workout> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO workouts (company_id, name, intro_activities, intro_duration, asset_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      companyId,
      data.name,
      data.intro_activities ?? null,
      data.intro_duration ?? null,
      data.asset_id ?? null,
    ],
  );
  return result.rows[0] as Workout;
}

export async function listWorkouts(companyId: string): Promise<Workout[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM workouts WHERE company_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
    [companyId],
  );
  return result.rows as Workout[];
}

export async function getWorkout(
  companyId: string,
  workoutId: string,
): Promise<Workout> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM workouts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
    [workoutId, companyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Workout tidak ditemukan"), {
      statusCode: 404,
    });
  }
  return result.rows[0] as Workout;
}

export async function updateWorkout(
  companyId: string,
  workoutId: string,
  data: UpdateWorkoutInput,
): Promise<Workout> {
  const pool = getPool();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push("name = $" + String(idx++));
    values.push(data.name);
  }
  if (data.intro_activities !== undefined) {
    fields.push("intro_activities = $" + String(idx++));
    values.push(data.intro_activities);
  }
  if (data.intro_duration !== undefined) {
    fields.push("intro_duration = $" + String(idx++));
    values.push(data.intro_duration);
  }
  if (data.asset_id !== undefined) {
    fields.push("asset_id = $" + String(idx++));
    values.push(data.asset_id);
  }

  if (fields.length === 0) {
    throw Object.assign(new Error("Tidak ada field yang diupdate"), {
      statusCode: 400,
    });
  }

  fields.push("updated_at = NOW()");
  values.push(workoutId, companyId);

  const result = await pool.query(
    "UPDATE workouts SET " +
      fields.join(", ") +
      " WHERE id = $" +
      String(idx++) +
      " AND company_id = $" +
      String(idx) +
      " AND deleted_at IS NULL RETURNING *",
    values,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Workout tidak ditemukan"), {
      statusCode: 404,
    });
  }
  return result.rows[0] as Workout;
}

export async function deleteWorkout(
  companyId: string,
  workoutId: string,
): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE workouts SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING id",
    [workoutId, companyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Workout tidak ditemukan"), {
      statusCode: 404,
    });
  }
}
