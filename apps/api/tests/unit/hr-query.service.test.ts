/**
 * Unit tests untuk HRQueryService
 * Requirements: 11.3, 11.4
 */

jest.mock("@influxdata/influxdb-client");

import { queryHRHistory } from "../../src/services/hr-query.service";

describe("HRQueryService.queryHRHistory", () => {
  it("query dengan rentang > 30 hari → HTTP 400", async () => {
    const from = "2024-01-01T00:00:00Z";
    const to = "2024-02-15T00:00:00Z"; // 45 days

    await expect(
      queryHRHistory({
        clubId: "club-1",
        userId: "user-1",
        from,
        to,
        interval: "1m",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "range" });
  });

  it("query dengan format tanggal 'from' tidak valid → HTTP 400", async () => {
    await expect(
      queryHRHistory({
        clubId: "club-1",
        userId: "user-1",
        from: "not-a-date",
        to: "2024-01-31T00:00:00Z",
        interval: "1m",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "from" });
  });

  it("query dengan format tanggal 'to' tidak valid → HTTP 400", async () => {
    await expect(
      queryHRHistory({
        clubId: "club-1",
        userId: "user-1",
        from: "2024-01-01T00:00:00Z",
        to: "invalid-date",
        interval: "1m",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "to" });
  });

  it("interval tidak valid → HTTP 400", async () => {
    await expect(
      queryHRHistory({
        clubId: "club-1",
        userId: "user-1",
        from: "2024-01-01T00:00:00Z",
        to: "2024-01-02T00:00:00Z",
        interval: "2m",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "interval" });
  });

  it("from >= to → HTTP 400", async () => {
    await expect(
      queryHRHistory({
        clubId: "club-1",
        userId: "user-1",
        from: "2024-01-02T00:00:00Z",
        to: "2024-01-01T00:00:00Z",
        interval: "1m",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
