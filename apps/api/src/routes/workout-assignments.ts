/**
 * Workout assignment routes.
 * Trainer/owner assign workout ke member; member lihat jadwal sendiri.
 */

import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as AssignmentService from "../services/workout-assignment.service";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from "../services/workout-assignment.service";

const router = Router({ mergeParams: true });

interface ServiceError {
  statusCode?: number;
  code?: string;
  message?: string;
}

function handleError(res: Response, err: unknown, context: string) {
  const error = err as ServiceError;
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code ?? "ERROR",
        message: error.message ?? "Error",
      },
    });
  }
  console.error(`[assignments] ${context} error:`, error.message);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}

function parseStatus(
  value: unknown,
): AssignmentService.AssignmentStatus | undefined {
  if (value === "pending" || value === "completed" || value === "skipped") {
    return value;
  }
  return undefined;
}

/**
 * POST /api/companies/:companyId/assignments
 * Buat assignment baru. Akses: club_owner, trainer.
 */
router.post(
  "/:companyId/assignments",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const trainerId = req.user!.userId;

    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Data tidak valid",
        },
      });
    }

    try {
      const assignment = await AssignmentService.createAssignment(
        companyId,
        trainerId,
        parsed.data,
      );
      return res.status(201).json({ assignment });
    } catch (err) {
      return handleError(res, err, "createAssignment");
    }
  },
);

/**
 * GET /api/companies/:companyId/assignments
 * List semua assignment company. Akses: club_owner, trainer.
 * Query: ?member_id=&trainer_id=&status=&date=&from=&to=
 */
router.get(
  "/:companyId/assignments",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { member_id, trainer_id, status, date, from, to } = req.query;

    try {
      const assignments = await AssignmentService.listAssignments(companyId, {
        member_id: typeof member_id === "string" ? member_id : undefined,
        trainer_id: typeof trainer_id === "string" ? trainer_id : undefined,
        status: parseStatus(status),
        assigned_date: typeof date === "string" ? date : undefined,
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
      });
      return res.json({ assignments });
    } catch (err) {
      return handleError(res, err, "listAssignments");
    }
  },
);

/**
 * GET /api/companies/:companyId/assignments/:assignmentId
 * Detail assignment. Akses: club_owner, trainer.
 */
router.get(
  "/:companyId/assignments/:assignmentId",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, assignmentId } = req.params;
    try {
      const assignment = await AssignmentService.getAssignment(
        companyId,
        assignmentId,
      );
      return res.json({ assignment });
    } catch (err) {
      return handleError(res, err, "getAssignment");
    }
  },
);

/**
 * PATCH /api/companies/:companyId/assignments/:assignmentId
 * Update assignment. Akses: club_owner, trainer.
 */
router.patch(
  "/:companyId/assignments/:assignmentId",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, assignmentId } = req.params;

    const parsed = updateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Data tidak valid",
        },
      });
    }

    try {
      const assignment = await AssignmentService.updateAssignment(
        assignmentId,
        companyId,
        parsed.data,
      );
      return res.json({ assignment });
    } catch (err) {
      return handleError(res, err, "updateAssignment");
    }
  },
);

/**
 * DELETE /api/companies/:companyId/assignments/:assignmentId
 * Hapus assignment (hanya status pending). Akses: club_owner, trainer.
 */
router.delete(
  "/:companyId/assignments/:assignmentId",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, assignmentId } = req.params;
    try {
      await AssignmentService.deleteAssignment(assignmentId, companyId);
      return res.json({ message: "Assignment berhasil dihapus" });
    } catch (err) {
      return handleError(res, err, "deleteAssignment");
    }
  },
);

/**
 * GET /api/companies/:companyId/members/:userId/assignments
 * List assignment per member. Akses: club_owner, trainer, member (diri sendiri).
 * Query: ?status=&from=&to=
 */
router.get(
  "/:companyId/members/:userId/assignments",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const user = req.user!;
    const { status, from, to } = req.query;

    if (user.role === "member" && user.userId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Member hanya dapat melihat jadwal dirinya sendiri",
        },
      });
    }

    try {
      const assignments = await AssignmentService.listMemberAssignments(
        userId,
        companyId,
        {
          status: parseStatus(status),
          from: typeof from === "string" ? from : undefined,
          to: typeof to === "string" ? to : undefined,
        },
      );
      return res.json({ assignments });
    } catch (err) {
      return handleError(res, err, "listMemberAssignments");
    }
  },
);

/**
 * GET /api/companies/:companyId/members/:userId/assignments/today
 * Assignment pending hari ini untuk member (dipakai mobile app saat start session).
 * Akses: club_owner, trainer, member (diri sendiri).
 */
router.get(
  "/:companyId/members/:userId/assignments/today",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const user = req.user!;

    if (user.role === "member" && user.userId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Member hanya dapat melihat jadwal dirinya sendiri",
        },
      });
    }

    try {
      const assignment = await AssignmentService.getTodayPendingAssignment(
        userId,
        companyId,
      );
      return res.json({ assignment });
    } catch (err) {
      return handleError(res, err, "getTodayPendingAssignment");
    }
  },
);

export default router;
