/**
 * Company routes (renamed from clubs.routes.ts)
 * Requirements: 1.4, 1.5, 1.6, 1.7
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import * as CompanyService from "../services/company.service";

const router = Router();

/**
 * GET /api/companies
 * List all companies (super_admin only)
 */
router.get(
  "/",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const companies = await CompanyService.listCompanies();
      return res.json({ companies });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[companies] listCompanies error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * PATCH /api/companies/:companyId
 * Update a company (super_admin only)
 */
router.patch(
  "/:companyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { name, slug, address, phone } = req.body;

    try {
      const company = await CompanyService.updateCompany(companyId, {
        name,
        slug,
        address,
        phone,
      });
      return res.json({ company });
    } catch (err: unknown) {
      const error = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      if (error.statusCode === 409)
        return res
          .status(409)
          .json({
            error: {
              code: error.code ?? "CONFLICT",
              message: error.message,
              field: error.field,
            },
          });
      if (error.statusCode === 400)
        return res
          .status(400)
          .json({
            error: {
              code: "VALIDATION_ERROR",
              message: error.message,
              field: error.field,
            },
          });
      console.error("[companies] updateCompany error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * DELETE /api/companies/:companyId
 * Suspend a company (super_admin only)
 */
router.delete(
  "/:companyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { companyId } = req.params;

    try {
      await CompanyService.suspendCompany(companyId);
      return res.json({ message: "Company suspended successfully" });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      console.error("[companies] suspendCompany error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

export default router;

