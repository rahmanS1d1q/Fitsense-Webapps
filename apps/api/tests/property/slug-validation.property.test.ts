// Feature: fitsense-platform, Property 1: Validasi Format Slug Club

/**
 * Property 1: Validasi Format Slug Club
 *
 * For any string submitted as club slug, API_Server should only accept slugs
 * that consist entirely of lowercase alphanumeric characters and hyphens,
 * with length between 3 and 50 characters.
 *
 * Validates: Requirements 1.3
 */

import * as fc from "fast-check";
import { validateSlug } from "../../src/services/club.service";

describe("Property 1: Validasi Format Slug Club", () => {
  it("hanya slug dengan format valid yang diterima", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (slug) => {
        const isValid = validateSlug(slug);
        const expectedValid = /^[a-z0-9-]{3,50}$/.test(slug);
        return isValid === expectedValid;
      }),
      { numRuns: 100 },
    );
  });

  it("slug valid harus selalu diterima", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9-]{3,50}$/), (slug) => {
        return validateSlug(slug) === true;
      }),
      { numRuns: 100 },
    );
  });

  it("slug dengan karakter uppercase harus selalu ditolak", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 3, maxLength: 50 })
          .filter((s) => /[A-Z]/.test(s)),
        (slug) => {
          return validateSlug(slug) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("slug terlalu pendek (< 3 karakter) harus selalu ditolak", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 2 }), (slug) => {
        return validateSlug(slug) === false;
      }),
      { numRuns: 100 },
    );
  });

  it("slug terlalu panjang (> 50 karakter) harus selalu ditolak", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9-]{51,100}$/), (slug) => {
        return validateSlug(slug) === false;
      }),
      { numRuns: 100 },
    );
  });
});
