// Feature: fitsense-platform, Property 8: Klasifikasi HR Zone — Determinisme dan Kelengkapan

/**
 * Property 8: Klasifikasi HR Zone — Determinisme dan Kelengkapan
 *
 * For any valid pair of positive integer HR and positive integer age,
 * classifyZone must:
 * 1. Return exactly one zone from {rest, fat_burn, cardio, aerobic, peak}
 * 2. Be deterministic: same inputs always produce same output
 * 3. Follow correct thresholds based on pct = hr / (220 - age)
 * 4. Return 'unknown' for age=0 or age=null
 *
 * Validates: Requirements 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import * as fc from "fast-check";
import { classifyZone, HRZone } from "../../src/services/hr-zone.service";

const VALID_ZONES = new Set<HRZone>([
  "rest",
  "fat_burn",
  "cardio",
  "aerobic",
  "peak",
]);

describe("Property 8: Klasifikasi HR Zone — Determinisme dan Kelengkapan", () => {
  it("untuk input valid, mengembalikan tepat satu zona dari {rest, fat_burn, cardio, aerobic, peak}", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.integer({ min: 1, max: 100 }),
        (hr, age) => {
          const zone = classifyZone(hr, age);
          return VALID_ZONES.has(zone);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("deterministik: input yang sama selalu menghasilkan zona yang sama", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.integer({ min: 1, max: 100 }),
        (hr, age) => {
          return classifyZone(hr, age) === classifyZone(hr, age);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("threshold benar: pct < 0.5 → rest", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (age) => {
        const maxHr = 220 - age;
        // hr such that pct < 0.5
        const hr = Math.floor(maxHr * 0.5) - 1;
        if (hr < 1) return true; // skip edge case where hr would be non-positive
        return classifyZone(hr, age) === "rest";
      }),
      { numRuns: 100 },
    );
  });

  it("threshold benar: 0.5 <= pct < 0.6 → fat_burn", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (age) => {
        const maxHr = 220 - age;
        // hr exactly at 50% boundary
        const hr = Math.ceil(maxHr * 0.5);
        const pct = hr / maxHr;
        if (pct < 0.5 || pct >= 0.6) return true; // skip if not in range
        return classifyZone(hr, age) === "fat_burn";
      }),
      { numRuns: 100 },
    );
  });

  it("threshold benar: 0.6 <= pct < 0.7 → cardio", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (age) => {
        const maxHr = 220 - age;
        const hr = Math.ceil(maxHr * 0.6);
        const pct = hr / maxHr;
        if (pct < 0.6 || pct >= 0.7) return true;
        return classifyZone(hr, age) === "cardio";
      }),
      { numRuns: 100 },
    );
  });

  it("threshold benar: 0.7 <= pct < 0.8 → aerobic", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (age) => {
        const maxHr = 220 - age;
        const hr = Math.ceil(maxHr * 0.7);
        const pct = hr / maxHr;
        if (pct < 0.7 || pct >= 0.8) return true;
        return classifyZone(hr, age) === "aerobic";
      }),
      { numRuns: 100 },
    );
  });

  it("threshold benar: pct >= 0.8 → peak", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (age) => {
        const maxHr = 220 - age;
        const hr = Math.ceil(maxHr * 0.8);
        const pct = hr / maxHr;
        if (pct < 0.8) return true;
        return classifyZone(hr, age) === "peak";
      }),
      { numRuns: 100 },
    );
  });

  it("age=0 → unknown", () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 300 }), (hr) => {
        return classifyZone(hr, 0) === "unknown";
      }),
      { numRuns: 100 },
    );
  });

  it("age=null → unknown", () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 300 }), (hr) => {
        return classifyZone(hr, null) === "unknown";
      }),
      { numRuns: 100 },
    );
  });
});
