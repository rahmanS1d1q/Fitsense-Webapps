import { z } from "zod";

export const createAssignmentSchema = z.object({
  member_id: z.string().uuid("Member wajib dipilih"),
  workout_id: z.string().uuid("Workout wajib dipilih"),
  assigned_date: z.string().min(1, "Tanggal wajib diisi"),
  notes: z.string().max(500).optional(),
});

export type CreateAssignmentForm = z.infer<typeof createAssignmentSchema>;
