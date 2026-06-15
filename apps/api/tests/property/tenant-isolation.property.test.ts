// Feature: fitsense-platform, Property 5: Isolasi Tenant — Akses Cross-Club

/**
 * Property 5: Isolasi Tenant — Akses Cross-Club
 *
 * For any user with role `club_owner`, `trainer`, or `member`,
 * any request with a `companyId` different from the `club_id` in their JWT
 * must always return HTTP 403.
 *
 * Validates: Requirements 3.2, 15.1, 15.3, 15.5
 */

import * as fc from "fast-check";
import { Request, Response, NextFunction } from "express";
import { tenantMiddleware } from "../../src/middleware/tenant.middleware";
import { JwtPayload } from "../../src/middleware/auth.middleware";

type Role = JwtPayload["role"];

function makeReq(user: JwtPayload, companyIdParam: string): Partial<Request> {
  return { user, params: { companyId: companyIdParam } } as any;
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
  it("any non-super_admin user accessing a different companyId must receive HTTP 403", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          companyId: fc.uuid(),
          role: fc.constantFrom<Role>("club_owner", "trainer", "member"),
          exp: fc.integer({ min: 1, max: 9999999999 }),
        }),
        fc.uuid(),
        (user, differentcompanyId) => {
          // Ensure the URL companyId is different from the JWT companyId
          fc.pre(user.companyId !== differentcompanyId);

          const req = makeReq(user, differentcompanyId);
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

  it("super_admin must always be allowed regardless of companyId in URL", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          companyId: fc.constant(null),
          role: fc.constant<Role>("super_admin"),
          exp: fc.integer({ min: 1, max: 9999999999 }),
        }),
        fc.uuid(),
        (user, anycompanyId) => {
          const req = makeReq(user, anycompanyId);
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

  it("user accessing their own companyId must be allowed through", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom<Role>("club_owner", "trainer", "member"),
        (userId, companyId, role) => {
          const user: JwtPayload = { userId, companyId, role, exp: 9999999999 };
          // URL companyId matches JWT companyId
          const req = makeReq(user, companyId);
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

  it("403 must be returned for all non-super_admin roles when companyId mismatches", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Role>("club_owner", "trainer", "member"),
        fc.uuid(),
        fc.uuid(),
        (role, jwtcompanyId, urlcompanyId) => {
          fc.pre(jwtcompanyId !== urlcompanyId);

          const user: JwtPayload = {
            userId: "user-id",
            companyId: jwtcompanyId,
            role,
            exp: 9999999999,
          };
          const req = makeReq(user, urlcompanyId);
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

