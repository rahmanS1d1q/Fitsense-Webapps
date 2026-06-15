/**
 * Unit tests for ClubService
 * Requirements: 1.2, 1.7
 */

jest.mock("../../src/db/client");
jest.mock("../../src/middleware/rbac.middleware", () => ({
  rbacMiddleware: jest.requireActual("../../src/middleware/rbac.middleware")
    .rbacMiddleware,
}));

import * as ClubService from "../../src/services/club.service";
import { getPool } from "../../src/db/client";
import { rbacMiddleware } from "../../src/middleware/rbac.middleware";
import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "../../src/middleware/auth.middleware";

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

function makeMockClient(rows: Record<string, unknown>[] = []) {
  const client = {
    query: jest.fn().mockResolvedValue({ rows }),
    release: jest.fn(),
  };
  return client;
}

function makeMockPool(rows: Record<string, unknown>[] = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
    connect: jest.fn(),
  } as unknown as ReturnType<typeof getPool>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── ClubService.listClubs ────────────────────────────────────────────────────

describe("ClubService.listClubs", () => {
  it("should return all clubs from the database", async () => {
    const fakeClubs = [
      {
        id: "company-1",
        name: "Gym A",
        slug: "gym-a",
        address: null,
        phone: null,
        status: "active",
        created_at: new Date(),
      },
    ];
    mockGetPool.mockReturnValue(makeMockPool(fakeClubs));

    const result = await ClubService.listClubs();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("gym-a");
  });
});

// ─── ClubService.updateClub ───────────────────────────────────────────────────

describe("ClubService.updateClub", () => {
  it("should throw HTTP 409 when slug is already used by another club", async () => {
    const pool = makeMockPool();
    // First query: slug uniqueness check returns a conflict
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: "other-club" }],
    });
    mockGetPool.mockReturnValue(pool);

    await expect(
      ClubService.updateClub("company-1", { slug: "taken-slug" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("should throw HTTP 400 when slug format is invalid", async () => {
    mockGetPool.mockReturnValue(makeMockPool());

    await expect(
      ClubService.updateClub("company-1", { slug: "INVALID SLUG!" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw HTTP 404 when club does not exist", async () => {
    const pool = makeMockPool();
    // slug check: no conflict
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // slug uniqueness check
      .mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing
    mockGetPool.mockReturnValue(pool);

    await expect(
      ClubService.updateClub("nonexistent-id", { slug: "valid-slug" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should return updated club on success", async () => {
    const updatedClub = {
      id: "company-1",
      name: "New Name",
      slug: "new-slug",
      address: null,
      phone: null,
      status: "active",
      created_at: new Date(),
    };
    const pool = makeMockPool();
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // slug uniqueness check
      .mockResolvedValueOnce({ rows: [updatedClub] }); // UPDATE
    mockGetPool.mockReturnValue(pool);

    const result = await ClubService.updateClub("company-1", {
      slug: "new-slug",
      name: "New Name",
    });
    expect(result.slug).toBe("new-slug");
    expect(result.name).toBe("New Name");
  });
});

// ─── ClubService.suspendClub ──────────────────────────────────────────────────

describe("ClubService.suspendClub", () => {
  it("should throw HTTP 404 when club does not exist", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE clubs → not found
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const pool = makeMockPool();
    (pool.connect as jest.Mock).mockResolvedValue(client);
    mockGetPool.mockReturnValue(pool);

    await expect(
      ClubService.suspendClub("nonexistent-id"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("should suspend club and set all users to inactive", async () => {
    const client = makeMockClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "company-1" }] }) // UPDATE clubs
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const pool = makeMockPool();
    (pool.connect as jest.Mock).mockResolvedValue(client);
    mockGetPool.mockReturnValue(pool);

    await expect(ClubService.suspendClub("company-1")).resolves.toBeUndefined();

    // Verify users were set to inactive
    const updateUsersCall = client.query.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE users") &&
        call[0].includes("inactive"),
    );
    expect(updateUsersCall).toBeDefined();
  });
});

// ─── RBAC: member role → HTTP 403 on /api/clubs ───────────────────────────────

describe("RBAC: non-super_admin access to /api/clubs → HTTP 403", () => {
  const clubMiddleware = rbacMiddleware("super_admin");

  function makeReq(user: JwtPayload): Partial<Request> {
    return { user } as unknown as Partial<Request>;
  }

  function makeRes() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  it("should return HTTP 403 when role is member", () => {
    const user: JwtPayload = {
      userId: "user-1",
      companyId: "company-1",
      role: "member",
      exp: 9999999999,
    };
    const req = makeReq(user);
    const res = makeRes();
    const next = jest.fn();

    clubMiddleware(
      req as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(res["status"]).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return HTTP 403 when role is trainer", () => {
    const user: JwtPayload = {
      userId: "user-2",
      companyId: "company-1",
      role: "trainer",
      exp: 9999999999,
    };
    const req = makeReq(user);
    const res = makeRes();
    const next = jest.fn();

    clubMiddleware(
      req as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(res["status"]).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return HTTP 403 when role is club_owner", () => {
    const user: JwtPayload = {
      userId: "user-3",
      companyId: "company-1",
      role: "club_owner",
      exp: 9999999999,
    };
    const req = makeReq(user);
    const res = makeRes();
    const next = jest.fn();

    clubMiddleware(
      req as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(res["status"]).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() when role is super_admin", () => {
    const user: JwtPayload = {
      userId: "admin-1",
      companyId: null,
      role: "super_admin",
      exp: 9999999999,
    };
    const req = makeReq(user);
    const res = makeRes();
    const next = jest.fn();

    clubMiddleware(
      req as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalled();
    expect(res["status"]).not.toHaveBeenCalled();
  });
});

