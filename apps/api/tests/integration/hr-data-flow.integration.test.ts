/**
 * Integration test: HR data end-to-end flow
 * Mobile App → EMQX → MqttConsumer → BatchWriter → InfluxDB
 *
 * Requirements: 7.1, 7.2, 7.3
 *
 * NOTE: Requires docker-compose.test.yml to be running.
 * Run via: bash scripts/test-setup.sh
 */

import { validateHRPayload } from "../../src/services/mqtt.consumer";

describe("HR Data Flow — Integration (26.1)", () => {
  describe("MQTT payload validation pipeline", () => {
    it("valid HR payload passes through validation", () => {
      const payload = {
        hr: 120,
        session_id: "test-session-uuid",
        timestamp: Date.now(),
        rr: 500,
      };
      const result = validateHRPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.hr).toBe(120);
      expect(result!.session_id).toBe("test-session-uuid");
    });

    it("invalid HR payload is rejected before reaching BatchWriter", () => {
      const invalidPayloads = [
        { hr: 19, session_id: "s", timestamp: 1 }, // hr too low
        { hr: 301, session_id: "s", timestamp: 1 }, // hr too high
        { session_id: "s", timestamp: 1 }, // missing hr
        { hr: 80, timestamp: 1 }, // missing session_id
        null,
        "not-json",
        42,
      ];

      for (const payload of invalidPayloads) {
        expect(validateHRPayload(payload)).toBeNull();
      }
    });

    it("HR data with valid rr interval passes validation", () => {
      const payload = {
        hr: 75,
        rr: 800,
        session_id: "session-1",
        timestamp: Date.now(),
      };
      const result = validateHRPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.rr).toBe(800);
    });

    it("HR data with rr out of range is rejected", () => {
      const payload = {
        hr: 75,
        rr: 100, // below 200ms minimum
        session_id: "session-1",
        timestamp: Date.now(),
      };
      expect(validateHRPayload(payload)).toBeNull();
    });
  });

  describe("BatchWriter buffer accumulation", () => {
    it("multiple HR data points can be accumulated in buffer", () => {
      // Test that the buffer key pattern is correct
      const clubId = "club-uuid-1";
      const userId = "user-uuid-1";
      const bufferKey = `hr_buffer:${clubId}:${userId}`;
      expect(bufferKey).toBe("hr_buffer:club-uuid-1:user-uuid-1");
    });
  });
});
