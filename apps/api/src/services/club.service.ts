import { getPool } from "../db/client";

export interface Club {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  status: "active" | "suspended";
  created_at: Date;
}

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

/**
 * Validates that a slug consists entirely of lowercase alphanumeric characters
 * and hyphens, with length between 3 and 50 characters.
 * Requirements: 1.3
 */
export function validateSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

/**
 * Returns all registered clubs.
 * Requirements: 1.4
 */
export async function listClubs(): Promise<Club[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, name, slug, address, phone, status, created_at FROM companies ORDER BY created_at DESC",
  );
  return result.rows as Club[];
}

/**
 * Updates a club's data.
 * Requirements: 1.5
 */
export async function updateClub(
  clubId: string,
  data: Partial<Pick<Club, "name" | "slug" | "address" | "phone">>,
): Promise<Club> {
  const pool = getPool();

  // Validate slug if provided
  if (data.slug !== undefined && !validateSlug(data.slug)) {
    throw Object.assign(new Error("Invalid slug format"), {
      statusCode: 400,
      field: "slug",
    });
  }

  // Check slug uniqueness if slug is being updated
  if (data.slug !== undefined) {
    const slugCheck = await pool.query(
      "SELECT id FROM companies WHERE slug = $1 AND id != $2",
      [data.slug, clubId],
    );
    if (slugCheck.rows.length > 0) {
      throw Object.assign(
        new Error(`Slug '${data.slug}' sudah digunakan oleh club lain.`),
        {
          statusCode: 409,
          code: "SLUG_CONFLICT",
          field: "slug",
        },
      );
    }
  }

  // Build dynamic SET clause
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

  values.push(clubId);
  const result = await pool.query(
    `UPDATE companies SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, slug, address, phone, status, created_at`,
    values,
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Club not found"), { statusCode: 404 });
  }

  return result.rows[0] as Club;
}

/**
 * Suspends a club and sets all its users to inactive.
 * Requirements: 1.6
 */
export async function suspendClub(clubId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Suspend the club
    const clubResult = await client.query(
      "UPDATE companies SET status = 'suspended' WHERE id = $1 RETURNING id",
      [clubId],
    );

    if (clubResult.rows.length === 0) {
      throw Object.assign(new Error("Club not found"), { statusCode: 404 });
    }

    // Revoke access for all users in the club
    await client.query(
      "UPDATE users SET status = 'inactive' WHERE company_id = $1",
      [clubId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

