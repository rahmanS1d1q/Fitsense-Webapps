import { getPool } from "../db/client";

export type AuditLogAction =
  | "soft_delete"
  | "hard_delete"
  | "restore"
  | "suspend_company"
  | "activate_company";

export type AuditLogEntityType =
  | "user"
  | "company"
  | "session"
  | "device"
  | "workout"
  | "workout_assignment";

export interface AuditLogEntry {
  action: AuditLogAction;
  entityType: AuditLogEntityType;
  entityId: string;
  entityData?: Record<string, unknown> | null;
  performedBy: string;
  notes?: string | null;
}

export interface AuditLog {
  id: string;
  action: AuditLogAction;
  entity_type: AuditLogEntityType;
  entity_id: string;
  entity_data: Record<string, unknown> | null;
  performed_by: string;
  performed_at: Date;
  notes: string | null;
  performer_first_name?: string;
  performer_last_name?: string;
  performer_email?: string;
}

export interface AuditLogFilters {
  entityType?: AuditLogEntityType;
  entityId?: string;
  performedBy?: string;
  action?: AuditLogAction;
  from?: string; // ISO string
  to?: string;   // ISO string
  limit?: number;
  offset?: number;
}

/**
 * Log an action to audit_logs table
 */
export async function log(entry: AuditLogEntry): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, entity_data, performed_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.entityData ? JSON.stringify(entry.entityData) : null,
      entry.performedBy,
      entry.notes ?? null,
    ],
  );
}

/**
 * List all audit logs with filters (super admin only)
 */
export async function listLogs(filters: AuditLogFilters): Promise<AuditLog[]> {
  const pool = getPool();
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.entityType) {
    whereClauses.push(`l.entity_type = $${idx++}`);
    values.push(filters.entityType);
  }
  if (filters.entityId) {
    whereClauses.push(`l.entity_id = $${idx++}`);
    values.push(filters.entityId);
  }
  if (filters.performedBy) {
    whereClauses.push(`l.performed_by = $${idx++}`);
    values.push(filters.performedBy);
  }
  if (filters.action) {
    whereClauses.push(`l.action = $${idx++}`);
    values.push(filters.action);
  }
  if (filters.from) {
    whereClauses.push(`l.performed_at >= $${idx++}`);
    values.push(new Date(filters.from));
  }
  if (filters.to) {
    whereClauses.push(`l.performed_at <= $${idx++}`);
    values.push(new Date(filters.to));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const query = `
    SELECT 
      l.id, l.action, l.entity_type, l.entity_id, l.entity_data, l.performed_by, l.performed_at, l.notes,
      u.first_name AS performer_first_name,
      u.last_name AS performer_last_name,
      u.email AS performer_email
    FROM audit_logs l
    LEFT JOIN users u ON l.performed_by = u.id
    ${whereSql}
    ORDER BY l.performed_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;

  const result = await pool.query(query, [...values, limit, offset]);
  return result.rows as AuditLog[];
}
