/**
 * Downsampling Job — Agregasi data HR raw ke bucket heartrate_aggregated.
 * Jadwal: setiap hari pukul 02.00 UTC.
 * Data HR raw > 90 hari di-downsample menjadi rata-rata per menit.
 */

import cron from "node-cron";
import { InfluxDB } from "@influxdata/influxdb-client";
import { config } from "../config";

async function runDownsampling(): Promise<void> {
  const start = Date.now();
  console.log("[Downsampling] Starting daily downsampling job...");

  try {
    const client = new InfluxDB({
      url: config.influx.url,
      token: config.influx.token,
    });
    const queryApi = client.getQueryApi(config.influx.org);

    // Query data HR raw dari 90-180 hari lalu, agregasi per menit, simpan ke bucket aggregated
    const fluxQuery = `
      from(bucket: "${config.influx.bucket}")
        |> range(start: -180d, stop: -90d)
        |> filter(fn: (r) => r["_measurement"] == "hr_data")
        |> filter(fn: (r) => r["_field"] == "hr")
        |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
        |> to(bucket: "${config.influx.bucketAggregated}", org: "${config.influx.org}")
    `;

    let pointCount = 0;
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next() {
          pointCount++;
        },
        error: reject,
        complete: resolve,
      });
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[Downsampling] Completed: ${pointCount} data points processed in ${elapsed}s`,
    );
  } catch (err) {
    console.error("[Downsampling] Error:", (err as Error).message);
  }
}

export function startDownsamplingJob(): void {
  // Jadwal: setiap hari pukul 02.00 UTC
  cron.schedule("0 2 * * *", () => {
    runDownsampling().catch((err) => {
      console.error("[Downsampling] Unhandled error:", (err as Error).message);
    });
  });
  console.log("[Downsampling] Job scheduled: daily at 02:00 UTC");
}
