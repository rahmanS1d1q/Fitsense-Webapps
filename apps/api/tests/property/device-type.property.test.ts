// Feature: fitsense-platform, Property 6: Validasi Tipe Perangkat

/**
 * Property 6: Validasi Tipe Perangkat
 *
 * For any device registration request, API_Server should only accept
 * device_type with value `coospo_h6` or `coospo_hw706`.
 * All other values must be rejected with HTTP 400.
 *
 * Validates: Requirements 4.3
 */

import * as fc from "fast-check";
import {
  validateDeviceType,
  VALID_DEVICE_TYPES,
} from "../../src/services/device.service";

const VALID_SET = new Set<string>(VALID_DEVICE_TYPES);

describe("Property 6: Validasi Tipe Perangkat", () => {
  it("hanya coospo_h6 dan coospo_hw706 yang diterima", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (deviceType) => {
        const isValid = validateDeviceType(deviceType);
        const expectedValid = VALID_SET.has(deviceType);
        return isValid === expectedValid;
      }),
      { numRuns: 100 },
    );
  });

  it("semua tipe valid harus selalu diterima", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_DEVICE_TYPES), (deviceType) => {
        return validateDeviceType(deviceType) === true;
      }),
      { numRuns: 100 },
    );
  });

  it("string acak yang bukan tipe valid harus selalu ditolak", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => !VALID_SET.has(s)),
        (deviceType) => {
          return validateDeviceType(deviceType) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("string kosong harus selalu ditolak", () => {
    expect(validateDeviceType("")).toBe(false);
  });

  it("tipe dengan spasi atau karakter tambahan harus ditolak", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_DEVICE_TYPES),
        fc.string({ minLength: 1, maxLength: 10 }),
        (validType, extra) => {
          // Adding extra chars makes it invalid
          const modified = validType + extra;
          if (VALID_SET.has(modified)) return true; // skip if accidentally valid
          return validateDeviceType(modified) === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});
