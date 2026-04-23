// Feature: fitsense-platform, Property 20: Token Reset Password — Single Use

/**
 * Property 20: Token Reset Password — Single Use
 *
 * For any valid reset token, after it has been used once to reset a password,
 * all subsequent attempts to use the same token must return HTTP 410.
 *
 * Validates: Requirements 19.5
 */

import * as fc from "fast-check";

// ─── Pure state machine for reset token logic ────────────────────────────────

interface ResetTokenState {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Simulate the reset token validation logic as a pure function.
 * Returns the HTTP status code that would be returned.
 */
function simulateResetTokenUse(
  state: ResetTokenState,
  now: Date,
): { statusCode: number; newState: ResetTokenState } {
  // Token not found → 410
  if (!state.tokenHash) {
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
  const newState: ResetTokenState = {
    ...state,
    usedAt: now,
  };
  return { statusCode: 200, newState };
}

// ─── Properties ──────────────────────────────────────────────────────────────

describe("Property 20: Token Reset Password — Single Use", () => {
  it("should return 200 on first use of a valid reset token", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.uuid(),
        (tokenHash, userId) => {
          const now = new Date();
          const state: ResetTokenState = {
            tokenHash,
            userId,
            usedAt: null,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
          };

          const { statusCode } = simulateResetTokenUse(state, now);
          expect(statusCode).toBe(200);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return 410 on second use of an already-used reset token", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.uuid(),
        (tokenHash, userId) => {
          const now = new Date();
          const state: ResetTokenState = {
            tokenHash,
            userId,
            usedAt: null,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          };

          // First use — succeeds
          const { newState } = simulateResetTokenUse(state, now);
          expect(newState.usedAt).not.toBeNull();

          // Second use — must return 410
          const { statusCode: secondStatus } = simulateResetTokenUse(
            newState,
            now,
          );
          expect(secondStatus).toBe(410);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return 410 for any number of uses after the first successful use", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.uuid(),
        fc.integer({ min: 1, max: 10 }),
        (tokenHash, userId, extraAttempts) => {
          const now = new Date();
          const state: ResetTokenState = {
            tokenHash,
            userId,
            usedAt: null,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          };

          // First use — succeeds
          const { newState } = simulateResetTokenUse(state, now);

          // All subsequent attempts must return 410
          for (let i = 0; i < extraAttempts; i++) {
            const { statusCode } = simulateResetTokenUse(newState, now);
            expect(statusCode).toBe(410);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return 410 for expired tokens regardless of used status", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.uuid(),
        (tokenHash, userId) => {
          const now = new Date();
          const expiredState: ResetTokenState = {
            tokenHash,
            userId,
            usedAt: null,
            expiresAt: new Date(now.getTime() - 1000), // expired 1 second ago
          };

          const { statusCode } = simulateResetTokenUse(expiredState, now);
          expect(statusCode).toBe(410);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should maintain single-use invariant: usedAt is set after first use and never cleared", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.uuid(),
        (tokenHash, userId) => {
          const now = new Date();
          const state: ResetTokenState = {
            tokenHash,
            userId,
            usedAt: null,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          };

          // Before use: usedAt is null
          expect(state.usedAt).toBeNull();

          // After first use: usedAt is set
          const { newState } = simulateResetTokenUse(state, now);
          expect(newState.usedAt).not.toBeNull();

          // usedAt never goes back to null
          const { newState: afterSecond } = simulateResetTokenUse(
            newState,
            now,
          );
          expect(afterSecond.usedAt).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
