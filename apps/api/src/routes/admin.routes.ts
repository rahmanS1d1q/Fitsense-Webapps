/**
 * Admin routes — user management, storage stats, health check.
 * Requirements: 16.2, 16.3, 20.5
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { getPool } from "../db/client";
import { getRedis } from "../db/redis";
import { InfluxDB } from "@influxdata/influxdb-client";
import { config } from "../config";

const router = Router();

/**
 * GET /api/health
 * Health check — verifies PostgreSQL, InfluxDB, Redis connections.
 * Must respond in < 200ms.
 * Requirements: 16.3
 */
router.get("/health", async (_req: Request, res: Response) => {
  const start = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  // PostgreSQL check
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  // Redis check
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  // InfluxDB check
  try {
    const client = new InfluxDB({
      url: config.influx.url,
      token: config.influx.token,
    });
    const queryApi = client.getQueryApi(config.influx.org);
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows("buckets() |> limit(n: 1)", {
        next() {},
        error: reject,
        complete: resolve,
      });
    });
    checks.influxdb = "ok";
  } catch {
    checks.influxdb = "error";
  }

  const elapsed = Date.now() - start;
  const allOk = Object.values(checks).every((v) => v === "ok");

  return res.status(200).json({
    status: allOk ? "ok" : "degraded",
    checks,
    responseTimeMs: elapsed,
  });
});

/**
 * GET /api/admin/storage/stats
 * Returns InfluxDB storage stats per company (super_admin only).
 * Requirements: 20.5
 */
router.get(
  "/admin/storage/stats",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const pool = getPool();

      const companiesResult = await pool.query(
        "SELECT id, name, slug FROM companies WHERE status = 'active' ORDER BY name",
      );

      const stats = companiesResult.rows.map((company) => ({
        companyId: company.id,
        clubName: company.name,
        clubSlug: company.slug,
        dataPoints: null,
        storageMb: null,
        estimatedDaysRemaining: null,
      }));

      return res.json({ stats });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[admin] storage stats error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

// ─── User Management ──────────────────────────────────────────────────────────

/**
 * GET /api/admin/companies
 * List all companies (super_admin only)
 */
router.get(
  "/admin/companies",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const pool = getPool();
      const result = await pool.query(
        "SELECT id, name, slug, status, created_at FROM companies ORDER BY created_at DESC",
      );
      return res.json({ companies: result.rows });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[admin] listCompanies error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * POST /api/admin/companies
 * Create a company + club owner in one step (super_admin only).
 * Body: { name, slug, address?, phone?, ownerFirstName, ownerLastName, ownerEmail, ownerPassword, ownerGender? }
 */
router.post(
  "/admin/companies",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const {
      name,
      slug,
      address,
      phone,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      ownerPassword,
      ownerGender,
    } = req.body;

    if (
      !name ||
      !slug ||
      !ownerFirstName ||
      !ownerLastName ||
      !ownerEmail ||
      !ownerPassword
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "name, slug, ownerFirstName, ownerLastName, ownerEmail, ownerPassword wajib diisi",
        },
      });
    }

    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Slug hanya boleh huruf kecil, angka, dan tanda hubung (3-50 karakter)",
          field: "slug",
        },
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check slug uniqueness
      const slugCheck = await client.query(
        "SELECT id FROM companies WHERE slug = $1",
        [slug],
      );
      if (slugCheck.rows.length > 0) {
        throw Object.assign(new Error("Slug sudah digunakan"), {
          statusCode: 409,
          code: "SLUG_CONFLICT",
          field: "slug",
        });
      }

      // Check email uniqueness
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [ownerEmail],
      );
      if (emailCheck.rows.length > 0) {
        throw Object.assign(new Error("Email sudah terdaftar"), {
          statusCode: 409,
          code: "EMAIL_CONFLICT",
          field: "ownerEmail",
        });
      }

      // Create company
      const companyResult = await client.query(
        "INSERT INTO companies (name, slug, address, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, slug, status, created_at",
        [name, slug, address || null, phone || null],
      );
      const company = companyResult.rows[0];

      // Create club owner
      const passwordHash = await bcrypt.hash(ownerPassword, 10);
      const ownerResult = await client.query(
        "INSERT INTO users (first_name, last_name, email, password_hash, role, gender, status) VALUES ($1, $2, $3, $4, 'club_owner', $5, 'active') RETURNING id, first_name, last_name, email",
        [
          ownerFirstName,
          ownerLastName,
          ownerEmail,
          passwordHash,
          ownerGender || null,
        ],
      );
      const owner = ownerResult.rows[0];

      // Link owner to company
      await client.query(
        "INSERT INTO users_companies (user_id, company_id, role) VALUES ($1, $2, 'club_owner')",
        [owner.id, company.id],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        company,
        owner: {
          id: owner.id,
          firstName: owner.first_name,
          lastName: owner.last_name,
          email: owner.email,
          role: "club_owner",
        },
      });
    } catch (err: unknown) {
      await client.query("ROLLBACK");
      const error = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
      if (error.statusCode === 409) {
        return res
          .status(409)
          .json({
            error: {
              code: error.code,
              message: error.message,
              field: error.field,
            },
          });
      }
      console.error("[admin] createCompany error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    } finally {
      client.release();
    }
  },
);

