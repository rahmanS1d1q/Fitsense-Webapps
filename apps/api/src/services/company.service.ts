/**
 * CompanyService — renamed FROM companieservice
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { getPool } from "../db/client";
import { getRedis } from "../db/redis";
import * as auditLogService from "./audit-log.service";

export interface Company {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: "active" | "suspended";
  asset_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

export function validateSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export async function listCompanies(): Promise<Company[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, name, slug, address, phone, status, asset_id, created_at, updated_at FROM companies WHERE deleted_at IS NULL ORDER BY created_at DESC",
  );
  return result.rows as Company[];
}

export async function updateCompany(
  companyId: string,
  data: Partial<Pick<Company, "name" | "slug" | "address" | "phone">>,
): Promise<Company> {
  const pool = getPool();

  if (data.slug !== undefined && !validateSlug(data.slug)) {
    throw Object.assign(new Error("Invalid slug format"), {
      statusCode: 400,
      field: "slug",
    });
  }

  if (data.slug !== undefined) {
    const slugCheck = await pool.query(
      "SELECT id FROM companies WHERE slug = $1 AND id != $2",
      [data.slug, companyId],
    );
    if (slugCheck.rows.length > 0) {
      throw Object.assign(
        new Error(`Slug '${data.slug}' sudah digunakan oleh company lain.`),
        { statusCode: 409, code: "SLUG_CONFLICT", field: "slug" },
      );
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.slug !== undefined) {
    fields.push(`slug = $${idx++}`);
    values.push(data.slug);
  }
  if (data.address !== undefined) {
    fields.push(`address = $${idx++}`);
    values.push(data.address);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    values.push(data.phone);
  }

  if (fields.length === 0) {
    throw Object.assign(new Error("No fields to update"), { statusCode: 400 });
  }

  fields.push(`updated_at = NOW()`);
  values.push(companyId);

  const result = await pool.query(
    `UPDATE companies SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, slug, address, phone, status, asset_id, created_at, updated_at`,
    values,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Company not found"), { statusCode: 404 });
  }

  return result.rows[0] as Company;
}

export async function suspendCompany(companyId: string, performedBy: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyResult = await client.query(
      "UPDATE companies SET status = 'suspended', updated_at = NOW() WHERE id = $1 RETURNING id, name",
      [companyId],
    );

    if (companyResult.rows.length === 0) {
      throw Object.assign(new Error("Company not found"), { statusCode: 404 });
    }

    const company = companyResult.rows[0];

    // Revoke access for all users in the company via users_companies
    await client.query(
      `UPDATE users SET status = 'inactive', updated_at = NOW()
       WHERE id IN (SELECT user_id FROM users_companies WHERE company_id = $1)`,
      [companyId],
    );

    // Invalidate Redis tokens for all users in the company
    const userIdsResult = await client.query(
      "SELECT user_id FROM users_companies WHERE company_id = $1",
      [companyId]
    );
    const redis = getRedis();
    for (const row of userIdsResult.rows) {
      await redis.del(`refresh_token:${row.user_id}`);
    }

    // Record audit log
    await auditLogService.log({
      action: "suspend_company",
      entityType: "company",
      entityId: companyId,
      entityData: {
        id: company.id,
        name: company.name,
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

export async function hardDeleteCompany(
  companyId: string,
  confirmationName: string,
  performedBy: string,
): Promise<void> {
  const pool = getPool();

  const check = await pool.query(
    "SELECT id, name FROM companies WHERE id = $1 AND deleted_at IS NULL",
    [companyId],
  );

  if (check.rows.length === 0) {
    throw Object.assign(new Error("Company tidak ditemukan"), { statusCode: 404 });
  }

  const company = check.rows[0];

  if (confirmationName !== company.name) {
    throw Object.assign(new Error("Nama konfirmasi tidak sesuai"), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Record audit log before delete
    await auditLogService.log({
      action: "hard_delete",
      entityType: "company",
      entityId: companyId,
      entityData: {
        id: company.id,
        name: company.name,
      },
      performedBy,
    });

    // Invalidate Redis tokens for all users in the company
    const userIdsResult = await client.query(
      "SELECT user_id FROM users_companies WHERE company_id = $1",
      [companyId]
    );
    const redis = getRedis();
    for (const row of userIdsResult.rows) {
      await redis.del(`refresh_token:${row.user_id}`);
    }

    // Delete from companies — CASCADE handles the rest
    await client.query("DELETE FROM companies WHERE id = $1", [companyId]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function activateCompany(companyId: string, performedBy: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyResult = await client.query(
      "UPDATE companies SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING id, name",
      [companyId],
    );

    if (companyResult.rows.length === 0) {
      throw Object.assign(new Error("Company not found"), { statusCode: 404 });
    }

    const company = companyResult.rows[0];

    // Activate all users in the company
    await client.query(
      `UPDATE users SET status = 'active', updated_at = NOW()
       WHERE id IN (SELECT user_id FROM users_companies WHERE company_id = $1)`,
      [companyId],
    );

    // Record audit log
    await auditLogService.log({
      action: "activate_company",
      entityType: "company",
      entityId: companyId,
      entityData: {
        id: company.id,
        name: company.name,
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

