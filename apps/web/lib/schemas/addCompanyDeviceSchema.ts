import { z } from "zod";

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export const addCompanyDeviceSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100, "Maksimal 100 karakter"),
  device_type: z.enum(["coospo_hw706"], {
    required_error: "Pilih tipe device",
  }),
  mac_address: z
    .string()
    .regex(MAC_REGEX, "Format MAC address tidak valid (XX:XX:XX:XX:XX:XX)"),
  notes: z.string().optional(),
  assigned_to: z.string().uuid("UUID tidak valid").optional().or(z.literal("")),
});

export type AddCompanyDeviceForm = z.infer<typeof addCompanyDeviceSchema>;