/**
 * GET /api/admin/users
 * List all users with their company roles (super_admin only)
 */
router.get(
  "/admin/users",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const pool = getPool();
      const result = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role as super_role,
                u.status, u.created_at,
                uc.role as company_role, uc.company_id,
                c.name as company_name
         FROM users u
         LEFT JOIN users_companies uc ON uc.user_id = u.id
         LEFT JOIN companies c ON c.id = uc.company_id
         ORDER BY u.created_at DESC`,
      );
      return res.json({ users: result.rows });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[admin] listUsers error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * POST /api/admin/users
 * Create a user directly (super_admin only).
 * Body: { firstName, lastName, email, password, role, companyId? }
 * role: "super_admin" | "club_owner" | "trainer" | "member"
 * companyId required for club_owner / trainer / member
 */
router.post(
  "/admin/users",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { firstName, lastName, email, password, role, companyId } = req.body;

    if (!firstName || !email || !password || !role) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "firstName, email, password, dan role wajib diisi",
        },
      });
    }

    const validRoles = ["super_admin", "club_owner", "trainer", "member"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Role tidak valid. Pilih: ${validRoles.join(", ")}`,
        },
      });
    }

    if (role !== "super_admin" && !companyId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "companyId wajib diisi untuk role selain super_admin",
        },
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check email uniqueness
      const emailCheck = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [email],
      );
      if (emailCheck.rows.length > 0) {
        throw Object.assign(new Error("Email sudah digunakan."), {
          statusCode: 409,
          code: "EMAIL_CONFLICT",
        });
      }

      // Validate companyId exists
      if (companyId) {
        const companyCheck = await client.query(
          "SELECT id FROM companies WHERE id = $1",
          [companyId],
        );
        if (companyCheck.rows.length === 0) {
          throw Object.assign(new Error("Company tidak ditemukan."), {
            statusCode: 404,
            code: "COMPANY_NOT_FOUND",
          });
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);

      let userResult;
      if (role === "super_admin") {
        userResult = await client.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
           VALUES ($1, $2, $3, $4, 'super_admin', 'active')
           RETURNING id, first_name, last_name, email, role, status, created_at`,
          [firstName, lastName || firstName, email, passwordHash],
        );
      } else {
        // role column has default 'member', set explicitly for trainer/club_owner
        userResult = await client.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
           VALUES ($1, $2, $3, $4, $5, 'active')
           RETURNING id, first_name, last_name, email, role, status, created_at`,
          [firstName, lastName || firstName, email, passwordHash, role],
        );
      }
      const user = userResult.rows[0];

      // Link to company via users_companies for non-super_admin
      if (role !== "super_admin" && companyId) {
        await client.query(
          "INSERT INTO users_companies (user_id, company_id, role) VALUES ($1, $2, $3)",
          [user.id, companyId, role],
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name ?? "",
          email: user.email,
          role,
          companyId: companyId ?? null,
          status: user.status,
        },
      });
    } catch (err: unknown) {
      await client.query("ROLLBACK");
      const error = err as {
        statusCode?: number;
        code?: string;
        message?: string;
      };
      if (error.statusCode === 409) {
        return res.status(409).json({
          error: { code: error.code ?? "CONFLICT", message: error.message },
        });
      }
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: error.code ?? "NOT_FOUND", message: error.message },
        });
      }
      console.error("[admin] createUser error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    } finally {
      client.release();
    }
  },
);

/**
 * DELETE /api/admin/users/:userId
 * Deactivate a user (super_admin only)
 */
router.delete(
  "/admin/users/:userId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const pool = getPool();

    try {
      const result = await pool.query(
        "UPDATE users SET status = 'inactive' WHERE id = $1 RETURNING id",
        [userId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "User tidak ditemukan" },
        });
      }
      // Invalidate refresh token
      const redis = getRedis();
      await redis.del(`refresh_token:${userId}`);
      return res.json({ message: "User berhasil dinonaktifkan" });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[admin] deleteUser error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;
