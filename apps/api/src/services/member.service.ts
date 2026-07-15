import bcrypt from "bcryptjs";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";
import * as auditLogService from "./audit-log.service";

export interface Member {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  status: "active" | "inactive";
  created_at: Date;
  calculated_age?: number | null;
}

export interface CreateMemberInput {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  date_of_birth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  role?: "member" | "trainer";
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  date_of_birth?: string;
  gender?: string;
  height?: number;
  weight?: number;
}

// Hitung usia dari date_of_birth
export function calculateAge(dateOfBirth: Date | string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
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
      `INSERT INTO users (first_name, last_name, email, password_hash, date_of_birth, gender, height, weight, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING id, first_name, last_name, email, date_of_birth, gender, height, weight, status, created_at`,
      [
        data.firstName,
        data.lastName || data.firstName,
        data.email,
        passwordHash,
        data.date_of_birth ?? null,
        data.gender ?? null,
        data.height ?? null,
        data.weight ?? null,
        role,
      ],
    );
    const user = userResult.rows[0];
    const calculated_age = user.date_of_birth ? calculateAge(user.date_of_birth) : null;

    // Also link to company via users_companies for RBAC
    await client.query(
      "INSERT INTO users_companies (user_id, company_id, role) VALUES ($1, $2, $3)",
      [user.id, companyId, role],
    );

    await client.query("COMMIT");
    return { ...user, age: calculated_age, calculated_age, company_id: companyId, role } as Member;
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
            u.date_of_birth, u.gender, u.height, u.weight, u.status, u.created_at,
            u.deleted_at
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE uc.company_id = $1 AND (u.deleted_at IS NULL OR u.status = 'inactive')
     ORDER BY u.created_at DESC`,
    [companyId],
  );
  return result.rows.map(row => {
    const calculated_age = row.date_of_birth ? calculateAge(row.date_of_birth) : null;
    return {
      ...row,
      age: calculated_age,
      calculated_age
    };
  }) as Member[];
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
            u.date_of_birth, u.gender, u.height, u.weight, u.status, u.created_at,
            u.deleted_at
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE u.id = $1 AND uc.company_id = $2 AND (u.deleted_at IS NULL OR u.status = 'inactive')`,
    [userId, companyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }
  const row = result.rows[0];
  const calculated_age = row.date_of_birth ? calculateAge(row.date_of_birth) : null;
  return {
    ...row,
    age: calculated_age,
    calculated_age
  } as Member;
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
  if (data.date_of_birth !== undefined) {
    fields.push(`date_of_birth = $${idx++}`);
    values.push(data.date_of_birth);
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

  // Security: Verify cross-tenant ownership — userId must be registered in companyId.
  // This prevents BOLA where a club_owner of Company A can modify members of Company B.
  const membershipCheck = await pool.query(
    "SELECT 1 FROM users_companies WHERE user_id = $1 AND company_id = $2",
    [userId, companyId],
  );
  if (membershipCheck.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  // Always update updated_at
  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, first_name, last_name, email, date_of_birth, gender, height, weight, status, created_at`,
    values,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Member not found"), { statusCode: 404 });
  }

  const user = result.rows[0];
  const calculated_age = user.date_of_birth ? calculateAge(user.date_of_birth) : null;
  return { ...user, age: calculated_age, calculated_age, company_id: companyId, role: "member" } as Member;
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

async function invalidateRedisTokens(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`refresh_token:${userId}`);

  // Scan and delete matching MQTT sessions
  const keys = await redis.keys("mqtt_session:*");
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      try {
        const session = JSON.parse(data);
        if (session.userId === userId) {
          await redis.del(key);
        }
      } catch {
        // ignore
      }
    }
  }
}

export async function softDeleteMember(
  companyId: string,
  userId: string,
  performedBy: string,
): Promise<void> {
  const pool = getPool();

  const check = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.deleted_at 
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE u.id = $1 AND uc.company_id = $2`,
    [userId, companyId],
  );

  if (check.rows.length === 0 || check.rows[0].deleted_at !== null) {
    throw Object.assign(new Error("Member tidak ditemukan"), { statusCode: 404 });
  }

  const member = check.rows[0];

  if (userId === performedBy) {
    throw Object.assign(new Error("Tidak bisa menghapus akun sendiri"), { statusCode: 400 });
  }

  if (member.role === "super_admin") {
    throw Object.assign(new Error("Tidak bisa menghapus akun super admin"), { statusCode: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE users 
       SET deleted_at = NOW(), deleted_by = $1, status = 'inactive', updated_at = NOW() 
       WHERE id = $2`,
      [performedBy, userId],
    );

    await client.query(
      `UPDATE sessions SET ended_at = NOW() 
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId],
    );

    await invalidateRedisTokens(userId);

    await auditLogService.log({
      action: "soft_delete",
      entityType: "user",
      entityId: userId,
      entityData: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        role: member.role,
        status: member.status,
      },
      performedBy,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function restoreMember(
  companyId: string,
  userId: string,
  performedBy: string,
): Promise<void> {
  const pool = getPool();

  const check = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.deleted_at 
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE u.id = $1 AND uc.company_id = $2`,
    [userId, companyId],
  );

  if (check.rows.length === 0) {
    throw Object.assign(new Error("Member tidak ditemukan"), { statusCode: 404 });
  }

  const member = check.rows[0];

  if (member.deleted_at === null && member.status === "active") {
    throw Object.assign(new Error("Member masih aktif, tidak perlu direstore"), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE users 
       SET deleted_at = NULL, deleted_by = NULL, status = 'active', updated_at = NOW() 
       WHERE id = $1`,
      [userId],
    );

    await auditLogService.log({
      action: "restore",
      entityType: "user",
      entityId: userId,
      entityData: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        role: member.role,
      },
      performedBy,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function hardDeleteMember(
  companyId: string,
  userId: string,
  confirmationName: string,
  performedBy: string,
): Promise<void> {
  const pool = getPool();

  const check = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.deleted_at 
     FROM users u
     JOIN users_companies uc ON uc.user_id = u.id
     WHERE u.id = $1 AND uc.company_id = $2`,
    [userId, companyId],
  );

  if (check.rows.length === 0) {
    throw Object.assign(new Error("Member tidak ditemukan"), { statusCode: 404 });
  }

  const member = check.rows[0];

  if (userId === performedBy) {
    throw Object.assign(new Error("Tidak bisa menghapus akun sendiri"), { statusCode: 400 });
  }

  if (member.role === "super_admin") {
    throw Object.assign(new Error("Tidak bisa menghapus akun super admin"), { statusCode: 403 });
  }

  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ");
  if (confirmationName !== fullName) {
    throw Object.assign(new Error("Nama konfirmasi tidak sesuai"), { statusCode: 400 });
  }

  const activeSessionCheck = await pool.query(
    "SELECT id FROM sessions WHERE user_id = $1 AND ended_at IS NULL",
    [userId]
  );
  if (activeSessionCheck.rows.length > 0) {
    throw Object.assign(new Error("Member masih memiliki sesi aktif, tutup sesi dulu"), { statusCode: 409 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await auditLogService.log({
      action: "hard_delete",
      entityType: "user",
      entityId: userId,
      entityData: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        role: member.role,
        status: member.status,
        deleted_at: member.deleted_at,
      },
      performedBy,
    });

    await invalidateRedisTokens(userId);

    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
