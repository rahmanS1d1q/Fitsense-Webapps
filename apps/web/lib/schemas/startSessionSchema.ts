import { z } from "zod";

export const startSessionSchema = z.object({
  workout_id: z.string().optional(),
  mood: z.string().optional(),
  weight: z
    .number()
    .positive("Berat badan harus positif")
    .optional()
    .or(z.literal(0).transform(() => undefined)),
  height: z
    .number()
    .positive("Tinggi badan harus positif")
    .optional()
    .or(z.literal(0).transform(() => undefined)),
  device_id: z.string().optional(),
});

export type StartSessionForm = z.infer<typeof startSessionSchema>;
