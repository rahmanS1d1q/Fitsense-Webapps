import bcrypt from "bcryptjs";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";

export interface Member {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  status: "active" | "inactive";
  created_at: Date;
}

export interface CreateMemberInput {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  role?: "member" | "trainer";
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
}

/**
 * Creates a new member account linked to the given company.
 * Email must be globally unique across all companies.
 * Requirements: 3.1, 3.7
 */
export async function createMember(
  companyId: string,
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
      {
        statusCode: 409,
        code: "EMAIL_CONFLICT",
        field: "email",
      },
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const role = data.role ?? "member";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Insert user — role stored in users table (NOT NULL in schema)
    const userResult = await client.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, age, gender, height, weight, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, first_name, last_name, email, age, gender, height, weight, status, created_at`,
      [
        data.firstName,
        data.lastName || data.firstName,
        data.email,
        passwordHash,
        data.age ?? null,
        data.gender ?? null,
        data.height ?? null,
        data.weight ?? null,
        role,
      ],
    );
    const user = userResult.rows[0];

    // Also link to company via users_companies for RBAC
    await client.query(
      "INSERT INTO users_companies (user_id, company_id, role) VALUES ($1, $2, $3)",
      [user.id, companyId, role],
    );

    await client.query("COMMIT");
    return { ...user, company_id: companyId, role } as Member;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns all active members in the given company.
 */
export async function listMembers(companyId: string): Promise<Member[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id, uc.company_id, u.first_name, u.last_name, u.email, uc.role,
            u.age, u.gender, u.height, u.weight, u.status, u.created_at
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE uc.company_id = $1 AND u.status = 'active'
     ORDER BY u.created_at DESC`,
    [companyId],
  );
  return result.rows as Member[];
}

/**
 * Returns a single member by userId within the given company.
 */
export async function getMember(
  companyId: string,
  userId: string,
): Promise<Member> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT u.id, uc.company_id, u.first_name, u.last_name, u.email, uc.role,
            u.age, u.gender, u.height, u.weight, u.status, u.created_at
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE u.id = $1 AND uc.company_id = $2`,
    [userId, companyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }
  return result.rows[0] as Member;
}

/**
 * Updates a member's profile data.
 */
export async function updateMember(
  companyId: string,
  userId: string,
  data: UpdateMemberInput,
): Promise<Member> {
  const pool = getPool();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.firstName !== undefined) {
    fields.push(`first_name = $${idx++}`);
    values.push(data.firstName);
  }
  if (data.lastName !== undefined) {
    fields.push(`last_name = $${idx++}`);
    values.push(data.lastName);
  }
  if (data.age !== undefined) {
    fields.push(`age = $${idx++}`);
    values.push(data.age);
  }
  if (data.gender !== undefined) {
    fields.push(`gender = $${idx++}`);
    values.push(data.gender);
  }
  if (data.height !== undefined) {
    fields.push(`height = $${idx++}`);
    values.push(data.height);
  }
  if (data.weight !== undefined) {
    fields.push(`weight = $${idx++}`);
    values.push(data.weight);
  }

  if (fields.length === 0) {
    throw Object.assign(new Error("No fields to update"), { statusCode: 400 });
  }

  // Always update updated_at
  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, first_name, last_name, email, age, gender, height, weight, status, created_at`,
    values,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  const user = result.rows[0];
  return { ...user, company_id: companyId, role: "member" } as Member;
}

/**
 * Deactivates a member account and invalidates all active tokens.
 */
export async function deactivateMember(
  companyId: string,
  userId: string,
): Promise<void> {
  const pool = getPool();

  // Verify member belongs to company
  const check = await pool.query(
    "SELECT id FROM users_companies WHERE user_id = $1 AND company_id = $2",
    [userId, companyId],
  );
  if (check.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  await pool.query(
    "UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1",
    [userId],
  );

  const redis = getRedis();
  await redis.del(`refresh_token:${userId}`);
}
