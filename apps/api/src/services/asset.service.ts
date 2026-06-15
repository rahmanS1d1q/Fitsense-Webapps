import path from "path";
import fs from "fs";
import { getPool } from "../db/client";

export type AssetType =
  | "profile_photo"
  | "workout_video"
  | "workout_image"
  | "club_banner";

export interface Asset {
  id: string;
  company_id: string;
  name: string;
  size: string;
  type: AssetType;
  url: string;
  published: boolean;
  created_at: Date;
  updated_at: Date;
}

const UPLOAD_BASE = path.join(__dirname, "../../uploads");

const ALLOWED_TYPES: Record<
  AssetType,
  { extensions: string[]; maxSize: number }
> = {
  profile_photo: {
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    maxSize: 5 * 1024 * 1024,
  },
  club_banner: {
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    maxSize: 5 * 1024 * 1024,
  },
  workout_image: {
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    maxSize: 10 * 1024 * 1024,
  },
  workout_video: { extensions: [".mp4"], maxSize: 100 * 1024 * 1024 },
};

export function validateAssetFile(
  originalName: string,
  size: number,
  assetType: AssetType,
): { valid: boolean; error?: string } {
  const config = ALLOWED_TYPES[assetType];
  if (!config) return { valid: false, error: "Tipe asset tidak valid" };

  const ext = path.extname(originalName).toLowerCase();
  if (!config.extensions.includes(ext)) {
    return {
      valid: false,
      error: `Ekstensi ${ext} tidak diizinkan untuk ${assetType}. Gunakan: ${config.extensions.join(", ")}`,
    };
  }
  if (size > config.maxSize) {
    return {
      valid: false,
      error: `File terlalu besar. Maksimal ${Math.round(config.maxSize / 1024 / 1024)}MB untuk ${assetType}`,
    };
  }
  return { valid: true };
}

export async function createAsset(
  companyId: string,
  file: { originalname: string; filename: string; size: number; path: string },
  assetType: AssetType,
  name?: string,
  published?: boolean,
): Promise<Asset> {
  const pool = getPool();
  const url = `/uploads/${companyId}/${assetType}/${file.filename}`;
  const displayName = name || file.originalname;
  const sizeStr =
    file.size < 1024 * 1024
      ? `${Math.round(file.size / 1024)}KB`
      : `${(file.size / 1024 / 1024).toFixed(1)}MB`;

  const result = await pool.query(
    `INSERT INTO assets (company_id, name, size, type, url, published)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [companyId, displayName, sizeStr, assetType, url, published ?? false],
  );
  return result.rows[0] as Asset;
}

export async function listAssets(
  companyId: string,
  type?: AssetType,
): Promise<Asset[]> {
  const pool = getPool();
  let query = "SELECT * FROM assets WHERE company_id = $1";
  const params: unknown[] = [companyId];
  if (type) {
    query += " AND type = $2";
    params.push(type);
  }
  query += " ORDER BY created_at DESC";
  const result = await pool.query(query, params);
  return result.rows as Asset[];
}

export async function getAsset(
  companyId: string,
  assetId: string,
): Promise<Asset> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM assets WHERE id = $1 AND company_id = $2",
    [assetId, companyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Asset tidak ditemukan"), {
      statusCode: 404,
    });
  }
  return result.rows[0] as Asset;
}

export async function deleteAsset(
  companyId: string,
  assetId: string,
): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    "DELETE FROM assets WHERE id = $1 AND company_id = $2 RETURNING url",
    [assetId, companyId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Asset tidak ditemukan"), {
      statusCode: 404,
    });
  }

  // Delete file from disk
  const filePath = path.join(UPLOAD_BASE, "..", result.rows[0].url);
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* file may not exist */
  }
}

export function ensureUploadDir(companyId: string, assetType: string): string {
  const dir = path.join(UPLOAD_BASE, companyId, assetType);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
