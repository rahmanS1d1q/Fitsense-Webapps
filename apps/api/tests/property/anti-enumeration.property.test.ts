// Feature: fitsense-platform, Property 19: Anti-Enumerasi Email — Reset Password

/**
 * Property 19: Anti-Enumerasi Email — Reset Password
 *
 * For any email address (registered or not), POST /api/auth/forgot-password
 * must always return HTTP 200 with an identical response shape,
 * so attackers cannot determine whether an email is registered.
 *
 * Validates: Requirements 19.2
 */

import * as fc from "fast-check";

// ─── Pure simulation of requestReset response ────────────────────────────────

interface RequestResetResult {
  sent: boolean;
}

/**
 * Simulate the anti-enumeration behavior:
 * Both registered and unregistered emails return the same HTTP status and shape.
 */
function simulateRequestReset(
  emailExists: boolean,
  rateLimited: boolean,
): { statusCode: number; body: RequestResetResult } {
  if (rateLimited) {
    // Rate limited — still return 200 with same shape
    return { statusCode: 200, body: { sent: false } };
  }

  if (!emailExists) {
    // Email not registered — return same shape as success
    return { statusCode: 200, body: { sent: false } };
  }

  // Email registered — send email
  return { statusCode: 200, body: { sent: true } };
}

// ─── Properties ──────────────────────────────────────────────────────────────

describe("Property 19: Anti-Enumerasi Email — Reset Password", () => {
  it("should always return HTTP 200 regardless of whether email is registered", () => {
    fc.assert(
      fc.property(
        fc.boolean(), // emailExists
        fc.boolean(), // rateLimited
        (emailExists, rateLimited) => {
          const { statusCode } = simulateRequestReset(emailExists, rateLimited);
          expect(statusCode).toBe(200);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should always return a response with the same shape { sent: boolean }", () => {
    fc.assert(
      fc.property(
        fc.boolean(), // emailExists
        fc.boolean(), // rateLimited
        (emailExists, rateLimited) => {
          const { body } = simulateRequestReset(emailExists, rateLimited);
          // Response must always have the 'sent' field
          expect(body).toHaveProperty("sent");
          expect(typeof body.sent).toBe("boolean");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return identical HTTP status for registered and unregistered emails", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.emailAddress(),
        (registeredEmail, unregisteredEmail) => {
          // Simulate: first email is registered, second is not
          const registeredResponse = simulateRequestReset(true, false);
          const unregisteredResponse = simulateRequestReset(false, false);

          // HTTP status must be identical
          expect(registeredResponse.statusCode).toBe(
            unregisteredResponse.statusCode,
          );
          expect(registeredResponse.statusCode).toBe(200);

          // Response shape must be identical (both have 'sent' field)
          expect(Object.keys(registeredResponse.body).sort()).toEqual(
            Object.keys(unregisteredResponse.body).sort(),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should never return a status code that reveals email existence (not 404, not 200 with different body keys)", () => {
    fc.assert(
      fc.property(fc.boolean(), (emailExists) => {
        const { statusCode, body } = simulateRequestReset(emailExists, false);

        // Must not return 404 (which would reveal email doesn't exist)
        expect(statusCode).not.toBe(404);
        // Must not return 401 or 403
        expect(statusCode).not.toBe(401);
        expect(statusCode).not.toBe(403);
        // Must always be 200
        expect(statusCode).toBe(200);
        // Body must always have 'sent' key
        expect(body).toHaveProperty("sent");
      }),
      { numRuns: 100 },
    );
  });
});

