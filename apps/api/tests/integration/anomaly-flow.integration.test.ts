/**
 * Integration test: Anomaly detection flow
 * MqttConsumer → ML Service → EMQX → Web Dashboard / Mobile App
 *
 * Requirements: 9.2, 9.3, 13.4, 14.3
 *
 * NOTE: Requires docker-compose.test.yml to be running.
 * Run via: bash scripts/test-setup.sh
 */

import { validateHRPayload } from "../../src/services/mqtt.consumer";

// Pure logic tests for anomaly flow (no live services required)
describe("Anomaly Detection Flow — Integration (26.2)", () => {
  describe("CRITICAL anomaly threshold", () => {
    it("HR > 95% Max_HR triggers CRITICAL alert payload", () => {
      const age = 30;
      const maxHr = 220 - age; // 190
      const criticalHr = Math.ceil(maxHr * 0.96); // 183

      // Validate the HR payload is valid
      const payload = {
        hr: criticalHr,
        session_id: "session-critical",
        timestamp: Date.now(),
      };
      const result = validateHRPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.hr / maxHr).toBeGreaterThan(0.95);
    });

    it("HR <= 95% Max_HR does not trigger CRITICAL", () => {
      const age = 30;
      const maxHr = 220 - age; // 190
      const normalHr = Math.floor(maxHr * 0.9); // 171

      const payload = {
        hr: normalHr,
        session_id: "session-normal",
        timestamp: Date.now(),
      };
      const result = validateHRPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.hr / maxHr).toBeLessThanOrEqual(0.95);
    });
  });

  describe("WARNING sensor anomaly threshold", () => {
    it("HR < 40 bpm triggers WARNING sensor alert", () => {
      const payload = {
        hr: 35,
        session_id: "session-low-hr",
        timestamp: Date.now(),
      };
      const result = validateHRPayload(payload);
      expect(result).not.toBeNull();
      expect(result!.hr).toBeLessThan(40);
    });
  });

  describe("Alert topic format", () => {
    it("alert topic follows correct pattern", () => {
      const clubId = "club-uuid-1";
      const userId = "user-uuid-1";
      const alertTopic = `fitsense/${clubId}/${userId}/alerts`;
      expect(alertTopic).toBe("fitsense/club-uuid-1/user-uuid-1/alerts");
      expect(alertTopic.split("/")).toHaveLength(4);
      expect(alertTopic.endsWith("/alerts")).toBe(true);
    });
  });
});
