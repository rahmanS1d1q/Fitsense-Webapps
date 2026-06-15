/**
 * Session routes
 * Requirements: 10.1, 10.2, 10.3, 10.5, 10.6
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as SessionService from "../services/session.service";

const router = Router();

/**
 * POST /api/sessions/start
 * Requirements: 10.1, 10.2
 */
router.post("/start", authMiddleware, async (req: Request, res: Response) => {
  const { userId, companyId } = req.user!;
  const { workout_id, mood } = req.body;
  if (!companyId) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "companyId required" },
    });
  }

  try {
    const session = await SessionService.startSession(
      userId,
      companyId,
      workout_id,
      mood,
    );
    return res.status(201).json({ session });
  } catch (err: unknown) {
    const error = err as {
      statusCode?: number;
      code?: string;
      message?: string;
      activeSessionId?: string;
    };
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: {
          code: error.code ?? "SESSION_CONFLICT",
          message: error.message,
        },
        activeSessionId: error.activeSessionId,
      });
    }
    console.error("[sessions] startSession error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * POST /api/sessions/end
 * Requirements: 10.3, 10.4
 */
router.post("/end", authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.user!;
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "sessionId required" },
    });
  }

  try {
    const session = await SessionService.endSession(sessionId, userId);
    return res.json({ session });
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    if (error.statusCode === 404) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: error.message } });
    }
    console.error("[sessions] endSession error:", error.message);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
});

/**
 * GET /api/companies/:companyId/sessions/active
 * Returns all active sessions (ended_at IS NULL) for live monitoring.
 * Access: trainer, club_owner
 */
router.get(
  "/:companyId/sessions/active",
  authMiddleware,
  rbacMiddleware("trainer", "club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    try {
      const sessions = await SessionService.listActiveSessions(companyId);
      return res.json({ sessions });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[sessions] listActiveSessions error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * GET /api/clubs/:companyId/members/:userId/sessions
 * Requirements: 10.5
 */
router.get(
  "/:companyId/members/:userId/sessions",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    try {
      const sessions = await SessionService.listSessions(companyId, userId);
      return res.json({ sessions });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[sessions] listSessions error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * GET /api/clubs/:companyId/members/:userId/sessions/:sessionId
 * Requirements: 10.6
 */
router.get(
  "/:companyId/members/:userId/sessions/:sessionId",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId, sessionId } = req.params;
    try {
      const session = await SessionService.getSession(
        companyId,
        userId,
        sessionId,
      );
      return res.json({ session });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404) {
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      }
      console.error("[sessions] getSession error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;
