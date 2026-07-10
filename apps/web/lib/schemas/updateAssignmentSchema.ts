import { z } from "zod";

export const updateAssignmentSchema = z.object({
  status: z.enum(["pending", "completed", "skipped"]).optional(),
  notes: z.string().max(500).optional(),
  workout_id: z.string().uuid().optional(),
  assigned_date: z.string().optional(),
});

export type UpdateAssignmentForm = z.infer<typeof updateAssignmentSchema>;
