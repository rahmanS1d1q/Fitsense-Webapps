import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import * as ClubService from "../services/club.service";

const router = Router();

/**
 * GET /api/clubs
 * List all clubs (super_admin only)
 * Requirements: 1.4, 1.7
 */
router.get(
  "/",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (_req: Request, res: Response) => {
    try {
      const clubs = await ClubService.listClubs();
      return res.json({ clubs });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[clubs] listClubs error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * PATCH /api/clubs/:companyId
 * Update a club (super_admin only)
 * Requirements: 1.5, 1.7
 */
router.patch(
  "/:companyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { name, slug, address, phone } = req.body;

    try {
      const club = await ClubService.updateClub(companyId, {
        name,
        slug,
        address,
        phone,
      });
      return res.json({ club });
    } catch (err: unknown) {
      const error = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: error.message },
        });
      }
      if (error.statusCode === 409) {
        return res.status(409).json({
          error: {
            code: error.code ?? "CONFLICT",
            message: error.message,
            field: error.field,
          },
        });
      }
      if (error.statusCode === 400) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
            field: error.field,
          },
        });
      }
      console.error("[clubs] updateClub error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * DELETE /api/clubs/:companyId
 * Suspend a club and revoke all user access (super_admin only)
 * Requirements: 1.6, 1.7
 */
router.delete(
  "/:companyId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { companyId } = req.params;

    try {
      await ClubService.suspendClub(companyId);
      return res.json({ message: "Club suspended successfully" });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: error.message },
        });
      }
      console.error("[clubs] suspendClub error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;

