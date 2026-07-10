import { z } from "zod";
import { passwordSchema } from "./password";

export const createCompanySchema = z.object({
  name: z
    .string()
    .min(1, "Nama company wajib diisi")
    .max(100, "Maksimal 100 karakter"),
  slug: z
    .string()
    .min(3, "Minimal 3 karakter")
    .max(50, "Maksimal 50 karakter")
    .regex(/^[a-z0-9-]+$/, "Hanya huruf kecil, angka, dan tanda hubung"),
  address: z.string().optional(),
  phone: z.string().max(20, "Maksimal 20 karakter").optional(),
  ownerFirstName: z.string().min(1, "Nama depan owner wajib diisi").max(100),
  ownerLastName: z.string().min(1, "Nama belakang owner wajib diisi").max(100),
  ownerEmail: z.string().email("Format email tidak valid"),
  ownerPassword: passwordSchema,
  ownerGender: z.enum(["male", "female", ""]).optional(),
});

export type CreateCompanyForm = z.infer<typeof createCompanySchema>;
