import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth.middleware";
import { rbacMiddleware } from "../middleware/rbac.middleware";
import { tenantMiddleware } from "../middleware/tenant.middleware";
import * as AssetService from "../services/asset.service";

const router = Router({ mergeParams: true });

// Fix 2: Whitelist of allowed asset types — validated before any filesystem operation.
const ALLOWED_ASSET_TYPES = [
  "profile_photo",
  "workout_image",
  "workout_video",
  "club_banner",
] as const;

// Fix 3: MIME-type + extension whitelist validated in fileFilter BEFORE file hits disk.
const ALLOWED_MIME_EXT: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
};

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedExts = ALLOWED_MIME_EXT[file.mimetype];
  if (!allowedExts) {
    return cb(
      new Error(
        `File type not allowed. Accepted: JPEG, PNG, WebP, MP4. Got MIME: ${file.mimetype}`,
      ),
    );
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return cb(
      new Error(
        `File extension "${ext}" does not match MIME type "${file.mimetype}"`,
      ),
    );
  }
  cb(null, true);
};

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const companyId = req.params.companyId;
    // Fix 2 (revised): Read type from query param — always available before body parsing,
    // so not susceptible to multipart/form-data field ordering issues.
    const assetType = req.query.type as string | undefined;

    // Validate asset type against whitelist BEFORE building any path.
    if (!assetType || !ALLOWED_ASSET_TYPES.includes(assetType as (typeof ALLOWED_ASSET_TYPES)[number])) {
      return cb(
        new Error(
          `Invalid asset type. Allowed: ${ALLOWED_ASSET_TYPES.join(", ")}`,
        ),
        "",
      );
    }

    const dir = AssetService.ensureUploadDir(companyId, assetType);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max (per-type size checked in service)
});

// Helper: run multer and surface validation errors as HTTP 400 (not 500).
function uploadSingle(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error ? err.message : "File upload failed";
      res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message } });
      return;
    }
    next();
  });
}

/**
 * POST /api/companies/:companyId/assets?type=<asset_type>
 * Upload a new asset (club_owner, trainer).
 * CONSTRAINT: asset type is passed as a query parameter, not a body field,
 * to avoid multipart/form-data field-ordering dependency.
 */
router.post(
  "/:companyId/assets",
  authMiddleware,
  rbacMiddleware("club_owner", "trainer"),
  tenantMiddleware,
  uploadSingle,
  async (req: Request, res: Response) => {
    const { companyId } = req.params;
    // Read type from query param (same source as Multer destination callback).
    const type = req.query.type as string | undefined;
    const { name, published } = req.body;
    const file = req.file;

    if (!file) {
      return res
        .status(400)
        .json({
          error: { code: "VALIDATION_ERROR", message: "File wajib diupload" },
        });
    }
    if (!type || !ALLOWED_ASSET_TYPES.includes(type as (typeof ALLOWED_ASSET_TYPES)[number])) {
      return res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Query parameter ?type wajib diisi. Nilai valid: profile_photo, workout_image, workout_video, club_banner",
          },
        });
    }

    // Type is validated against the whitelist above; cast to the service's union type.
    const validatedType = type as AssetService.AssetType;

    const validation = AssetService.validateAssetFile(
      file.originalname,
      file.size,
      validatedType,
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
        validatedType,
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
