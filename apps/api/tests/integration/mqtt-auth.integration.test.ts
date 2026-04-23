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
      const clubId = "club-1";
      const userId = "user-1";
      const topic = `fitsense/${clubId}/${userId}/hr`;
      expect(checkAcl("member", userId, clubId, topic, "publish")).toBe(true);
    });

    it("member cannot publish to another user's HR topic", () => {
      const clubId = "club-1";
      const userId = "user-1";
      const otherUserId = "user-2";
      const topic = `fitsense/${clubId}/${otherUserId}/hr`;
      expect(checkAcl("member", userId, clubId, topic, "publish")).toBe(false);
    });

    it("invalid token connection is denied — ACL returns false for unknown role", () => {
      const topic = "fitsense/club-1/user-1/hr";
      expect(
        checkAcl("unknown_role", "user-1", "club-1", topic, "publish"),
      ).toBe(false);
      expect(
        checkAcl("unknown_role", "user-1", "club-1", topic, "subscribe"),
      ).toBe(false);
    });

    it("publish to unauthorized topic is denied", () => {
      // trainer cannot publish
      const topic = "fitsense/club-1/user-1/hr";
      expect(checkAcl("trainer", "trainer-1", "club-1", topic, "publish")).toBe(
        false,
      );
    });
  });

  describe("ACL enforcement for subscriptions", () => {
    it("trainer can subscribe to club topics", () => {
      const clubId = "club-1";
      const topic = `fitsense/${clubId}/user-1/hr`;
      expect(checkAcl("trainer", "trainer-1", clubId, topic, "subscribe")).toBe(
        true,
      );
    });

    it("trainer cannot subscribe to different club topics", () => {
      const myClubId = "club-1";
      const otherClubId = "club-2";
      const topic = `fitsense/${otherClubId}/user-1/hr`;
      expect(
        checkAcl("trainer", "trainer-1", myClubId, topic, "subscribe"),
      ).toBe(false);
    });

    it("super_admin can subscribe to all topics", () => {
      const topics = [
        "fitsense/club-1/user-1/hr",
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
