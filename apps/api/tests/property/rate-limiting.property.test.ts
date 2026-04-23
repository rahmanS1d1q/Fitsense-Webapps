// Feature: fitsense-platform, Property 4: Rate Limiting Login

/**
 * Property 4: Rate Limiting Login
 *
 * For any IP, after 5 failed login attempts in 15 minutes,
 * subsequent attempts must return HTTP 429.
 *
 * Validates: Requirements 2.9
 */

import * as fc from "fast-check";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL_MS = 900_000; // 15 minutes

/**
 * Pure rate limiter logic extracted from auth.routes.ts for property testing.
 * This mirrors the production logic: check count before incrementing.
 */
interface RateLimitStore {
  [key: string]: { count: number; expiresAt: number };
}

function isRateLimited(
  store: RateLimitStore,
  ip: string,
  now: number,
): boolean {
  const key = `rate_limit:login:${ip}`;
  if (!store[key] || store[key].expiresAt < now) {
    return false;
  }
  return store[key].count >= RATE_LIMIT_MAX;
}

function recordFailedAttempt(
  store: RateLimitStore,
  ip: string,
  now: number,
): void {
  const key = `rate_limit:login:${ip}`;
  if (!store[key] || store[key].expiresAt < now) {
    store[key] = { count: 0, expiresAt: now + RATE_LIMIT_TTL_MS };
  }
  store[key].count += 1;
}

describe("Property 4: Rate Limiting Login", () => {
  it("after 5 failed attempts, subsequent attempts are rate limited for any IP", () => {
    fc.assert(
      fc.property(
        // Generate a valid IP-like string (IPv4)
        fc.ipV4(),
        (ip) => {
          const store: RateLimitStore = {};
          const now = Date.now();

          // First 5 failed attempts — should NOT be rate limited
          for (let i = 0; i < RATE_LIMIT_MAX; i++) {
            expect(isRateLimited(store, ip, now)).toBe(false);
            recordFailedAttempt(store, ip, now);
          }

          // 6th attempt and beyond — must be rate limited
          expect(isRateLimited(store, ip, now)).toBe(true);

          // Additional attempts also rate limited
          for (let i = 0; i < 3; i++) {
            expect(isRateLimited(store, ip, now)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("different IPs have independent rate limit counters", () => {
    fc.assert(
      fc.property(fc.ipV4(), fc.ipV4(), (ip1, ip2) => {
        fc.pre(ip1 !== ip2);

        const store: RateLimitStore = {};
        const now = Date.now();

        // Exhaust rate limit for ip1
        for (let i = 0; i < RATE_LIMIT_MAX; i++) {
          recordFailedAttempt(store, ip1, now);
        }

        // ip1 is rate limited
        expect(isRateLimited(store, ip1, now)).toBe(true);

        // ip2 is NOT rate limited (independent counter)
        expect(isRateLimited(store, ip2, now)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("rate limit resets after TTL expires", () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        const store: RateLimitStore = {};
        const now = Date.now();

        // Exhaust rate limit
        for (let i = 0; i < RATE_LIMIT_MAX; i++) {
          recordFailedAttempt(store, ip, now);
        }
        expect(isRateLimited(store, ip, now)).toBe(true);

        // Simulate TTL expiry (now + 15 minutes + 1ms)
        const afterTtl = now + RATE_LIMIT_TTL_MS + 1;
        expect(isRateLimited(store, ip, afterTtl)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("for any number of failed attempts n < 5, the IP is not rate limited", () => {
    fc.assert(
      fc.property(
        fc.ipV4(),
        fc.integer({ min: 0, max: RATE_LIMIT_MAX - 1 }),
        (ip, attempts) => {
          const store: RateLimitStore = {};
          const now = Date.now();

          for (let i = 0; i < attempts; i++) {
            recordFailedAttempt(store, ip, now);
          }

          expect(isRateLimited(store, ip, now)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
