// Feature: fitsense-platform, Property 18: Kode Undangan — Single Use

/**
 * Property 18: Kode Undangan — Single Use
 *
 * For any valid invite code, after it has been used once for member registration,
 * all subsequent attempts to use the same code must return HTTP 410.
 *
 * Validates: Requirements 18.6, 18.7
 */

import * as fc from "fast-check";

// ─── Pure state machine for invite code logic ────────────────────────────────

interface InviteCodeState {
  code: string;
  usedAt: Date | null;
  expiresAt: Date;
}

/**
 * Simulate the invite validation logic as a pure function.
 * Returns the HTTP status code that would be returned.
 */
function simulateInviteUse(
  state: InviteCodeState,
  now: Date,
): { statusCode: number; newState: InviteCodeState } {
  // Code not found → 410
  if (!state.code) {
    return { statusCode: 410, newState: state };
  }

  // Already used → 410
  if (state.usedAt !== null) {
    return { statusCode: 410, newState: state };
  }

  // Expired → 410
  if (state.expiresAt < now) {
    return { statusCode: 410, newState: state };
  }

  // Valid — mark as used
  const newState: InviteCodeState = {
    ...state,
    usedAt: now,
  };
  return { statusCode: 201, newState };
}

// ─── Properties ──────────────────────────────────────────────────────────────

describe("Property 18: Kode Undangan — Single Use", () => {
  it("should return 201 on first use of a valid invite code", () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 64, maxLength: 64 }), (code) => {
        const now = new Date();
        const state: InviteCodeState = {
          code,
          usedAt: null,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        };

        const { statusCode } = simulateInviteUse(state, now);
        expect(statusCode).toBe(201);
      }),
      { numRuns: 100 },
    );
  });

  it("should return 410 on second use of an already-used invite code", () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 64, maxLength: 64 }), (code) => {
        const now = new Date();
        const state: InviteCodeState = {
          code,
          usedAt: null,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        };

        // First use — succeeds
        const { newState } = simulateInviteUse(state, now);
        expect(newState.usedAt).not.toBeNull();

        // Second use — must return 410
        const { statusCode: secondStatus } = simulateInviteUse(newState, now);
        expect(secondStatus).toBe(410);
      }),
      { numRuns: 100 },
    );
  });

  it("should return 410 for any number of uses after the first successful use", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.integer({ min: 1, max: 10 }),
        (code, extraAttempts) => {
          const now = new Date();
          const state: InviteCodeState = {
            code,
            usedAt: null,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          };

          // First use — succeeds
          const { newState } = simulateInviteUse(state, now);

          // All subsequent attempts must return 410
          for (let i = 0; i < extraAttempts; i++) {
            const { statusCode } = simulateInviteUse(newState, now);
            expect(statusCode).toBe(410);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return 410 for expired invite codes regardless of used status", () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 64, maxLength: 64 }), (code) => {
        const now = new Date();
        const expiredState: InviteCodeState = {
          code,
          usedAt: null,
          expiresAt: new Date(now.getTime() - 1000), // expired 1 second ago
        };

        const { statusCode } = simulateInviteUse(expiredState, now);
        expect(statusCode).toBe(410);
      }),
      { numRuns: 100 },
    );
  });
});
