import { z } from "zod";

export const editProfileSchema = z.object({
  firstName: z.string().min(1, "Nama depan wajib diisi").max(100),
  lastName: z.string().min(1, "Nama belakang wajib diisi").max(100),
  gender: z.enum(["male", "female", ""]).optional(),
  date_of_birth: z.string({ required_error: "Tanggal lahir wajib diisi untuk kalkulasi HR zone" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir: YYYY-MM-DD')
    .refine((val) => {
      const date = new Date(val);
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const m = today.getMonth() - date.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
        age--;
      }
      return age >= 10 && age <= 100;
    }, 'Usia harus antara 10 dan 100 tahun'),
  height: z
    .number()
    .positive("Tinggi harus positif")
    .optional()
    .or(z.literal(0).transform(() => undefined)),
  weight: z
    .number()
    .positive("Berat harus positif")
    .optional()
    .or(z.literal(0).transform(() => undefined)),
  bioCode: z.string().optional(),
});

export type EditProfileForm = z.infer<typeof editProfileSchema>;
