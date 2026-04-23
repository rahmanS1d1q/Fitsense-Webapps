import bcrypt from "bcryptjs";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";

export interface Member {
  id: string;
  club_id: string;
  name: string;
  email: string;
  role: string;
  age: number | null;
  gender: string | null;
  status: "active" | "inactive";
  created_at: Date;
}

export interface CreateMemberInput {
  name: string;
  email: string;
  password: string;
  age?: number;
  gender?: string;
  role?: "member" | "trainer";
}

export interface UpdateMemberInput {
  name?: string;
  age?: number;
  gender?: string;
}

/**
 * Creates a new member account linked to the given club.
 * Email must be globally unique across all clubs.
 * Requirements: 3.1, 3.7
 */
export async function createMember(
  clubId: string,
  data: CreateMemberInput,
): Promise<Member> {
  const pool = getPool();

  // Check global email uniqueness
  const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [
    data.email,
  ]);
  if (emailCheck.rows.length > 0) {
    throw Object.assign(
      new Error("Email sudah digunakan oleh pengguna lain."),
      { statusCode: 409, code: "EMAIL_CONFLICT", field: "email" },
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const role = data.role ?? "member";

  const result = await pool.query(
    `INSERT INTO users (club_id, name, email, password_hash, role, age, gender)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, club_id, name, email, role, age, gender, status, created_at`,
    [
      clubId,
      data.name,
      data.email,
      passwordHash,
      role,
      data.age ?? null,
      data.gender ?? null,
    ],
  );

  return result.rows[0] as Member;
}

/**
 * Returns all active members in the given club.
 * Requirements: 3.3
 */
export async function listMembers(clubId: string): Promise<Member[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, club_id, name, email, role, age, gender, status, created_at
     FROM users
     WHERE club_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [clubId],
  );
  return result.rows as Member[];
}

/**
 * Returns a single member by userId within the given club.
 * Requirements: 3.4
 */
export async function getMember(
  clubId: string,
  userId: string,
): Promise<Member> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, club_id, name, email, role, age, gender, status, created_at
     FROM users
     WHERE id = $1 AND club_id = $2`,
    [userId, clubId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }
  return result.rows[0] as Member;
}

/**
 * Updates a member's profile data.
 * Requirements: 3.5
 */
export async function updateMember(
  clubId: string,
  userId: string,
  data: UpdateMemberInput,
): Promise<Member> {
  const pool = getPool();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.age !== undefined) {
    fields.push(`age = $${idx++}`);
    values.push(data.age);
  }
  if (data.gender !== undefined) {
    fields.push(`gender = $${idx++}`);
    values.push(data.gender);
  }

  if (fields.length === 0) {
    throw Object.assign(new Error("No fields to update"), { statusCode: 400 });
  }

  values.push(userId, clubId);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")}
     WHERE id = $${idx} AND club_id = $${idx + 1}
     RETURNING id, club_id, name, email, role, age, gender, status, created_at`,
    values,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  return result.rows[0] as Member;
}

/**
 * Deactivates a member account and invalidates all active tokens.
 * Requirements: 3.6
 */
export async function deactivateMember(
  clubId: string,
  userId: string,
): Promise<void> {
  const pool = getPool();

  const result = await pool.query(
    "UPDATE users SET status = 'inactive' WHERE id = $1 AND club_id = $2 RETURNING id",
    [userId, clubId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  // Invalidate all active tokens by deleting refresh token from Redis
  const redis = getRedis();
  await redis.del(`refresh_token:${userId}`);
}
