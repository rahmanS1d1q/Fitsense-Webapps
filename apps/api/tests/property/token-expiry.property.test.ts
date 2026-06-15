// Feature: fitsense-platform, Property 3: Token Login — Masa Berlaku

/**
 * Property 3: Token Login — Masa Berlaku
 *
 * For any valid user login, JWT must have exactly 7 days expiry
 * and MQTT_Token must have exactly 30 minutes expiry.
 *
 * Validates: Requirements 2.1
 */

import * as fc from "fast-check";
import jwt from "jsonwebtoken";
import {
  generateJwt,
  generateMqttToken,
} from "../../src/services/auth.service";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604800
const THIRTY_MINUTES_SECONDS = 30 * 60; // 1800
const TOLERANCE_SECONDS = 5; // allow up to 5s clock drift

describe("Property 3: Token Login — Masa Berlaku", () => {
  it("JWT must expire in exactly 7 days for any valid user", () => {
    fc.assert(
      fc.property(
        // Generate valid user data
        fc.uuid(),
        fc.oneof(fc.uuid(), fc.constant(null)),
        fc.constantFrom("super_admin", "club_owner", "trainer", "member"),
        (userId, companyId, role) => {
          const before = Math.floor(Date.now() / 1000);
          const token = generateJwt(userId, companyId, role);
          const after = Math.floor(Date.now() / 1000);

          const decoded = jwt.decode(token) as { exp: number; iat: number };
          expect(decoded).not.toBeNull();

          const duration = decoded.exp - decoded.iat;
          // Duration must be exactly 7 days (within tolerance)
          expect(duration).toBeGreaterThanOrEqual(
            SEVEN_DAYS_SECONDS - TOLERANCE_SECONDS,
          );
          expect(duration).toBeLessThanOrEqual(
            SEVEN_DAYS_SECONDS + TOLERANCE_SECONDS,
          );

          // exp must be in the future (7 days from now)
          expect(decoded.exp).toBeGreaterThanOrEqual(
            before + SEVEN_DAYS_SECONDS - TOLERANCE_SECONDS,
          );
          expect(decoded.exp).toBeLessThanOrEqual(
            after + SEVEN_DAYS_SECONDS + TOLERANCE_SECONDS,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("MQTT_Token must expire in exactly 30 minutes for any valid user", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.oneof(fc.uuid(), fc.constant(null)),
        fc.constantFrom("super_admin", "club_owner", "trainer", "member"),
        (userId, companyId, role) => {
          const before = Math.floor(Date.now() / 1000);
          const token = generateMqttToken(userId, companyId, role);
          const after = Math.floor(Date.now() / 1000);

          const decoded = jwt.decode(token) as { exp: number; iat: number };
          expect(decoded).not.toBeNull();

          const duration = decoded.exp - decoded.iat;
          // Duration must be exactly 30 minutes (within tolerance)
          expect(duration).toBeGreaterThanOrEqual(
            THIRTY_MINUTES_SECONDS - TOLERANCE_SECONDS,
          );
          expect(duration).toBeLessThanOrEqual(
            THIRTY_MINUTES_SECONDS + TOLERANCE_SECONDS,
          );

          // exp must be in the future (30 minutes from now)
          expect(decoded.exp).toBeGreaterThanOrEqual(
            before + THIRTY_MINUTES_SECONDS - TOLERANCE_SECONDS,
          );
          expect(decoded.exp).toBeLessThanOrEqual(
            after + THIRTY_MINUTES_SECONDS + TOLERANCE_SECONDS,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("JWT and MQTT_Token must have different expiry durations", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom("club_owner", "trainer", "member"),
        (userId, companyId, role) => {
          const jwtToken = generateJwt(userId, companyId, role);
          const mqttToken = generateMqttToken(userId, companyId, role);

          const jwtDecoded = jwt.decode(jwtToken) as {
            exp: number;
            iat: number;
          };
          const mqttDecoded = jwt.decode(mqttToken) as {
            exp: number;
            iat: number;
          };

          const jwtDuration = jwtDecoded.exp - jwtDecoded.iat;
          const mqttDuration = mqttDecoded.exp - mqttDecoded.iat;

          // JWT (7d) must be longer than MQTT_Token (30m)
          expect(jwtDuration).toBeGreaterThan(mqttDuration);
        },
      ),
      { numRuns: 100 },
    );
  });
});

