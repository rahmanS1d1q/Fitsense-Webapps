import { z } from "zod";

export const createWorkoutSchema = z.object({
  name: z
    .string()
    .min(1, "Nama workout wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  intro_activities: z.string().optional(),
  intro_duration: z
    .number()
    .int()
    .positive("Durasi harus positif")
    .optional()
    .or(z.nan().transform(() => undefined)),
  asset_id: z.string().uuid().optional().or(z.literal("")),
});

export type CreateWorkoutForm = z.infer<typeof createWorkoutSchema>;
