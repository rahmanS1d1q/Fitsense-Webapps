import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as WorkoutService from "../services/workout.service";

const router = Router({ mergeParams: true });

/**
 * POST /api/companies/:companyId/workouts
 */
router.post(
  "/:companyId/workouts",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { name, intro_activities, intro_duration, asset_id } = req.body;

    if (!name || name.trim().length === 0) {
      return res
        .status(400)
        .json({
          error: { code: "VALIDATION_ERROR", message: "name wajib diisi" },
        });
    }
    if (name.length > 255) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "name maksimal 255 karakter",
          },
        });
    }

    try {
      const workout = await WorkoutService.createWorkout(companyId, {
        name: name.trim(),
        intro_activities: intro_activities || undefined,
        intro_duration: intro_duration ? Number(intro_duration) : undefined,
        asset_id: asset_id || undefined,
      });
      return res.status(201).json({ workout });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[workouts] create error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/workouts
 */
router.get(
  "/:companyId/workouts",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    try {
      const workouts = await WorkoutService.listWorkouts(companyId);
      return res.json({ workouts });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[workouts] list error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/workouts/:workoutId
 */
router.get(
  "/:companyId/workouts/:workoutId",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, workoutId } = req.params;
    try {
      const workout = await WorkoutService.getWorkout(companyId, workoutId);
      return res.json({ workout });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * PATCH /api/companies/:companyId/workouts/:workoutId
 */
router.patch(
  "/:companyId/workouts/:workoutId",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, workoutId } = req.params;
    const { name, intro_activities, intro_duration, asset_id } = req.body;

    try {
      const workout = await WorkoutService.updateWorkout(companyId, workoutId, {
        name,
        intro_activities,
        intro_duration,
        asset_id,
      });
      return res.json({ workout });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      if (error.statusCode === 400)
        return res
          .status(400)
          .json({
            error: { code: "VALIDATION_ERROR", message: error.message },
          });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * DELETE /api/companies/:companyId/workouts/:workoutId
 */
router.delete(
  "/:companyId/workouts/:workoutId",
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, workoutId } = req.params;
    try {
      await WorkoutService.deleteWorkout(companyId, workoutId);
      return res.json({ message: "Workout berhasil dihapus" });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

export default router;
