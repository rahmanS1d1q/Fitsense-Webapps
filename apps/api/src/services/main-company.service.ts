/**
 * MainCompanyService — manages main_companies (parent organizations)
 * and company_branches (branch metadata linking companies.id to main_companies.id).
 *
 * Hard rules:
 * - companies.id remains the operational companyId used everywhere.
 * - company_branches has no .id column; company_id is its PK.
 * - Branch ID returned to callers is always companies.id (as `companyId`).
 */

import { getPool } from "../db/client";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MainCompany {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: "active" | "suspended";
  created_at: Date;
  updated_at: Date;
}

export interface CreateMainCompanyInput {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
}

export interface UpdateMainCompanyInput {
  name?: string;
  slug?: string;
  address?: string;
  phone?: string;
}

export interface CreateBranchInput {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  display_name?: string;
  contact_person?: string;
  contact_email?: string;
  notes?: string;
}

export interface BranchResult {
  companyId: string; // companies.id — the operational companyId
  mainCompanyId: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: string;
  display_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

export function validateSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

// ─── Main Company CRUD ────────────────────────────────────────────────────────

/**
 * Creates a new parent gym organization.
 */
export async function createMainCompany(
  input: CreateMainCompanyInput,
): Promise<MainCompany> {
  if (!input.name?.trim()) {
    throw Object.assign(new Error("name is required"), {
      statusCode: 400,
      field: "name",
    });
  }
  // Normalize slug defensively — safe even when called outside HTTP routes
  const slug =
    typeof input.slug === "string"
      ? input.slug.trim().toLowerCase()
      : input.slug;
  if (!validateSlug(slug)) {
    throw Object.assign(new Error("Invalid slug format"), {
      statusCode: 400,
      field: "slug",
    });
  }

  const pool = getPool();

  const slugCheck = await pool.query(
    "SELECT id FROM main_companies WHERE slug = $1 AND deleted_at IS NULL",
    [slug],
  );
  if (slugCheck.rows.length > 0) {
    throw Object.assign(
      new Error(`Slug '${slug}' sudah digunakan oleh main company lain.`),
      { statusCode: 409, code: "SLUG_CONFLICT", field: "slug" },
    );
  }

  const result = await pool.query(
    `INSERT INTO main_companies (name, slug, address, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, slug, address, phone, status, created_at, updated_at`,
    [input.name.trim(), slug, input.address ?? null, input.phone ?? null],
  );

  return result.rows[0] as MainCompany;
}

/**
 * Lists all active parent gym organizations (excludes soft-deleted).
 */
export async function listMainCompanies(): Promise<MainCompany[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, slug, address, phone, status, created_at, updated_at
     FROM main_companies
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`,
  );
  return result.rows as MainCompany[];
}

/**
 * Gets a single parent gym organization by id.
 */
export async function getMainCompany(
  mainCompanyId: string,
): Promise<MainCompany> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, slug, address, phone, status, created_at, updated_at
     FROM main_companies
     WHERE id = $1 AND deleted_at IS NULL`,
    [mainCompanyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Main company not found"), {
      statusCode: 404,
    });
  }
  return result.rows[0] as MainCompany;
}

/**
 * Updates a parent gym organization (partial update).
 */
