import { z } from "zod";
import { passwordSchema } from "./password";

export const addTrainerSchema = z.object({
  firstName: z.string().min(1, "Nama depan wajib diisi").max(100),
  lastName: z.string().min(1, "Nama belakang wajib diisi").max(100),
  email: z.string().email("Format email tidak valid"),
  password: passwordSchema,
  role: z.enum(["trainer", "club_owner"], { required_error: "Pilih role" }),
  gender: z.enum(["male", "female", ""]).optional(),
});

export type AddTrainerForm = z.infer<typeof addTrainerSchema>;
