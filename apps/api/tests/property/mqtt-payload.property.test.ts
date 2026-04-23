// Feature: fitsense-platform, Property 16: Validasi Payload MQTT — Round-Trip Serialisasi

/**
 * Property 16: Validasi Payload MQTT — Round-Trip Serialisasi
 *
 * For any valid HR payload (hr integer 20-300, session_id UUID, timestamp Unix ms,
 * optional rr float 200-2000), serializing to JSON and parsing back must produce
 * an equivalent object.
 *
 * Validates: Requirements 17.1, 17.4, 17.5, 17.6
 */

import * as fc from "fast-check";
import {
  validateHRPayload,
  RawHRPayload,
} from "../../src/services/mqtt.consumer";

describe("Property 16: Validasi Payload MQTT — Round-Trip Serialisasi", () => {
  it("payload valid: serialize → parse → ekuivalen dengan objek asal", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.uuid(),
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (hr, session_id, timestamp) => {
          const payload: RawHRPayload = { hr, session_id, timestamp };
          const serialized = JSON.stringify(payload);
          const parsed = JSON.parse(serialized) as RawHRPayload;

          return (
            parsed.hr === hr &&
            parsed.session_id === session_id &&
            parsed.timestamp === timestamp
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("payload valid dengan rr: serialize → parse → ekuivalen", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.float({ min: 200, max: 2000, noNaN: true }),
        fc.uuid(),
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (hr, rr, session_id, timestamp) => {
          const payload: RawHRPayload = { hr, rr, session_id, timestamp };
          const serialized = JSON.stringify(payload);
          const parsed = JSON.parse(serialized) as RawHRPayload;

          return (
            parsed.hr === hr &&
            parsed.session_id === session_id &&
            parsed.timestamp === timestamp &&
            Math.abs((parsed.rr ?? 0) - rr) < 0.001
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("validateHRPayload menerima semua payload valid yang di-generate", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.uuid(),
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (hr, session_id, timestamp) => {
          const result = validateHRPayload({ hr, session_id, timestamp });
          return result !== null && result.hr === hr;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("validateHRPayload menolak semua hr di luar range 20-300", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 19 }),
          fc.integer({ min: 301, max: 10000 }),
        ),
        fc.uuid(),
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (hr, session_id, timestamp) => {
          const result = validateHRPayload({ hr, session_id, timestamp });
          return result === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("validateHRPayload menolak semua rr di luar range 200-2000", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        fc.oneof(
          fc.float({ min: 0, max: Math.fround(199.9), noNaN: true }),
          fc.float({
            min: Math.fround(2000.1),
            max: Math.fround(5000),
            noNaN: true,
          }),
        ),
        fc.uuid(),
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (hr, rr, session_id, timestamp) => {
          const result = validateHRPayload({ hr, rr, session_id, timestamp });
          return result === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("validateHRPayload: payload tanpa field wajib selalu ditolak", () => {
    fc.assert(
      fc.property(
        fc.record({
          // Randomly omit one or more required fields
          hr: fc.option(fc.integer({ min: 20, max: 300 }), { nil: undefined }),
          session_id: fc.option(fc.uuid(), { nil: undefined }),
          timestamp: fc.option(fc.integer({ min: 1, max: 9999999999 }), {
            nil: undefined,
          }),
        }),
        (partial) => {
          // Only test cases where at least one required field is missing
          const hasMissingField =
            partial.hr === undefined ||
            partial.session_id === undefined ||
            partial.timestamp === undefined;

          if (!hasMissingField) return true; // skip complete payloads

          const result = validateHRPayload(partial);
          return result === null;
        },
      ),
      { numRuns: 100 },
    );
  });
});
