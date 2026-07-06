import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import * as auditLogService from "../services/audit-log.service";

const router = Router();

/**
 * GET /api/admin/audit-logs
 * List all audit logs (super_admin only)
 */
router.get(
  "/",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { entityType, entityId, performedBy, action, from, to, limit, offset } = req.query;

    try {
      const logs = await auditLogService.listLogs({
        entityType: entityType as auditLogService.AuditLogEntityType,
        entityId: entityId as string,
        performedBy: performedBy as string,
        action: action as auditLogService.AuditLogAction,
        from: from as string,
        to: to as string,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      return res.json({ logs });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[audit] listLogs error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * GET /api/admin/audit-logs/:entityId
 * List audit logs for a single entity (super_admin only)
 */
router.get(
  "/:entityId",
  authMiddleware,
  rbacMiddleware("super_admin"),
  async (req: Request, res: Response) => {
    const { entityId } = req.params;
    const { limit, offset } = req.query;

    try {
      const logs = await auditLogService.listLogs({
        entityId,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      return res.json({ logs });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[audit] getEntityLogs error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;
