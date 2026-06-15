import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as MemberService from "../services/member.service";
import * as DeviceService from "../services/device.service";

const router = Router({ mergeParams: true });

// Helper to get companyId from params (supports both :companyId and :companyId for backward compat)
function getCompanyId(req: Request): string {
  return req.params.companyId ?? req.params.companyId ?? "";
}

/**
 * POST /api/companies/:companyId/members  (also /api/clubs/:companyId/members)
 * Create a new member (club_owner only)
 */
router.post(
  ["/:companyId/members", "/:companyId/members"],
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const {
      firstName,
      lastName,
      name,
      email,
      password,
      age,
      gender,
      height,
      weight,
      role,
    } = req.body;

    // Support both firstName/lastName and legacy name field
    const resolvedFirstName =
      firstName ?? (name ? name.split(" ")[0] : undefined);
    const resolvedLastName =
      lastName ?? (name ? name.split(" ").slice(1).join(" ") : undefined);

    if (!resolvedFirstName || !email || !password) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "firstName, email, dan password wajib diisi",
          },
        });
    }

    try {
      const member = await MemberService.createMember(companyId, {
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        email,
        password,
        age,
        gender,
        height,
        weight,
        role,
      });
      return res.status(201).json({ member });
    } catch (err: unknown) {
      const error = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
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
      console.error("[members] createMember error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/members
 */
router.get(
  ["/:companyId/members", "/:companyId/members"],
  authMiddleware,
  rbacMiddleware("trainer", "club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    try {
      const members = await MemberService.listMembers(companyId);
      return res.json({ members });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[members] listMembers error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/members/:userId
 */
router.get(
  ["/:companyId/members/:userId", "/:companyId/members/:userId"],
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const { userId } = req.params;
    const user = req.user!;

    if (user.role === "member" && user.userId !== userId) {
      return res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message: "Member hanya dapat melihat profil dirinya sendiri",
          },
        });
    }

    try {
      const member = await MemberService.getMember(companyId, userId);
      return res.json({ member });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      console.error("[members] getMember error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * PATCH /api/companies/:companyId/members/:userId
 */
router.patch(
  ["/:companyId/members/:userId", "/:companyId/members/:userId"],
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const { userId } = req.params;
    const { firstName, lastName, age, gender, height, weight } = req.body;

    try {
      const member = await MemberService.updateMember(companyId, userId, {
        firstName,
        lastName,
        age,
        gender,
        height,
        weight,
      });
      return res.json({ member });
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
      console.error("[members] updateMember error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * DELETE /api/companies/:companyId/members/:userId
 */
router.delete(
  ["/:companyId/members/:userId", "/:companyId/members/:userId"],
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const { userId } = req.params;

    try {
      await MemberService.deactivateMember(companyId, userId);
      return res.json({ message: "Member berhasil dinonaktifkan" });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404)
        return res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: error.message } });
      console.error("[members] deactivateMember error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * POST /api/companies/:companyId/members/:userId/devices
 */
router.post(
  ["/:companyId/members/:userId/devices", "/:companyId/members/:userId/devices"],
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const companyId = getCompanyId(req);
    const { userId } = req.params;
    const user = req.user!;

    if (user.role === "member" && user.userId !== userId) {
      return res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message:
              "Member hanya dapat mendaftarkan perangkat untuk dirinya sendiri",
          },
        });
    }

    const { device_type, mac_address } = req.body;
    if (!device_type || !mac_address) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "device_type dan mac_address wajib diisi",
          },
        });
    }

    try {
      const device = await DeviceService.registerDevice(userId, companyId, {
        device_type,
        mac_address,
      });
      return res.status(201).json({ device });
    } catch (err: unknown) {
      const error = err as {
        statusCode?: number;
        code?: string;
        message?: string;
        field?: string;
      };
      if (error.statusCode === 400)
        return res
          .status(400)
          .json({
            error: {
              code: error.code ?? "VALIDATION_ERROR",
              message: error.message,
              field: error.field,
            },
          });
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
      console.error("[devices] registerDevice error:", error.message);
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
  ["/:companyId/members/:userId/devices", "/:companyId/members/:userId/devices"],
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const user = req.user!;

    if (user.role === "member" && user.userId !== userId) {
      return res
        .status(403)
        .json({
          error: {
            code: "FORBIDDEN",
            message: "Member hanya dapat melihat perangkat miliknya sendiri",
          },
        });
    }

    try {
      const devices = await DeviceService.listDevices(userId);
      return res.json({ devices });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[devices] listDevices error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

export default router;

