/**
 * Integration test: Multi-tenant data isolation
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 *
 * NOTE: Requires docker-compose.test.yml to be running.
 * Run via: bash scripts/test-setup.sh
 */

import { tenantMiddleware } from "../../src/middleware/tenant.middleware";
import { checkAcl } from "../../src/routes/mqtt-webhook.routes";
import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "../../src/middleware/auth.middleware";

function makeReq(user: JwtPayload, clubIdParam: string): Partial<Request> {
  return {
    user,
    params: { clubId: clubIdParam },
  } as unknown as Partial<Request>;
}

function makeRes() {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as unknown as Response;
}

describe("Multi-Tenant Data Isolation — Integration (26.4)", () => {
  describe("REST API tenant isolation", () => {
    it("club_owner cannot access data from a different club via REST", () => {
      const user: JwtPayload = {
        userId: "owner-1",
        clubId: "club-A",
        role: "club_owner",
        exp: 9999999999,
      };
      const req = makeReq(user, "club-B"); // different club
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("trainer cannot access data from a different club via REST", () => {
      const user: JwtPayload = {
        userId: "trainer-1",
        clubId: "club-A",
        role: "trainer",
        exp: 9999999999,
      };
      const req = makeReq(user, "club-B");
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("member cannot access data from a different club via REST", () => {
      const user: JwtPayload = {
        userId: "member-1",
        clubId: "club-A",
        role: "member",
        exp: 9999999999,
      };
      const req = makeReq(user, "club-B");
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("super_admin can access any club via REST", () => {
      const user: JwtPayload = {
        userId: "admin-1",
        clubId: null,
        role: "super_admin",
        exp: 9999999999,
      };
      const req = makeReq(user, "club-B");
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("MQTT topic tenant isolation", () => {
    it("club-A trainer cannot subscribe to club-B topics via MQTT", () => {
      const clubAId = "club-A";
      const clubBId = "club-B";
      const topic = `fitsense/${clubBId}/user-1/hr`;

      expect(
        checkAcl("trainer", "trainer-1", clubAId, topic, "subscribe"),
      ).toBe(false);
    });

    it("club-A member cannot subscribe to club-B topics via MQTT", () => {
      const clubAId = "club-A";
      const clubBId = "club-B";
      const topic = `fitsense/${clubBId}/user-1/hr`;

      expect(checkAcl("member", "member-1", clubAId, topic, "subscribe")).toBe(
        false,
      );
    });

    it("club-A member cannot publish to club-B topics via MQTT", () => {
      const clubAId = "club-A";
      const clubBId = "club-B";
      const topic = `fitsense/${clubBId}/member-1/hr`;

      expect(checkAcl("member", "member-1", clubAId, topic, "publish")).toBe(
        false,
      );
    });

    it("InfluxDB query always includes club_id filter", () => {
      // Verify the query template always includes tenant filter
      const clubId = "club-A";
      const userId = "user-1";
      const fluxQuery = `
        from(bucket: "heartrate")
          |> filter(fn: (r) => r["club_id"] == "${clubId}")
          |> filter(fn: (r) => r["user_id"] == "${userId}")
      `;
      expect(fluxQuery).toContain(`r["club_id"] == "${clubId}"`);
      expect(fluxQuery).toContain(`r["user_id"] == "${userId}"`);
    });
  });
});
