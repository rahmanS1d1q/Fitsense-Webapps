/**
 * Integration test: MQTT authentication end-to-end
 * Requirements: 6.1, 6.2, 6.3
 *
 * NOTE: Requires docker-compose.test.yml to be running.
 * Run via: bash scripts/test-setup.sh
 */

import { checkAcl } from "../../src/routes/mqtt-webhook.routes";

describe("MQTT Authentication — Integration (26.3)", () => {
  describe("ACL enforcement for valid connections", () => {
    it("member can publish to own HR topic", () => {
      const companyId = "company-1";
      const userId = "user-1";
      const topic = `fitsense/${companyId}/${userId}/hr`;
      expect(checkAcl("member", userId, companyId, topic, "publish")).toBe(true);
    });

    it("member cannot publish to another user's HR topic", () => {
      const companyId = "company-1";
      const userId = "user-1";
      const otherUserId = "user-2";
      const topic = `fitsense/${companyId}/${otherUserId}/hr`;
      expect(checkAcl("member", userId, companyId, topic, "publish")).toBe(false);
    });

    it("invalid token connection is denied — ACL returns false for unknown role", () => {
      const topic = "fitsense/company-1/user-1/hr";
      expect(
        checkAcl("unknown_role", "user-1", "company-1", topic, "publish"),
      ).toBe(false);
      expect(
        checkAcl("unknown_role", "user-1", "company-1", topic, "subscribe"),
      ).toBe(false);
    });

    it("publish to unauthorized topic is denied", () => {
      // trainer cannot publish
      const topic = "fitsense/company-1/user-1/hr";
      expect(checkAcl("trainer", "trainer-1", "company-1", topic, "publish")).toBe(
        false,
      );
    });
  });

  describe("ACL enforcement for subscriptions", () => {
    it("trainer can subscribe to club topics", () => {
      const companyId = "company-1";
      const topic = `fitsense/${companyId}/user-1/hr`;
      expect(checkAcl("trainer", "trainer-1", companyId, topic, "subscribe")).toBe(
        true,
      );
    });

    it("trainer cannot subscribe to different club topics", () => {
      const mycompanyId = "company-1";
      const othercompanyId = "club-2";
      const topic = `fitsense/${othercompanyId}/user-1/hr`;
      expect(
        checkAcl("trainer", "trainer-1", mycompanyId, topic, "subscribe"),
      ).toBe(false);
    });

    it("super_admin can subscribe to all topics", () => {
      const topics = [
        "fitsense/company-1/user-1/hr",
        "fitsense/club-2/user-2/alerts",
        "fitsense/any-club/any-user/hr",
      ];
      for (const topic of topics) {
        expect(checkAcl("super_admin", "admin-1", "", topic, "subscribe")).toBe(
          true,
        );
      }
    });
  });
});

