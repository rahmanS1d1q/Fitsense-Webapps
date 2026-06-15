/**
 * Device routes — company devices and user (individual) devices.
 */
import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as DeviceService from "../services/device.service";

const router = Router({ mergeParams: true });

// ─── Company Devices ──────────────────────────────────────────────────────────

/**
 * POST /api/companies/:companyId/devices/company
 */
router.post(
  "/:companyId/devices/company",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const registeredBy = req.user!.userId;
    try {
      const device = await DeviceService.createCompanyDevice(
        companyId,
        registeredBy,
        req.body,
      );
      return res.status(201).json({ device });
    } catch (err: unknown) {
      const e = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
      if (e.statusCode === 409)
        return res
          .status(409)
          .json({
            error: {
              code: e.code ?? "CONFLICT",
              message: e.message,
              field: e.field,
            },
          });
      if (e.statusCode === 400)
        return res
          .status(400)
          .json({
            error: {
              code: e.code ?? "VALIDATION_ERROR",
              message: e.message,
              field: e.field,
            },
          });
      console.error("[devices] createCompanyDevice:", e.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/devices/company
 */
router.get(
  "/:companyId/devices/company",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const status = req.query.status as DeviceService.DeviceStatus | undefined;
    try {
      const devices = await DeviceService.listCompanyDevices(companyId, status);
      return res.json({ devices });
    } catch (err: unknown) {
      console.error("[devices] listCompanyDevices:", (err as Error).message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/devices/company/:deviceId
 */
router.get(
  "/:companyId/devices/company/:deviceId",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, deviceId } = req.params;
    try {
      const device = await DeviceService.getCompanyDevice(companyId, deviceId);
      return res.json({ device });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: e.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * PATCH /api/companies/:companyId/devices/company/:deviceId — update name/notes/assigned_to
 */
router.patch(
  "/:companyId/devices/company/:deviceId",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, deviceId } = req.params;
    const { name, notes, assigned_to } = req.body;
    try {
      const device = await DeviceService.updateCompanyDevice(
        companyId,
        deviceId,
        { name, notes, assigned_to },
      );
      return res.json({ device });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: e.message } });
      if (e.statusCode === 400)
        return res
          .status(400)
          .json({ error: { code: "VALIDATION_ERROR", message: e.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * PATCH /api/companies/:companyId/devices/company/:deviceId/status — manual status update
 */
router.patch(
  "/:companyId/devices/company/:deviceId/status",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, deviceId } = req.params;
    const { status, notes } = req.body;
    if (!["available", "maintenance", "lost"].includes(status)) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Status borrowed hanya bisa di-set oleh sistem. Pilihan: available, maintenance, lost",
          },
        });
    }
    try {
      const device = await DeviceService.updateDeviceStatus(
        companyId,
        deviceId,
        status,
        notes,
      );
      return res.json({ device });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: e.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * DELETE /api/companies/:companyId/devices/company/:deviceId
 */
router.delete(
  "/:companyId/devices/company/:deviceId",
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, deviceId } = req.params;
    try {
      await DeviceService.deleteDevice(companyId, deviceId);
      return res.json({ message: "Device berhasil dihapus" });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; code?: string; message?: string };
      if (e.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: e.message } });
      if (e.statusCode === 409)
        return res
          .status(409)
          .json({ error: { code: e.code ?? "CONFLICT", message: e.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

// ─── User (Individual) Devices ────────────────────────────────────────────────

/**
 * POST /api/companies/:companyId/members/:userId/devices
 */
router.post(
  "/:companyId/members/:userId/devices",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const user = req.user!;
    if (user.role === "member" && user.userId !== userId) {
      return res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message: "Member hanya dapat mendaftarkan device miliknya sendiri",
          },
        });
    }
    try {
      const device = await DeviceService.createUserDevice(
        companyId,
        userId,
        user.userId,
        req.body,
      );
      return res.status(201).json({ device });
    } catch (err: unknown) {
      const e = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
      if (e.statusCode === 409)
        return res
          .status(409)
          .json({
            error: {
              code: e.code ?? "CONFLICT",
              message: e.message,
              field: e.field,
            },
          });
      if (e.statusCode === 400)
        return res
          .status(400)
          .json({
            error: {
              code: e.code ?? "VALIDATION_ERROR",
              message: e.message,
              field: e.field,
            },
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
 * GET /api/companies/:companyId/members/:userId/devices
 */
router.get(
  "/:companyId/members/:userId/devices",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const user = req.user!;
    if (user.role === "member" && user.userId !== userId) {
      return res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message: "Member hanya dapat melihat device miliknya sendiri",
          },
        });
    }
    try {
      const devices = await DeviceService.listUserDevices(userId, companyId);
      return res.json({ devices });
    } catch (err: unknown) {
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * DELETE /api/companies/:companyId/members/:userId/devices/:deviceId
 */
router.delete(
  "/:companyId/members/:userId/devices/:deviceId",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, userId, deviceId } = req.params;
    const user = req.user!;
    if (user.role === "member" && user.userId !== userId) {
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "Akses ditolak" } });
    }
    try {
      await DeviceService.deleteUserDevice(deviceId, userId, companyId);
      return res.json({ message: "Device berhasil dihapus" });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: e.message } });
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

export default router;
