// Feature: fitsense-platform, Property 17: Validasi Password — Syarat Minimum

/**
 * Property 17: Validasi Password — Syarat Minimum
 *
 * For any password string, validatePassword must accept only passwords that:
 * - Have length >= 8
 * - Contain at least one uppercase letter
 * - Contain at least one lowercase letter
 * - Contain at least one digit
 *
 * Validates: Requirements 18.5
 */

import * as fc from "fast-check";
import { validatePassword } from "../../src/services/invite.service";

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid password: length >= 8, has upper, lower, digit */
const validPasswordArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), {
      minLength: 1,
    }),
    fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")), {
      minLength: 1,
    }),
    fc.stringOf(fc.constantFrom(..."0123456789".split("")), { minLength: 1 }),
    fc.stringOf(fc.ascii(), { minLength: 5 }),
  )
  .map(([upper, lower, digit, extra]) => {
    // Shuffle to avoid predictable patterns
    const combined = (upper + lower + digit + extra).split("");
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined.join("");
  })
  .filter((p) => p.length >= 8);

/** Generate a password missing uppercase */
const noUppercaseArb = fc
  .stringOf(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")),
    {
      minLength: 8,
    },
  )
  .filter((p) => !/[A-Z]/.test(p));

/** Generate a password missing lowercase */
const noLowercaseArb = fc
  .stringOf(
    fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")),
    {
      minLength: 8,
    },
  )
  .filter((p) => !/[a-z]/.test(p));

/** Generate a password missing digits */
const noDigitArb = fc
  .stringOf(
    fc.constantFrom(
      ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),
    ),
    {
      minLength: 8,
    },
  )
  .filter((p) => !/[0-9]/.test(p));

/** Generate a password that is too short (< 8 chars) */
const tooShortArb = fc.stringOf(fc.ascii(), {
  minLength: 1,
  maxLength: 7,
});

// ─── Properties ──────────────────────────────────────────────────────────────

describe("Property 17: Validasi Password — Syarat Minimum", () => {
  it("should accept any password with length >= 8, uppercase, lowercase, and digit", () => {
    fc.assert(
      fc.property(validPasswordArb, (password) => {
        expect(validatePassword(password)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject any password shorter than 8 characters", () => {
    fc.assert(
      fc.property(tooShortArb, (password) => {
        expect(validatePassword(password)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject any password missing an uppercase letter", () => {
    fc.assert(
      fc.property(noUppercaseArb, (password) => {
        expect(validatePassword(password)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject any password missing a lowercase letter", () => {
    fc.assert(
      fc.property(noLowercaseArb, (password) => {
        expect(validatePassword(password)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("should reject any password missing a digit", () => {
    fc.assert(
      fc.property(noDigitArb, (password) => {
        expect(validatePassword(password)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

