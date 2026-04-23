import { getPool } from "../db/client";

export const VALID_DEVICE_TYPES = ["coospo_h6", "coospo_hw706"] as const;

export interface Device {
  id: string;
  user_id: string;
  club_id: string;
  device_type: string;
  mac_address: string;
  registered_at: Date;
}

export interface RegisterDeviceInput {
  device_type: string;
  mac_address: string;
}

/**
 * Validates that the device type is one of the supported types.
 * Requirements: 4.3
 */
export function validateDeviceType(deviceType: string): boolean {
  return (VALID_DEVICE_TYPES as readonly string[]).includes(deviceType);
}

/**
 * Registers a new device for a member.
 * Returns HTTP 400 if device_type is unsupported.
 * Returns HTTP 409 if mac_address is already registered for the same member.
 * Requirements: 4.1, 4.2, 4.3
 */
export async function registerDevice(
  userId: string,
  clubId: string,
  data: RegisterDeviceInput,
): Promise<Device> {
  if (!validateDeviceType(data.device_type)) {
    throw Object.assign(
      new Error(
        `Tipe perangkat tidak didukung. Tipe yang valid: ${VALID_DEVICE_TYPES.join(", ")}.`,
      ),
      { statusCode: 400, code: "INVALID_DEVICE_TYPE", field: "device_type" },
    );
  }

  const pool = getPool();

  // Check MAC address uniqueness per member
  const macCheck = await pool.query(
    "SELECT id FROM devices WHERE user_id = $1 AND mac_address = $2",
    [userId, data.mac_address],
  );
  if (macCheck.rows.length > 0) {
    throw Object.assign(
      new Error("MAC address sudah terdaftar untuk member ini."),
      { statusCode: 409, code: "MAC_CONFLICT", field: "mac_address" },
    );
  }

  const result = await pool.query(
    `INSERT INTO devices (user_id, club_id, device_type, mac_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, club_id, device_type, mac_address, registered_at`,
    [userId, clubId, data.device_type, data.mac_address],
  );

  return result.rows[0] as Device;
}

/**
 * Returns all devices registered for a member.
 * Requirements: 4.1
 */
export async function listDevices(userId: string): Promise<Device[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, user_id, club_id, device_type, mac_address, registered_at
     FROM devices
     WHERE user_id = $1
     ORDER BY registered_at DESC`,
    [userId],
  );
  return result.rows as Device[];
}
