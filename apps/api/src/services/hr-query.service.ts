/**
 * HRQueryService — Query InfluxDB dengan filter tenant.
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 15.2
 */

import { InfluxDB } from "@influxdata/influxdb-client";
import { config } from "../config";

export type HRInterval = "1s" | "10s" | "1m" | "5m" | "1h";

const VALID_INTERVALS: HRInterval[] = ["1s", "10s", "1m", "5m", "1h"];
const MAX_RANGE_DAYS = 30;
const MAX_RANGE_MS = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

export interface HRDataRow {
  time: string;
  hr: number;
  rr?: number;
  hr_zone?: string;
}

export interface HRQueryParams {
  clubId: string;
  userId: string;
  from: string;
  to: string;
  interval: string;
}

/**
 * Validates ISO 8601 date string.
 */
function isValidIso8601(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && dateStr.trim().length > 0;
}

/**
 * Queries HR history from InfluxDB with tenant isolation.
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 15.2
 */
export async function queryHRHistory(
  params: HRQueryParams,
): Promise<HRDataRow[]> {
  const { clubId, userId, from, to, interval } = params;

  // Validate interval
  if (!VALID_INTERVALS.includes(interval as HRInterval)) {
    throw Object.assign(
      new Error(
        `Interval tidak valid. Nilai yang diterima: ${VALID_INTERVALS.join(", ")}`,
      ),
      { statusCode: 400, field: "interval" },
    );
  }

  // Validate ISO 8601 format
  if (!isValidIso8601(from)) {
    throw Object.assign(
      new Error(
        "Parameter 'from' harus dalam format ISO 8601 yang valid (contoh: 2024-01-01T00:00:00Z)",
      ),
      { statusCode: 400, field: "from" },
    );
  }
  if (!isValidIso8601(to)) {
    throw Object.assign(
      new Error(
        "Parameter 'to' harus dalam format ISO 8601 yang valid (contoh: 2024-01-31T23:59:59Z)",
      ),
      { statusCode: 400, field: "to" },
    );
  }

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  // Validate range <= 30 days
  if (toMs - fromMs > MAX_RANGE_MS) {
    throw Object.assign(
      new Error(`Rentang waktu maksimal adalah ${MAX_RANGE_DAYS} hari.`),
      { statusCode: 400, field: "range" },
    );
  }

  if (fromMs >= toMs) {
    throw Object.assign(
      new Error("Parameter 'from' harus lebih awal dari 'to'."),
      { statusCode: 400, field: "from" },
    );
  }

  const client = new InfluxDB({
    url: config.influx.url,
    token: config.influx.token,
  });
  const queryApi = client.getQueryApi(config.influx.org);

  // Always include club_id and user_id filters for tenant isolation
  const fluxQuery = `
    from(bucket: "${config.influx.bucket}")
      |> range(start: ${new Date(from).toISOString()}, stop: ${new Date(to).toISOString()})
      |> filter(fn: (r) => r["_measurement"] == "hr_data")
      |> filter(fn: (r) => r["club_id"] == "${clubId}")
      |> filter(fn: (r) => r["user_id"] == "${userId}")
      |> filter(fn: (r) => r["_field"] == "hr")
      |> aggregateWindow(every: ${interval}, fn: mean, createEmpty: false)
      |> yield(name: "mean")
  `;

  const rows: HRDataRow[] = [];

  await new Promise<void>((resolve, reject) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row);
        rows.push({
          time: String(obj._time),
          hr: Math.round(Number(obj._value)),
        });
      },
      error: reject,
      complete: resolve,
    });
  });

  return rows;
}
