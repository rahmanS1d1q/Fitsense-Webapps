import { z } from "zod";

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export const addUserDeviceSchema = z.object({
  device_type: z.enum(["coospo_hw706"], {
    required_error: "Pilih tipe device",
  }),
  mac_address: z
    .string()
    .regex(MAC_REGEX, "Format MAC address tidak valid (XX:XX:XX:XX:XX:XX)"),
  name: z.string().max(100, "Maksimal 100 karakter").optional(),
});

export type AddUserDeviceForm = z.infer<typeof addUserDeviceSchema>;
