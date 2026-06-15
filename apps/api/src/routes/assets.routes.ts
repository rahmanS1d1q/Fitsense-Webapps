import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as AssetService from "../services/asset.service";

const router = Router({ mergeParams: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const companyId = req.params.companyId;
    const assetType = req.body.type || "workout_image";
    const dir = AssetService.ensureUploadDir(companyId, assetType);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max (validated per type in service)
});

/**
 * POST /api/companies/:companyId/assets
 * Upload a new asset (club_owner, trainer)
 */
router.post(
  "/:companyId/assets",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  upload.single("file"),
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const { type, name, published } = req.body;
    const file = req.file;

    if (!file) {
      return res
        .status(400)
        .json({
          error: { code: "VALIDATION_ERROR", message: "File wajib diupload" },
        });
    }
    if (!type) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "type wajib diisi (profile_photo, workout_image, workout_video, club_banner)",
          },
        });
    }

    const validation = AssetService.validateAssetFile(
      file.originalname,
      file.size,
      type,
    );
    if (!validation.valid) {
      // Delete uploaded file
      const fs = await import("fs");
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      const status = validation.error?.includes("terlalu besar") ? 413 : 400;
      return res
        .status(status)
        .json({
          error: { code: "VALIDATION_ERROR", message: validation.error },
        });
    }

    try {
      const asset = await AssetService.createAsset(
        companyId,
        file,
        type,
        name,
        published === "true",
      );
      return res.status(201).json({ asset });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[assets] upload error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/assets
 */
router.get(
  "/:companyId/assets",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    const type = req.query.type as AssetService.AssetType | undefined;
    try {
      const assets = await AssetService.listAssets(companyId, type);
      return res.json({ assets });
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error("[assets] list error:", error.message);
      return res
        .status(500)
        .json({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
    }
  },
);

/**
 * GET /api/companies/:companyId/assets/:assetId
 */
router.get(
  "/:companyId/assets/:assetId",
  authMiddleware,
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, assetId } = req.params;
    try {
      const asset = await AssetService.getAsset(companyId, assetId);
      return res.json({ asset });
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
 * DELETE /api/companies/:companyId/assets/:assetId
 */
router.delete(
  "/:companyId/assets/:assetId",
  authMiddleware,
  rbacMiddleware("club_owner"),
  tenantMiddleware,
  async (req: Request, res: Response) => {
    const { companyId, assetId } = req.params;
    try {
      await AssetService.deleteAsset(companyId, assetId);
      return res.json({ message: "Asset berhasil dihapus" });
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
