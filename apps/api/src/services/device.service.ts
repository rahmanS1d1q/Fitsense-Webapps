import { getPool } from "../db/client";

export const VALID_DEVICE_TYPES = ["coospo_hw706"] as const;

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export type DeviceOwnerType = "company" | "individual";
export type DeviceStatus = "available" | "borrowed" | "maintenance" | "lost";

export interface Device {
  id: string;
  user_id: string | null;
  company_id: string;
  device_type: string;
  mac_address: string;
  owner_type: DeviceOwnerType;
  name: string | null;
  status: DeviceStatus;
  assigned_to: string | null;
  registered_by: string | null;
  notes: string | null;
  is_default: boolean;
  registered_at: Date;
  updated_at: Date;
}

export interface CreateCompanyDeviceInput {
  name: string;
  device_type: string;
  mac_address: string;
  notes?: string;
  assigned_to?: string;
}

export interface CreateUserDeviceInput {
  device_type: string;
  mac_address: string;
  name?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateDeviceType(deviceType: string): boolean {
  return (VALID_DEVICE_TYPES as readonly string[]).includes(deviceType);
}

function validateMacAddress(mac: string): boolean {
  return MAC_REGEX.test(mac);
}

function normalizeMac(mac: string): string {
  return mac.toUpperCase().replace(/-/g, ":");
}

// ─── Company Devices ──────────────────────────────────────────────────────────

/**
 * Register a company-owned device (owner_type = 'company').
 */
export async function createCompanyDevice(
  companyId: string,
  registeredBy: string,
  data: CreateCompanyDeviceInput,
): Promise<Device> {
  if (!validateDeviceType(data.device_type)) {
    throw Object.assign(
      new Error(
        `Tipe perangkat tidak valid. Nilai yang diterima: ${VALID_DEVICE_TYPES.join(", ")}`,
      ),
      { statusCode: 400, code: "INVALID_DEVICE_TYPE", field: "device_type" },
    );
  }
  if (!validateMacAddress(data.mac_address)) {
    throw Object.assign(
      new Error("Format MAC address tidak valid (XX:XX:XX:XX:XX:XX)"),
      { statusCode: 400, code: "INVALID_MAC", field: "mac_address" },
    );
  }

  const pool = getPool();
  const mac = normalizeMac(data.mac_address);

  // Check MAC duplicate in company
  const dupCheck = await pool.query(
    "SELECT id FROM devices WHERE company_id = $1 AND mac_address = $2 AND deleted_at IS NULL",
    [companyId, mac],
  );
  if (dupCheck.rows.length > 0) {
    throw Object.assign(
      new Error("MAC address sudah terdaftar di company ini"),
      { statusCode: 409, code: "MAC_CONFLICT", field: "mac_address" },
    );
  }

  const result = await pool.query(
    `INSERT INTO devices (company_id, device_type, mac_address, owner_type, name, notes, assigned_to, registered_by, status)
     VALUES ($1, $2, $3, 'company', $4, $5, $6, $7, 'available')
     RETURNING *`,
    [
      companyId,
      data.device_type,
      mac,
      data.name,
      data.notes ?? null,
      data.assigned_to ?? null,
      registeredBy,
    ],
  );
  return result.rows[0] as Device;
}

/**
 * List all company devices, optionally filtered by status.
 */
export async function listCompanyDevices(
  companyId: string,
  status?: DeviceStatus,
): Promise<Device[]> {
  const pool = getPool();
  let q =
    "SELECT * FROM devices WHERE company_id = $1 AND owner_type = 'company' AND deleted_at IS NULL";
  const params: unknown[] = [companyId];
  if (status) {
    q += " AND status = $2";
    params.push(status);
  }
  q += " ORDER BY registered_at DESC";
  const result = await pool.query(q, params);
  return result.rows as Device[];
}

/**
 * Get a single company device.
 */
export async function getCompanyDevice(
  companyId: string,
  deviceId: string,
): Promise<Device> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM devices WHERE id = $1 AND company_id = $2 AND owner_type = 'company' AND deleted_at IS NULL",
    [deviceId, companyId],
  );
  if (result.rows.length === 0)
    throw Object.assign(new Error("Device tidak ditemukan"), {
      statusCode: 404,
    });
  return result.rows[0] as Device;
}

/**
 * Update company device info (name, notes, assigned_to).
 */
