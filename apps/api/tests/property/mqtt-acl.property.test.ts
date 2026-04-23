// Feature: fitsense-platform, Property 7: ACL MQTT — Enforcement Komprehensif

/**
 * Property 7: ACL MQTT — Enforcement Komprehensif
 *
 * For any combination of (role, topic, action), the checkAcl function must
 * produce a decision consistent with the ACL matrix:
 *
 * - member      : allow publish to fitsense/{club_id}/{user_id}/hr (own only)
 *                 allow subscribe to fitsense/{club_id}/{user_id}/hr (own only)
 *                 allow subscribe to fitsense/{club_id}/{user_id}/alerts (own only)
 *                 deny all else
 * - trainer /
 *   club_owner  : deny all publish
 *                 allow subscribe to fitsense/{club_id}/# (own club)
 *                 allow subscribe to fitsense/{club_id}/+/alerts (own club)
 * - super_admin : deny all publish
 *                 allow subscribe to fitsense/#
 * - ml_service  : allow publish to fitsense/{club_id}/{user_id}/alerts only
 *                 deny all else
 *
 * Validates: Requirements 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11
 */

import * as fc from "fast-check";
import { checkAcl } from "../../src/routes/mqtt-webhook.routes";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();

const roleArb = fc.constantFrom(
  "member",
  "trainer",
  "club_owner",
  "super_admin",
  "ml_service",
);

const actionArb = fc.constantFrom<"publish" | "subscribe">(
  "publish",
  "subscribe",
);