export async function updateMainCompany(
  mainCompanyId: string,
  data: UpdateMainCompanyInput,
): Promise<MainCompany> {
  // Normalize slug defensively before validation
  const normalizedData = {
    ...data,
    slug:
      typeof data.slug === "string"
        ? data.slug.trim().toLowerCase()
        : data.slug,
  };

  if (normalizedData.slug !== undefined && !validateSlug(normalizedData.slug)) {
    throw Object.assign(new Error("Invalid slug format"), {
      statusCode: 400,
      field: "slug",
    });
  }

  const pool = getPool();

  // Verify exists
  const existsCheck = await pool.query(
    "SELECT id FROM main_companies WHERE id = $1 AND deleted_at IS NULL",
    [mainCompanyId],
  );
  if (existsCheck.rows.length === 0) {
    throw Object.assign(new Error("Main company not found"), {
      statusCode: 404,
    });
  }

  // Slug uniqueness check (excluding self)
  if (normalizedData.slug !== undefined) {
    const slugCheck = await pool.query(
      "SELECT id FROM main_companies WHERE slug = $1 AND id != $2 AND deleted_at IS NULL",
      [normalizedData.slug, mainCompanyId],
    );
    if (slugCheck.rows.length > 0) {
      throw Object.assign(
        new Error(`Slug '${normalizedData.slug}' sudah digunakan oleh main company lain.`),
        { statusCode: 409, code: "SLUG_CONFLICT", field: "slug" },
      );
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (normalizedData.name !== undefined) { fields.push(`name = $${idx++}`); values.push(normalizedData.name); }
  if (normalizedData.slug !== undefined) { fields.push(`slug = $${idx++}`); values.push(normalizedData.slug); }
  if (normalizedData.address !== undefined) { fields.push(`address = $${idx++}`); values.push(normalizedData.address); }
  if (normalizedData.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(normalizedData.phone); }

  if (fields.length === 0) {
    throw Object.assign(new Error("No fields to update"), { statusCode: 400 });
  }

  fields.push(`updated_at = NOW()`);
  values.push(mainCompanyId);

  const result = await pool.query(
    `UPDATE main_companies SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING id, name, slug, address, phone, status, created_at, updated_at`,
    values,
  );

  return result.rows[0] as MainCompany;
}

/**
 * Suspends a parent gym organization (soft delete: sets status + deleted_at).
 * Does NOT hard delete — company_branches rows are preserved.
 */
export async function suspendMainCompany(
  mainCompanyId: string,
): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE main_companies
     SET status = 'suspended', deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [mainCompanyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(
      new Error("Main company not found or already suspended"),
      { statusCode: 404 },
    );
  }
}

// ─── Branch Management ────────────────────────────────────────────────────────

/**
 * Creates a new branch atomically:
 * 1. INSERT INTO companies (operational unit)
 * 2. INSERT INTO company_branches (metadata/link)
 *
 * Returns companyId = companies.id — the ID used by MQTT, sessions, devices, etc.
 */
export async function createBranch(
  mainCompanyId: string,
  input: CreateBranchInput,
): Promise<BranchResult> {
  if (!input.name?.trim()) {
    throw Object.assign(new Error("name is required"), {
      statusCode: 400,
      field: "name",
    });
  }
  // Normalize slug defensively — safe even when called outside HTTP routes
  const slug =
    typeof input.slug === "string"
      ? input.slug.trim().toLowerCase()
      : input.slug;
  if (!validateSlug(slug)) {
    throw Object.assign(new Error("Invalid slug format"), {
      statusCode: 400,
      field: "slug",
    });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Verify main_company exists
    const mainCheck = await client.query(
      "SELECT id FROM main_companies WHERE id = $1 AND deleted_at IS NULL",
      [mainCompanyId],
    );
    if (mainCheck.rows.length === 0) {
      throw Object.assign(new Error("Main company not found"), {
        statusCode: 404,
      });
    }

    // 2. Check slug uniqueness in companies table
    const slugCheck = await client.query(
      "SELECT id FROM companies WHERE slug = $1",
      [slug],
    );
    if (slugCheck.rows.length > 0) {
      throw Object.assign(
        new Error(`Slug '${slug}' sudah digunakan oleh company lain.`),
        { statusCode: 409, code: "SLUG_CONFLICT", field: "slug" },
      );
    }

    // 3. Insert into companies (creates the operational unit)
    const companyResult = await client.query(
      `INSERT INTO companies (name, slug, address, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, address, phone, status`,
      [
        input.name.trim(),
        slug,
        input.address ?? null,
        input.phone ?? null,
      ],
    );
    const company = companyResult.rows[0];

    // 4. Insert into company_branches (metadata link)
    const branchResult = await client.query(
      `INSERT INTO company_branches
         (company_id, main_company_id, display_name, contact_person, contact_email, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING display_name, contact_person, contact_email, notes, created_at`,
      [
        company.id,
        mainCompanyId,
        input.display_name ?? null,
        input.contact_person ?? null,
        input.contact_email ?? null,
        input.notes ?? null,
      ],
    );

    await client.query("COMMIT");

    return {
      companyId: company.id, // companies.id — operational ID
      mainCompanyId,
      name: company.name,
      slug: company.slug,
      address: company.address,
      phone: company.phone,
      status: company.status,
      ...branchResult.rows[0],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lists all branches under a parent organization.
 * Excludes companies with deleted_at IS NOT NULL.
 */
export async function listBranches(
  mainCompanyId: string,
): Promise<BranchResult[]> {
  const pool = getPool();

  // Verify main_company exists
  const mainCheck = await pool.query(
    "SELECT id FROM main_companies WHERE id = $1 AND deleted_at IS NULL",
    [mainCompanyId],
  );
  if (mainCheck.rows.length === 0) {
    throw Object.assign(new Error("Main company not found"), {
      statusCode: 404,
    });
  }

  const result = await pool.query(
    `SELECT
       c.id           AS "companyId",
       cb.main_company_id AS "mainCompanyId",
       c.name, c.slug, c.address, c.phone, c.status,
       cb.display_name, cb.contact_person, cb.contact_email, cb.notes,
       cb.created_at
     FROM company_branches cb
     JOIN companies c ON c.id = cb.company_id
     WHERE cb.main_company_id = $1
       AND c.deleted_at IS NULL
     ORDER BY cb.created_at ASC`,
    [mainCompanyId],
  );

  return result.rows as BranchResult[];
}

/**
 * Unlinks a branch from its parent by deleting the company_branches row.
 * The companies row is preserved — the company becomes standalone.
 */
export async function unlinkBranch(
  mainCompanyId: string,
  companyId: string,
): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM company_branches
     WHERE company_id = $1 AND main_company_id = $2
     RETURNING company_id`,
    [companyId, mainCompanyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(
      new Error("Branch not found for this main company"),
      { statusCode: 404 },
    );
  }
}