export async function updateCompanyDevice(
  companyId: string,
  deviceId: string,
  data: Partial<Pick<Device, "name" | "notes" | "assigned_to">>,
): Promise<Device> {
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (data.name !== undefined) {
    fields.push("name = $" + String(idx++));
    values.push(data.name);
  }
  if (data.notes !== undefined) {
    fields.push("notes = $" + String(idx++));
    values.push(data.notes);
  }
  if (data.assigned_to !== undefined) {
    fields.push("assigned_to = $" + String(idx++));
    values.push(data.assigned_to);
  }
  if (fields.length === 0)
    throw Object.assign(new Error("Tidak ada field yang diupdate"), {
      statusCode: 400,
    });
  fields.push("updated_at = NOW()");
  values.push(deviceId, companyId);
  const result = await pool.query(
    "UPDATE devices SET " +
      fields.join(", ") +
      " WHERE id = $" +
      String(idx++) +
      " AND company_id = $" +
      String(idx) +
      " AND owner_type = 'company' RETURNING *",
    values,
  );
  if (result.rows.length === 0)
    throw Object.assign(new Error("Device tidak ditemukan"), {
      statusCode: 404,
    });
  return result.rows[0] as Device;
}

/**
 * Update device status manually. 'borrowed' is reserved for system only.
 */
export async function updateDeviceStatus(
  companyId: string,
  deviceId: string,
  status: "available" | "maintenance" | "lost",
  notes?: string,
): Promise<Device> {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE devices SET status = $1, notes = COALESCE($2, notes), updated_at = NOW() WHERE id = $3 AND company_id = $4 AND owner_type = 'company' RETURNING *",
    [status, notes ?? null, deviceId, companyId],
  );
  if (result.rows.length === 0)
    throw Object.assign(new Error("Device tidak ditemukan"), {
      statusCode: 404,
    });
  return result.rows[0] as Device;
}

/**
 * Delete a device. Fails with 409 if status is 'borrowed'.
 */
export async function deleteDevice(
  companyId: string,
  deviceId: string,
): Promise<void> {
  const pool = getPool();
  const check = await pool.query(
    "SELECT id, status FROM devices WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
    [deviceId, companyId],
  );
  if (check.rows.length === 0)
    throw Object.assign(new Error("Device tidak ditemukan"), {
      statusCode: 404,
    });
  if (check.rows[0].status === "borrowed")
    throw Object.assign(
      new Error("Device sedang digunakan, tidak bisa dihapus"),
      { statusCode: 409, code: "DEVICE_BORROWED" },
    );
  await pool.query("UPDATE devices SET deleted_at = NOW() WHERE id = $1 AND company_id = $2", [
    deviceId,
    companyId,
  ]);
}

// ─── User (Individual) Devices ────────────────────────────────────────────────

/**
 * Register a member-owned device (owner_type = 'individual').
 */
export async function createUserDevice(
  companyId: string,
  userId: string,
  registeredBy: string,
  data: CreateUserDeviceInput,
): Promise<Device> {
  if (!validateDeviceType(data.device_type)) {
    throw Object.assign(
      new Error(
        `Tipe perangkat tidak valid. Nilai yang diterima: ${VALID_DEVICE_TYPES.join(", ")}`,
      ),
      { statusCode: 400, code: "INVALID_DEVICE_TYPE", field: "device_type" },
    );
  }
  if (!validateMacAddress(data.mac_address)) {
    throw Object.assign(
      new Error("Format MAC address tidak valid (XX:XX:XX:XX:XX:XX)"),
      { statusCode: 400, code: "INVALID_MAC", field: "mac_address" },
    );
  }

  const pool = getPool();
  const mac = normalizeMac(data.mac_address);

  // Check MAC dup for this user
  const userDup = await pool.query(
    "SELECT id FROM devices WHERE user_id = $1 AND mac_address = $2 AND deleted_at IS NULL",
    [userId, mac],
  );
  if (userDup.rows.length > 0)
    throw Object.assign(
      new Error("MAC address sudah terdaftar untuk member ini"),
      { statusCode: 409, code: "MAC_CONFLICT", field: "mac_address" },
    );

  // Check MAC not already a company device in this company
  const compDup = await pool.query(
    "SELECT id FROM devices WHERE company_id = $1 AND owner_type = 'company' AND mac_address = $2 AND deleted_at IS NULL",
    [companyId, mac],
  );
  if (compDup.rows.length > 0)
    throw Object.assign(
      new Error("MAC address sudah terdaftar sebagai device company"),
      { statusCode: 409, code: "MAC_CONFLICT_COMPANY", field: "mac_address" },
    );

  const result = await pool.query(
    `INSERT INTO devices (user_id, company_id, device_type, mac_address, owner_type, name, registered_by, status)
     VALUES ($1, $2, $3, $4, 'individual', $5, $6, 'available')
     RETURNING *`,
    [userId, companyId, data.device_type, mac, data.name ?? null, registeredBy],
  );
  return result.rows[0] as Device;
}

