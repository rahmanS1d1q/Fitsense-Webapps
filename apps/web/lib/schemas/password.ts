import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Minimal 8 karakter")
  .regex(/[A-Z]/, "Harus ada 1 huruf besar")
  .regex(/[a-z]/, "Harus ada 1 huruf kecil")
  .regex(/[0-9]/, "Harus ada 1 angka");