// Build a topic that looks like a real fitsense topic
const topicArb = (clubId: string, userId: string) =>
  fc.oneof(
    fc.constant(`fitsense/${clubId}/${userId}/hr`),
    fc.constant(`fitsense/${clubId}/${userId}/alerts`),
    fc.constant(`fitsense/${clubId}/#`),
    fc.constant(`fitsense/${clubId}/+/alerts`),
    fc.constant(`fitsense/#`),
    // arbitrary other club/user combos
    fc.tuple(fc.uuid(), fc.uuid()).map(([c, u]) => `fitsense/${c}/${u}/hr`),
    fc.tuple(fc.uuid(), fc.uuid()).map(([c, u]) => `fitsense/${c}/${u}/alerts`),
    fc.string({ minLength: 1, maxLength: 60 }),
  );

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Property 7: ACL MQTT — Enforcement Komprehensif", () => {
  // ── member ──────────────────────────────────────────────────────────────────

  it("member: hanya boleh publish ke topik hr miliknya sendiri", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const ownHr = `fitsense/${clubId}/${userId}/hr`;
        return checkAcl("member", userId, clubId, ownHr, "publish") === true;
      }),
      { numRuns: 100 },
    );
  });

  it("member: tidak boleh publish ke topik hr milik user lain", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, otherId) => {
        fc.pre(userId !== otherId);
        const otherHr = `fitsense/${clubId}/${otherId}/hr`;
        return checkAcl("member", userId, clubId, otherHr, "publish") === false;
      }),
      { numRuns: 100 },
    );
  });

  it("member: tidak boleh publish ke topik alerts (miliknya sendiri maupun orang lain)", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const ownAlerts = `fitsense/${clubId}/${userId}/alerts`;
        return (
          checkAcl("member", userId, clubId, ownAlerts, "publish") === false
        );
      }),
      { numRuns: 100 },
    );
  });

  it("member: boleh subscribe ke topik hr miliknya sendiri", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const ownHr = `fitsense/${clubId}/${userId}/hr`;
        return checkAcl("member", userId, clubId, ownHr, "subscribe") === true;
      }),
      { numRuns: 100 },
    );
  });

  it("member: boleh subscribe ke topik alerts miliknya sendiri", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const ownAlerts = `fitsense/${clubId}/${userId}/alerts`;
        return (
          checkAcl("member", userId, clubId, ownAlerts, "subscribe") === true
        );
      }),
      { numRuns: 100 },
    );
  });

  it("member: tidak boleh subscribe ke topik hr atau alerts milik user lain", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, otherId) => {
        fc.pre(userId !== otherId);
        const otherHr = `fitsense/${clubId}/${otherId}/hr`;
        const otherAlerts = `fitsense/${clubId}/${otherId}/alerts`;
        return (
          checkAcl("member", userId, clubId, otherHr, "subscribe") === false &&
          checkAcl("member", userId, clubId, otherAlerts, "subscribe") === false
        );
      }),
      { numRuns: 100 },
    );
  });

  // ── trainer / club_owner ─────────────────────────────────────────────────────

  it("trainer: deny semua publish", () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        actionArb,
        (clubId, userId, otherId, _action) => {
          const topics = [
            `fitsense/${clubId}/${userId}/hr`,
            `fitsense/${clubId}/${userId}/alerts`,
            `fitsense/${clubId}/#`,
          ];
          return topics.every(
            (t) => checkAcl("trainer", userId, clubId, t, "publish") === false,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("club_owner: deny semua publish", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const topics = [
          `fitsense/${clubId}/${userId}/hr`,
          `fitsense/${clubId}/${userId}/alerts`,
          `fitsense/${clubId}/#`,
        ];
        return topics.every(
          (t) => checkAcl("club_owner", userId, clubId, t, "publish") === false,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("trainer: boleh subscribe ke fitsense/{club_id}/# (topik dalam club sendiri)", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, memberId) => {
        const hrTopic = `fitsense/${clubId}/${memberId}/hr`;
        const alertsTopic = `fitsense/${clubId}/${memberId}/alerts`;
        return (
          checkAcl("trainer", userId, clubId, hrTopic, "subscribe") === true &&
          checkAcl("trainer", userId, clubId, alertsTopic, "subscribe") === true
        );
      }),
      { numRuns: 100 },
    );
  });

  it("trainer: tidak boleh subscribe ke topik club lain", () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        (clubId, otherClubId, userId, memberId) => {
          fc.pre(clubId !== otherClubId);
          const otherTopic = `fitsense/${otherClubId}/${memberId}/hr`;
          return (
            checkAcl("trainer", userId, clubId, otherTopic, "subscribe") ===
            false
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("club_owner: boleh subscribe ke fitsense/{club_id}/# (topik dalam club sendiri)", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, memberId) => {
        const hrTopic = `fitsense/${clubId}/${memberId}/hr`;
        return (
          checkAcl("club_owner", userId, clubId, hrTopic, "subscribe") === true
        );
      }),
      { numRuns: 100 },
    );
  });

  // ── super_admin ──────────────────────────────────────────────────────────────

  it("super_admin: deny semua publish", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, memberId) => {
        const topics = [
          `fitsense/${clubId}/${memberId}/hr`,
          `fitsense/${clubId}/${memberId}/alerts`,
          `fitsense/#`,
        ];
        return topics.every(
          (t) =>
            checkAcl("super_admin", userId, clubId, t, "publish") === false,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("super_admin: boleh subscribe ke fitsense/# (semua topik)", () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        (clubId, userId, c, u) => {
          const topics = [
            `fitsense/${c}/${u}/hr`,
            `fitsense/${c}/${u}/alerts`,
            `fitsense/${clubId}/#`,
            `fitsense/#`,
          ];
          return topics.every(
            (t) =>
              checkAcl("super_admin", userId, clubId, t, "subscribe") === true,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── ml_service ───────────────────────────────────────────────────────────────

  it("ml_service: boleh publish ke fitsense/{club_id}/{user_id}/alerts", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const alertsTopic = `fitsense/${clubId}/${userId}/alerts`;
        return (
          checkAcl("ml_service", userId, clubId, alertsTopic, "publish") ===
          true
        );
      }),
      { numRuns: 100 },
    );
  });

  it("ml_service: tidak boleh publish ke topik hr", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (clubId, userId) => {
        const hrTopic = `fitsense/${clubId}/${userId}/hr`;
        return (
          checkAcl("ml_service", userId, clubId, hrTopic, "publish") === false
        );
      }),
      { numRuns: 100 },
    );
  });

  it("ml_service: tidak boleh publish ke topik alerts milik user lain", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, otherId) => {
        fc.pre(userId !== otherId);
        const otherAlerts = `fitsense/${clubId}/${otherId}/alerts`;
        return (
          checkAcl("ml_service", userId, clubId, otherAlerts, "publish") ===
          false
        );
      }),
      { numRuns: 100 },
    );
  });

  it("ml_service: deny semua subscribe", () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (clubId, userId, memberId) => {
        const topics = [
          `fitsense/${clubId}/${memberId}/hr`,
          `fitsense/${clubId}/${memberId}/alerts`,
          `fitsense/${clubId}/#`,
          `fitsense/#`,
        ];
        return topics.every(
          (t) =>
            checkAcl("ml_service", userId, clubId, t, "subscribe") === false,
        );
      }),
      { numRuns: 100 },
    );
  });

  // ── unknown role ─────────────────────────────────────────────────────────────

  it("role tidak dikenal: deny semua aksi", () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        actionArb,
        (clubId, userId, memberId, action) => {
          const topic = `fitsense/${clubId}/${memberId}/hr`;
          const act = action as "publish" | "subscribe";
          return checkAcl("unknown_role", userId, clubId, topic, act) === false;
        },
      ),
      { numRuns: 100 },
    );
  });
});