/**
 * List individual devices for a member in a company.
 */
export async function listUserDevices(
  userId: string,
  companyId: string,
): Promise<Device[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM devices WHERE user_id = $1 AND company_id = $2 AND owner_type = 'individual' AND deleted_at IS NULL ORDER BY registered_at DESC",
    [userId, companyId],
  );
  return result.rows as Device[];
}

/**
 * Delete an individual device.
 */
export async function deleteUserDevice(
  deviceId: string,
  userId: string,
  companyId: string,
): Promise<void> {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE devices SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND company_id = $3 AND deleted_at IS NULL RETURNING id",
    [deviceId, userId, companyId],
  );
  if (result.rows.length === 0)
    throw Object.assign(new Error("Device tidak ditemukan"), {
      statusCode: 404,
    });
}

// ─── MQTT Consumer helper ─────────────────────────────────────────────────────

/**
 * Resolve a device by MAC address — individual first, then company.
 * Used by MQTT Consumer to auto-assign device to session.
 */
export async function resolveDeviceByMac(
  macAddress: string,
  userId: string,
  companyId: string,
): Promise<Device | null> {
  const pool = getPool();
  const mac = normalizeMac(macAddress);

  // 1. Check individual device for this user
  const indivResult = await pool.query(
    "SELECT * FROM devices WHERE owner_type = 'individual' AND user_id = $1 AND mac_address = $2 AND deleted_at IS NULL LIMIT 1",
    [userId, mac],
  );
  if (indivResult.rows.length > 0) return indivResult.rows[0] as Device;

  // 2. Check company device
  const compResult = await pool.query(
    "SELECT * FROM devices WHERE owner_type = 'company' AND company_id = $1 AND mac_address = $2 AND deleted_at IS NULL LIMIT 1",
    [companyId, mac],
  );
  if (compResult.rows.length > 0) return compResult.rows[0] as Device;

  return null;
}

// ─── Backward compat (existing code uses registerDevice / listDevices) ────────

/** @deprecated Use createUserDevice instead */
export async function registerDevice(
  userId: string,
  companyId: string,
  data: { device_type: string; mac_address: string },
): Promise<Device> {
  return createUserDevice(companyId, userId, userId, data);
}

/** @deprecated Use listUserDevices instead */
export async function listDevices(userId: string): Promise<Device[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM devices WHERE user_id = $1 AND owner_type = 'individual' AND deleted_at IS NULL ORDER BY registered_at DESC",
    [userId],
  );
  return result.rows as Device[];
}

/**
 * List all active user devices (individual devices).
 * Return all devices without status filtering.
 */
export async function listActiveUserDevices(
  userId: string,
  companyId: string,
): Promise<Device[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM devices 
     WHERE owner_type = 'individual' AND user_id = $1 AND company_id = $2 AND deleted_at IS NULL
     ORDER BY is_default DESC, registered_at DESC`,
    [userId, companyId],
  );
  return result.rows as Device[];
}

/**
 * Set a device as default for the user.
 * Set is_default = true for the selected device and is_default = false for all others of the same user.
 */
export async function setDefaultDevice(
  userId: string,
  deviceId: string,
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Set all user's devices to non-default
    await client.query(
      "UPDATE devices SET is_default = FALSE WHERE user_id = $1 AND owner_type = 'individual'",
      [userId],
    );

    // Set the selected device to default
    const result = await client.query(
      "UPDATE devices SET is_default = TRUE WHERE id = $1 AND user_id = $2 AND owner_type = 'individual' RETURNING id",
      [deviceId, userId],
    );

    if (result.rows.length === 0) {
      throw Object.assign(new Error("Device tidak ditemukan atau bukan milik Anda"), {
        statusCode: 404,
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

