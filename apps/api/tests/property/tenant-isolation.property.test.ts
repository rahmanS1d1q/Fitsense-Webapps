// Feature: fitsense-platform, Property 5: Isolasi Tenant — Akses Cross-Club

/**
 * Property 5: Isolasi Tenant — Akses Cross-Club
 *
 * For any user with role `club_owner`, `trainer`, or `member`,
 * any request with a `clubId` different from the `club_id` in their JWT
 * must always return HTTP 403.
 *
 * Validates: Requirements 3.2, 15.1, 15.3, 15.5
 */

import * as fc from "fast-check";
import { Request, Response, NextFunction } from "express";
import { tenantMiddleware } from "../../src/middleware/tenant.middleware";
import { JwtPayload } from "../../src/middleware/auth.middleware";

type Role = JwtPayload["role"];

function makeReq(user: JwtPayload, clubIdParam: string): Partial<Request> {
  return { user, params: { clubId: clubIdParam } } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeNext(): jest.Mock {
  return jest.fn();
}

describe("Property 5: Isolasi Tenant — Akses Cross-Club", () => {
  it("any non-super_admin user accessing a different clubId must receive HTTP 403", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          clubId: fc.uuid(),
          role: fc.constantFrom<Role>("club_owner", "trainer", "member"),
          exp: fc.integer({ min: 1, max: 9999999999 }),
        }),
        fc.uuid(),
        (user, differentClubId) => {
          // Ensure the URL clubId is different from the JWT clubId
          fc.pre(user.clubId !== differentClubId);

          const req = makeReq(user, differentClubId);
          const res = makeRes();
          const next = makeNext();

          tenantMiddleware(
            req as Request,
            res as Response,
            next as NextFunction,
          );

          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({ code: "FORBIDDEN" }),
            }),
          );
          expect(next).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("super_admin must always be allowed regardless of clubId in URL", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          clubId: fc.constant(null),
          role: fc.constant<Role>("super_admin"),
          exp: fc.integer({ min: 1, max: 9999999999 }),
        }),
        fc.uuid(),
        (user, anyClubId) => {
          const req = makeReq(user, anyClubId);
          const res = makeRes();
          const next = makeNext();

          tenantMiddleware(
            req as Request,
            res as Response,
            next as NextFunction,
          );

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("user accessing their own clubId must be allowed through", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom<Role>("club_owner", "trainer", "member"),
        (userId, clubId, role) => {
          const user: JwtPayload = { userId, clubId, role, exp: 9999999999 };
          // URL clubId matches JWT clubId
          const req = makeReq(user, clubId);
          const res = makeRes();
          const next = makeNext();

          tenantMiddleware(
            req as Request,
            res as Response,
            next as NextFunction,
          );

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("403 must be returned for all non-super_admin roles when clubId mismatches", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Role>("club_owner", "trainer", "member"),
        fc.uuid(),
        fc.uuid(),
        (role, jwtClubId, urlClubId) => {
          fc.pre(jwtClubId !== urlClubId);

          const user: JwtPayload = {
            userId: "user-id",
            clubId: jwtClubId,
            role,
            exp: 9999999999,
          };
          const req = makeReq(user, urlClubId);
          const res = makeRes();
          const next = makeNext();

          tenantMiddleware(
            req as Request,
            res as Response,
            next as NextFunction,
          );

          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
