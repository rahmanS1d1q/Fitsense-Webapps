import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as MemberService from "../services/member.service";
import * as DeviceService from "../services/device.service";

const router = Router({ mergeParams: true });

/**
 * POST /api/clubs/:clubId/members
 * Create a new member (club_owner only)
 * Requirements: 3.1, 3.2
 */
router.post(
  "/:clubId/members",
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { clubId } = req.params;
    const { name, email, password, age, gender, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "name, email, dan password wajib diisi",
        },
      });
    }

    try {
      const member = await MemberService.createMember(clubId, {
        name,
        email,
        password,
        age,
        gender,
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
      if (error.statusCode === 409) {
        return res.status(409).json({
          error: {
            code: error.code ?? "CONFLICT",
            message: error.message,
            field: error.field,
          },
        });
      }
      console.error("[members] createMember error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * GET /api/clubs/:clubId/members
 * List all active members in a club (trainer, club_owner)
 * Requirements: 3.3
 */
router.get(
  "/:clubId/members",
  authMiddleware,
  rbacMiddleware("trainer", "club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { clubId } = req.params;

    try {
      const members = await MemberService.listMembers(clubId);
      return res.json({ members });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[members] listMembers error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * GET /api/clubs/:clubId/members/:userId
 * Get a member profile.
 * - member: own profile only
 * - trainer, club_owner: any member in their club
 * Requirements: 3.4
 */
router.get(
  "/:clubId/members/:userId",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { clubId, userId } = req.params;
    const user = req.user!;

    // member can only view their own profile
    if (user.role === "member" && user.userId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Member hanya dapat melihat profil dirinya sendiri",
        },
      });
    }

    // trainer and club_owner can view any member in their club (already enforced by tenantMiddleware)
    if (
      user.role !== "member" &&
      user.role !== "trainer" &&
      user.role !== "club_owner" &&
      user.role !== "super_admin"
    ) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    }

    try {
      const member = await MemberService.getMember(clubId, userId);
      return res.json({ member });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: error.message },
        });
      }
      console.error("[members] getMember error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * PATCH /api/clubs/:clubId/members/:userId
 * Update a member (club_owner only)
 * Requirements: 3.5
 */
router.patch(
  "/:clubId/members/:userId",
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { clubId, userId } = req.params;
    const { name, age, gender } = req.body;

    try {
      const member = await MemberService.updateMember(clubId, userId, {
        name,
        age,
        gender,
      });
      return res.json({ member });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: error.message },
        });
      }
      if (error.statusCode === 400) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: error.message },
        });
      }
      console.error("[members] updateMember error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * DELETE /api/clubs/:clubId/members/:userId
 * Deactivate a member and revoke all tokens (club_owner only)
 * Requirements: 3.6
 */
router.delete(
  "/:clubId/members/:userId",
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { clubId, userId } = req.params;

    try {
      await MemberService.deactivateMember(clubId, userId);
      return res.json({ message: "Member berhasil dinonaktifkan" });
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: error.message },
        });
      }
      console.error("[members] deactivateMember error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * POST /api/clubs/:clubId/members/:userId/devices
 * Register a device for a member (member: own only)
 * Requirements: 4.1, 4.2, 4.3
 */
router.post(
  "/:clubId/members/:userId/devices",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { clubId, userId } = req.params;
    const user = req.user!;

    // member can only register devices for themselves
    if (user.role === "member" && user.userId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message:
            "Member hanya dapat mendaftarkan perangkat untuk dirinya sendiri",
        },
      });
    }

    const { device_type, mac_address } = req.body;

    if (!device_type || !mac_address) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "device_type dan mac_address wajib diisi",
        },
      });
    }

    try {
      const device = await DeviceService.registerDevice(userId, clubId, {
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
      if (error.statusCode === 400) {
        return res.status(400).json({
          error: {
            code: error.code ?? "VALIDATION_ERROR",
            message: error.message,
            field: error.field,
          },
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
      console.error("[devices] registerDevice error:", error.message);
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

/**
 * GET /api/clubs/:clubId/members/:userId/devices
 * List devices for a member (member: own, trainer/club_owner: any)
 * Requirements: 4.1
 */
router.get(
  "/:clubId/members/:userId/devices",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const user = req.user!;

    // member can only list their own devices
    if (user.role === "member" && user.userId !== userId) {
      return res.status(403).json({
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
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
    }
  },
);

export default router;
