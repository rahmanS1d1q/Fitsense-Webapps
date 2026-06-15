import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as InviteService from "../services/invite.service";

const router = Router();

/**
 * POST /api/clubs/:companyId/invite
 * Generate an invite code for a club.
 * Auth: trainer or club_owner, tenant-scoped.
 * Requirements: 18.1
 */
router.post(
  "/:companyId/invite",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const createdBy = req.user!.userId;

    try {
      const result = await InviteService.generateInvite(companyId, createdBy);
      return res.status(201).json(result);
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      console.error("[invite] generateInvite error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;

