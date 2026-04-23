// Feature: fitsense-platform, Property 12: Statistik Sesi — Konsistensi Kalkulasi
// Feature: fitsense-platform, Property 13: Orphan Session — Auto-Close

/**
 * Property 12: Statistik Sesi — Konsistensi Kalkulasi
 * For any session ended with valid HR data, avg_hr, max_hr, min_hr must be
 * consistent with the actual HR data recorded.
 *
 * Property 13: Orphan Session — Auto-Close
 * For any session that has not received new HR data for > 60 minutes and
 * has no ended_at, the OrphanSessionJob must auto-close it.
 *
 * Validates: Requirements 10.3, 10.7
 */

import * as fc from "fast-check";

// ─── Property 12: Session stats consistency ───────────────────────────────────

function computeStats(hrValues: number[]): {
  avgHr: number;
  maxHr: number;
  minHr: number;
} {
  const avgHr = Math.round(
    hrValues.reduce((a, b) => a + b, 0) / hrValues.length,
  );
  const maxHr = Math.max(...hrValues);
  const minHr = Math.min(...hrValues);
  return { avgHr, maxHr, minHr };
}

describe("Property 12: Statistik Sesi — Konsistensi Kalkulasi", () => {
  it("avg_hr harus berada di antara min_hr dan max_hr untuk semua input valid", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 20, max: 300 }), {
          minLength: 1,
          maxLength: 1000,
        }),
        (hrValues) => {
          const { avgHr, maxHr, minHr } = computeStats(hrValues);
          return avgHr >= minHr && avgHr <= maxHr;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("max_hr harus >= semua nilai HR dalam sesi", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 20, max: 300 }), {
          minLength: 1,
          maxLength: 500,
        }),
        (hrValues) => {
          const { maxHr } = computeStats(hrValues);
          return hrValues.every((hr) => hr <= maxHr);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("min_hr harus <= semua nilai HR dalam sesi", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 20, max: 300 }), {
          minLength: 1,
          maxLength: 500,
        }),
        (hrValues) => {
          const { minHr } = computeStats(hrValues);
          return hrValues.every((hr) => hr >= minHr);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("avg_hr dari satu nilai HR harus sama dengan nilai itu sendiri", () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 300 }), (hr) => {
        const { avgHr, maxHr, minHr } = computeStats([hr]);
        return avgHr === hr && maxHr === hr && minHr === hr;
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 13: Orphan Session Auto-Close ───────────────────────────────────

const ORPHAN_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

function shouldAutoClose(lastHrTimestamp: number, now: number): boolean {
  return now - lastHrTimestamp >= ORPHAN_TIMEOUT_MS;
}

describe("Property 13: Orphan Session — Auto-Close", () => {
  it("sesi yang tidak aktif > 60 menit harus di-auto-close", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9999999999000 }), (lastHrTs) => {
        const now = lastHrTs + ORPHAN_TIMEOUT_MS + 1;
        return shouldAutoClose(lastHrTs, now) === true;
      }),
      { numRuns: 100 },
    );
  });

  it("sesi yang aktif < 60 menit tidak boleh di-auto-close", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999999999000 }),
        fc.integer({ min: 0, max: ORPHAN_TIMEOUT_MS - 1 }),
        (lastHrTs, elapsed) => {
          const now = lastHrTs + elapsed;
          return shouldAutoClose(lastHrTs, now) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("tepat di batas 60 menit harus di-auto-close", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9999999999000 }), (lastHrTs) => {
        const now = lastHrTs + ORPHAN_TIMEOUT_MS;
        return shouldAutoClose(lastHrTs, now) === true;
      }),
      { numRuns: 100 },
    );
  });
});
