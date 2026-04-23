/**
 * InfluxDB bucket setup script.
 * Creates buckets with retention policies:
 *   - heartrate            → 90 days  (7776000 seconds)
 *   - heartrate_aggregated → 2 years  (63072000 seconds)
 *
 * Requirements: 20.1, 20.2, 20.3
 *
 * Usage:
 *   ts-node src/db/influx-setup.ts
 *   INFLUX_URL=http://localhost:8086 INFLUX_TOKEN=... INFLUX_ORG=fitsense ts-node src/db/influx-setup.ts
 */

import { InfluxDB } from "@influxdata/influxdb-client";
import { BucketsAPI, OrgsAPI } from "@influxdata/influxdb-client-apis";
import { config } from "../config";

const RETENTION_90_DAYS_SECONDS = 90 * 24 * 60 * 60; // 7 776 000 s
const RETENTION_2_YEARS_SECONDS = 2 * 365 * 24 * 60 * 60; // 63 072 000 s

interface BucketSpec {
  name: string;
  retentionSeconds: number;
  description: string;
}

const BUCKETS: BucketSpec[] = [
  {
    name: config.influx.bucket,
    retentionSeconds: RETENTION_90_DAYS_SECONDS,
    description: "Raw HR data — retained for 90 days",
  },
  {
    name: config.influx.bucketAggregated,
    retentionSeconds: RETENTION_2_YEARS_SECONDS,
    description:
      "Downsampled HR data (per-minute aggregates) — retained for 2 years",
  },
];

async function getOrgId(orgsApi: OrgsAPI, orgName: string): Promise<string> {
  const orgs = await orgsApi.getOrgs({ org: orgName });
  if (!orgs.orgs || orgs.orgs.length === 0) {
    throw new Error(`Organization '${orgName}' not found in InfluxDB`);
  }
  const orgId = orgs.orgs[0].id;
  if (!orgId) {
    throw new Error(`Organization '${orgName}' has no id`);
  }
  return orgId;
}

async function upsertBucket(
  bucketsApi: BucketsAPI,
  orgId: string,
  spec: BucketSpec,
): Promise<void> {
  // Check if bucket already exists
  const existing = await bucketsApi.getBuckets({
    orgID: orgId,
    name: spec.name,
  });

  const retentionRules = [
    {
      type: "expire" as const,
      everySeconds: spec.retentionSeconds,
      shardGroupDurationSeconds: 0,
    },
  ];

  if (existing.buckets && existing.buckets.length > 0) {
    const bucket = existing.buckets[0];
    console.log(
      `[influx-setup] Bucket '${spec.name}' already exists — updating retention policy`,
    );
    await bucketsApi.patchBucketsID({
      bucketID: bucket.id!,
      body: { retentionRules, description: spec.description },
    });
    console.log(
      `[influx-setup] Updated '${spec.name}': retention = ${spec.retentionSeconds}s (${spec.retentionSeconds / 86400} days)`,
    );
  } else {
    console.log(`[influx-setup] Creating bucket '${spec.name}'`);
    await bucketsApi.postBuckets({
      body: {
        orgID: orgId,
        name: spec.name,
        description: spec.description,
        retentionRules,
      },
    });
    console.log(
      `[influx-setup] Created '${spec.name}': retention = ${spec.retentionSeconds}s (${spec.retentionSeconds / 86400} days)`,
    );
  }
}

export async function setupInfluxBuckets(): Promise<void> {
  const client = new InfluxDB({
    url: config.influx.url,
    token: config.influx.token,
  });
  const orgsApi = new OrgsAPI(client);
  const bucketsApi = new BucketsAPI(client);

  console.log(`[influx-setup] Connecting to InfluxDB at ${config.influx.url}`);
  console.log(`[influx-setup] Organization: ${config.influx.org}`);

  const orgId = await getOrgId(orgsApi, config.influx.org);
  console.log(`[influx-setup] Org ID: ${orgId}`);

  for (const spec of BUCKETS) {
    await upsertBucket(bucketsApi, orgId, spec);
  }

  console.log("[influx-setup] InfluxDB bucket setup complete.");
}

// Allow running directly: ts-node src/db/influx-setup.ts
if (require.main === module) {
  setupInfluxBuckets().catch((err) => {
    console.error("[influx-setup] Setup failed:", err);
    process.exit(1);
  });
}
