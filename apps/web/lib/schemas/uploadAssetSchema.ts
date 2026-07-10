import { z } from "zod";

export const uploadAssetSchema = z.object({
  type: z.enum(
    ["profile_photo", "workout_image", "workout_video", "club_banner"],
    {
      required_error: "Tipe asset wajib dipilih",
    },
  ),
  name: z.string().optional(),
  published: z.boolean().optional(),
});

export type UploadAssetForm = z.infer<typeof uploadAssetSchema>;
