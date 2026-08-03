/**
 * Main company routes — manages parent gym organizations and branch links.
 * All endpoints are super_admin only.
 *
 * Mount: /api/main-companies
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import * as MainCompanyService from "../services/main-company.service";

const router = Router();

// ─── Helper: standard error mapper ───────────────────────────────────────────

function handleError(res: Response, err: unknown, context: string): Response {
  const error = err as {
    statusCode?: number;
    code?: string;
    message?: string;
    field?: string;
  };
  if (error.statusCode === 400)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
        field: error.field,
      },
    });
  if (error.statusCode === 404)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: error.message } });
  if (error.statusCode === 409)
    return res.status(409).json({
      error: {
        code: error.code ?? "CONFLICT",
        message: error.message,
        field: error.field,
      },
    });
  console.error(`[main-companies] ${context} error:`, error.message);
  return res
    .status(500)
    .json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}

// ─── POST /api/main-companies ─────────────────────────────────────────────────

/**
 * Create a parent gym organization.
 * Auth: super_admin
 */
router.post(
  "/",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { name, address, phone } = req.body;
    const slug = typeof req.body.slug === "string"
      ? req.body.slug.trim().toLowerCase()
      : req.body.slug;
    try {
      const mainCompany = await MainCompanyService.createMainCompany({
        name,
        slug,
        address,
        phone,
      });
      return res.status(201).json({ mainCompany });
    } catch (err) {
      return handleError(res, err, "createMainCompany");
    }
  },
);

// ─── GET /api/main-companies ──────────────────────────────────────────────────

/**
 * List all parent gym organizations (excludes suspended/deleted).
 * Auth: super_admin
 */
router.get(
  "/",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const mainCompanies = await MainCompanyService.listMainCompanies();
      return res.json({ mainCompanies });
    } catch (err) {
      return handleError(res, err, "listMainCompanies");
    }
  },
);

// ─── GET /api/main-companies/:mainCompanyId ───────────────────────────────────

/**
 * Get a single parent gym organization.
 * Auth: super_admin
 */
router.get(
  "/:mainCompanyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { mainCompanyId } = req.params;
    try {
      const mainCompany = await MainCompanyService.getMainCompany(mainCompanyId);
      return res.json({ mainCompany });
    } catch (err) {
      return handleError(res, err, "getMainCompany");
    }
  },
);

// ─── PATCH /api/main-companies/:mainCompanyId ─────────────────────────────────

/**
 * Update a parent gym organization (partial update).
 * Auth: super_admin
 */
router.patch(
  "/:mainCompanyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { mainCompanyId } = req.params;
    const { name, address, phone } = req.body;
    const slug = typeof req.body.slug === "string"
      ? req.body.slug.trim().toLowerCase()
      : req.body.slug;
    try {
      const mainCompany = await MainCompanyService.updateMainCompany(
        mainCompanyId,
        { name, slug, address, phone },
      );
      return res.json({ mainCompany });
    } catch (err) {
      return handleError(res, err, "updateMainCompany");
    }
  },
);

// ─── DELETE /api/main-companies/:mainCompanyId ────────────────────────────────

/**
 * Suspend (soft delete) a parent gym organization.
 * Does NOT hard delete. company_branches rows are preserved.
 * Auth: super_admin
 */
router.delete(
  "/:mainCompanyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { mainCompanyId } = req.params;
    try {
      await MainCompanyService.suspendMainCompany(mainCompanyId);
      return res.json({ message: "Main company suspended successfully" });
    } catch (err) {
      return handleError(res, err, "suspendMainCompany");
    }
  },
);

// ─── POST /api/main-companies/:mainCompanyId/branches ─────────────────────────

/**
 * Create a new branch under a parent organization.
 * Atomically inserts into companies + company_branches.
 * Response includes companyId = companies.id (the operational ID).
 * Auth: super_admin
 */
router.post(
  "/:mainCompanyId/branches",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { mainCompanyId } = req.params;
    const {
      name,
      address,
      phone,
      display_name,
      contact_person,
      contact_email,
      notes,
    } = req.body;
    const slug = typeof req.body.slug === "string"
      ? req.body.slug.trim().toLowerCase()
      : req.body.slug;
    try {
      const branch = await MainCompanyService.createBranch(mainCompanyId, {
        name,
        slug,
        address,
        phone,
        display_name,
        contact_person,
        contact_email,
        notes,
      });
      return res.status(201).json({ branch });
    } catch (err) {
      return handleError(res, err, "createBranch");
    }
  },
);

// ─── GET /api/main-companies/:mainCompanyId/branches ──────────────────────────

/**
 * List all branch companies under a parent organization.
 * Auth: super_admin
 */
router.get(
  "/:mainCompanyId/branches",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { mainCompanyId } = req.params;
    try {
      const branches = await MainCompanyService.listBranches(mainCompanyId);
      return res.json({ branches });
    } catch (err) {
      return handleError(res, err, "listBranches");
    }
  },
);

// ─── DELETE /api/main-companies/:mainCompanyId/branches/:companyId ────────────

/**
 * Unlink a branch from its parent by removing the company_branches row.
 * The companies row is NOT deleted — the company becomes standalone.
 * Auth: super_admin
 */
router.delete(
  "/:mainCompanyId/branches/:companyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { mainCompanyId, companyId } = req.params;
    try {
      await MainCompanyService.unlinkBranch(mainCompanyId, companyId);
      return res.json({ message: "Branch unlinked successfully" });
    } catch (err) {
      return handleError(res, err, "unlinkBranch");
    }
  },
);

export default router;
