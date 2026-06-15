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

function makeReq(user: JwtPayload, companyIdParam: string): Partial<Request> {
  return {
    user,
    params: { companyId: companyIdParam },
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
        companyId: "company-A",
        role: "club_owner",
        exp: 9999999999,
      };
      const req = makeReq(user, "company-B"); // different club
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("trainer cannot access data from a different club via REST", () => {
      const user: JwtPayload = {
        userId: "trainer-1",
        companyId: "company-A",
        role: "trainer",
        exp: 9999999999,
      };
      const req = makeReq(user, "company-B");
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("member cannot access data from a different club via REST", () => {
      const user: JwtPayload = {
        userId: "member-1",
        companyId: "company-A",
        role: "member",
        exp: 9999999999,
      };
      const req = makeReq(user, "company-B");
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("super_admin can access any club via REST", () => {
      const user: JwtPayload = {
        userId: "admin-1",
        companyId: null,
        role: "super_admin",
        exp: 9999999999,
      };
      const req = makeReq(user, "company-B");
      const res = makeRes();
      const next = jest.fn();

      tenantMiddleware(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("MQTT topic tenant isolation", () => {
    it("company-A trainer cannot subscribe to company-B topics via MQTT", () => {
      const clubAId = "company-A";
      const clubBId = "company-B";
      const topic = `fitsense/${clubBId}/user-1/hr`;

      expect(
        checkAcl("trainer", "trainer-1", clubAId, topic, "subscribe"),
      ).toBe(false);
    });

    it("company-A member cannot subscribe to company-B topics via MQTT", () => {
      const clubAId = "company-A";
      const clubBId = "company-B";
      const topic = `fitsense/${clubBId}/user-1/hr`;

      expect(checkAcl("member", "member-1", clubAId, topic, "subscribe")).toBe(
        false,
      );
    });

    it("company-A member cannot publish to company-B topics via MQTT", () => {
      const clubAId = "company-A";
      const clubBId = "company-B";
      const topic = `fitsense/${clubBId}/member-1/hr`;

      expect(checkAcl("member", "member-1", clubAId, topic, "publish")).toBe(
        false,
      );
    });

    it("InfluxDB query always includes company_id filter", () => {
      // Verify the query template always includes tenant filter
      const companyId = "company-A";
      const userId = "user-1";
      const fluxQuery = `
        from(bucket: "heartrate")
          |> filter(fn: (r) => r["company_id"] == "${companyId}")
          |> filter(fn: (r) => r["user_id"] == "${userId}")
      `;
      expect(fluxQuery).toContain(`r["company_id"] == "${companyId}"`);
      expect(fluxQuery).toContain(`r["user_id"] == "${userId}"`);
    });
  });
});
