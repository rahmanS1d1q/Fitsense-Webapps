// Feature: fitsense-platform, Property 2: RBAC — Akses Endpoint Club

/**
 * Property 2: RBAC — Akses Endpoint Club
 *
 * For any user with role other than `super_admin` (i.e., `club_owner`, `trainer`, `member`),
 * every request to club management endpoints (`/api/clubs`) must always return HTTP 403.
 *
 * Validates: Requirements 1.7, 2.6
 */

import * as fc from "fast-check";
import { Request, Response, NextFunction } from "express";
import { rbacMiddleware } from "../../src/middleware/rbac.middleware";
import { JwtPayload } from "../../src/middleware/auth.middleware";

type Role = JwtPayload["role"];

function makeReq(user: JwtPayload): Partial<Request> {
  return { user } as any;
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

// rbacMiddleware for club management endpoints only allows super_admin
const clubMiddleware = rbacMiddleware("super_admin");

describe("Property 2: RBAC — Akses Endpoint Club", () => {
  it("any non-super_admin role must always receive HTTP 403 on club endpoints", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          clubId: fc.uuid(),
          role: fc.constantFrom<Role>("club_owner", "trainer", "member"),
          exp: fc.integer({ min: 1, max: 9999999999 }),
        }),
        (user) => {
          const req = makeReq(user);
          const res = makeRes();
          const next = makeNext();

          clubMiddleware(req as Request, res as Response, next as NextFunction);

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

  it("super_admin must always be allowed through to club endpoints", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          clubId: fc.constant(null),
          role: fc.constant<Role>("super_admin"),
          exp: fc.integer({ min: 1, max: 9999999999 }),
        }),
        (user) => {
          const req = makeReq(user);
          const res = makeRes();
          const next = makeNext();

          clubMiddleware(req as Request, res as Response, next as NextFunction);

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("403 response must not depend on userId or clubId — only on role", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom<Role>("club_owner", "trainer", "member"),
        (userId, clubId, role) => {
          const user: JwtPayload = { userId, clubId, role, exp: 9999999999 };
          const req = makeReq(user);
          const res = makeRes();
          const next = makeNext();

          clubMiddleware(req as Request, res as Response, next as NextFunction);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
