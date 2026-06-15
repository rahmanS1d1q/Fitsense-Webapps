/**
 * HR history routes
 * Requirements: 11.1
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import { queryHRHistory } from "../services/hr-query.service";

const router = Router();

/**
 * GET /api/clubs/:companyId/members/:userId/hr
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
router.get(
  "/:companyId/members/:userId/hr",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const { from, to, interval } = req.query as Record<string, string>;

    if (!from || !to || !interval) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Parameter 'from', 'to', dan 'interval' wajib diisi",
        },
      });
    }

    try {
      const data = await queryHRHistory({ companyId, userId, from, to, interval });
      return res.json({ data });
    } catch (err: unknown) {
      const error = err as {
        statusCode?: number;
        message?: string;
        field?: string;
      };
      if (error.statusCode === 400) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
            field: error.field,
          },
        });
      }
      console.error("[hr] queryHRHistory error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

export default router;

