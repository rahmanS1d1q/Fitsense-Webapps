/**
 * Unit tests for AuthService
 * Requirements: 2.1, 2.2
 */

// Mock dependencies before importing the service
jest.mock("../../src/db/client");
jest.mock("../../src/db/redis");
jest.mock("bcryptjs");
jest.mock("uuid");

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import * as AuthService from "../../src/services/auth.service";
import { getPool } from "../../src/db/client";
import { getRedis } from "../../src/db/redis";

// Typed mocks
const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<
  typeof bcrypt.compare
>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

function makeMockPool(
  rows: Record<string, unknown>[] = [],
  secondRows?: Record<string, unknown>[],
) {
  let callCount = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ rows });
      return Promise.resolve({ rows: secondRows ?? rows });
    }),
    connect: jest.fn(),
  } as unknown as ReturnType<typeof getPool>;
}

function makeMockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  } as unknown as ReturnType<typeof getRedis>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AuthService.login", () => {
  it("should throw HTTP 401 when email is not registered", async () => {
    // No user found in DB
    mockGetPool.mockReturnValue(makeMockPool([]));
    mockGetRedis.mockReturnValue(makeMockRedis());

    await expect(
      AuthService.login("notfound@example.com", "password123"),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("should throw HTTP 401 when password is wrong", async () => {
    const fakeUser = {
      id: "user-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      password_hash: "$2b$10$hashedpassword",
      users_role: "member",
      status: "active",
    };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser]));
    mockGetRedis.mockReturnValue(makeMockRedis());
    mockBcryptCompare.mockResolvedValue(false as never);

    await expect(
      AuthService.login("test@example.com", "wrongpassword"),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("should return jwt, mqttToken, refreshToken on successful login", async () => {
    const fakeUser = {
      id: "user-uuid",
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      password_hash: "$2b$10$hashedpassword",
      users_role: "member",
      status: "active",
    };
    const fakeUc = { role: "member", company_id: "company-uuid" };
    // First query returns user, second returns users_companies row
    mockGetPool.mockReturnValue(makeMockPool([fakeUser], [fakeUc]));
    const mockRedis = makeMockRedis();
    mockGetRedis.mockReturnValue(mockRedis);
    mockBcryptCompare.mockResolvedValue(true as never);
    mockUuidv4.mockReturnValue("refresh-token-uuid" as never);

    const result = await AuthService.login(
      "test@example.com",
      "correctpassword",
    );

    expect(result.jwt).toBeDefined();
    expect(result.mqttToken).toBeDefined();
    expect(result.refreshToken).toBe("refresh-token-uuid");
    expect(result.user.email).toBe("test@example.com");
  });
});

describe("AuthService.refresh", () => {
  it("should throw HTTP 401 when refresh token is invalid (not in Redis)", async () => {
    const mockRedis = makeMockRedis();
    mockRedis.get = jest.fn().mockResolvedValue(null); // token not found
    mockGetRedis.mockReturnValue(mockRedis);

    await expect(
      AuthService.refresh("user-uuid", "invalid-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("should throw HTTP 401 when refresh token does not match stored token", async () => {
    const mockRedis = makeMockRedis();
    mockRedis.get = jest.fn().mockResolvedValue("stored-token");
    mockGetRedis.mockReturnValue(mockRedis);

    await expect(
      AuthService.refresh("user-uuid", "different-token"),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("should return jwt, mqttToken, and new refreshToken on valid refresh", async () => {
    const mockRedis = makeMockRedis();
    mockRedis.get = jest.fn().mockResolvedValue("valid-refresh-token");
    mockUuidv4.mockReturnValue("new-refresh-token" as never);
    mockGetRedis.mockReturnValue(mockRedis);

    const fakeUser = {
      id: "user-uuid",
      users_role: "member",
      status: "active",
    };
    const fakeUc = { role: "member", company_id: "company-uuid" };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser], [fakeUc]));

    const result = await AuthService.refresh(
      "user-uuid",
      "valid-refresh-token",
    );

    expect(result.jwt).toBeDefined();
    expect(result.mqttToken).toBeDefined();
    // P0 fix: refreshToken must be returned
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).toBe("new-refresh-token");
  });

  it("should return a refreshToken different from the old one (rotation)", async () => {
    const OLD_TOKEN = "old-refresh-token-abc";
    const NEW_TOKEN = "new-refresh-token-xyz";

    const mockRedis = makeMockRedis();
    mockRedis.get = jest.fn().mockResolvedValue(OLD_TOKEN);
    mockUuidv4.mockReturnValue(NEW_TOKEN as never);
    mockGetRedis.mockReturnValue(mockRedis);

    const fakeUser = { id: "user-uuid", users_role: "member", status: "active" };
    const fakeUc = { role: "member", company_id: "company-uuid" };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser], [fakeUc]));

    const result = await AuthService.refresh("user-uuid", OLD_TOKEN);

    expect(result.refreshToken).toBe(NEW_TOKEN);
    expect(result.refreshToken).not.toBe(OLD_TOKEN);
  });

  it("should store the new refreshToken in Redis so a second refresh succeeds", async () => {
    const OLD_TOKEN = "old-refresh-token";
    const NEW_TOKEN = "new-refresh-token";

    const mockRedis = makeMockRedis();
    // First refresh: Redis returns OLD_TOKEN
    mockRedis.get = jest.fn().mockResolvedValue(OLD_TOKEN);
    mockUuidv4.mockReturnValue(NEW_TOKEN as never);
    mockGetRedis.mockReturnValue(mockRedis);

    const fakeUser = { id: "user-uuid", users_role: "member", status: "active" };
    const fakeUc = { role: "member", company_id: "company-uuid" };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser], [fakeUc]));

    const firstResult = await AuthService.refresh("user-uuid", OLD_TOKEN);
    expect(firstResult.refreshToken).toBe(NEW_TOKEN);

    // Verify Redis.set was called with the new token (so second refresh can use it)
    expect(mockRedis.set).toHaveBeenCalledWith(
      "refresh_token:user-uuid",
      NEW_TOKEN,
      "EX",
      expect.any(Number),
    );
  });

  it("should reject the old refreshToken after rotation (old token stored is gone)", async () => {
    const OLD_TOKEN = "old-refresh-token";

    const mockRedis = makeMockRedis();
    // Simulate state after rotation: Redis now holds NEW_TOKEN, not OLD_TOKEN
    mockRedis.get = jest.fn().mockResolvedValue("new-refresh-token");
    mockGetRedis.mockReturnValue(mockRedis);

    // Attempt to refresh with the OLD token — must fail
    await expect(
      AuthService.refresh("user-uuid", OLD_TOKEN),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("AuthService.logout", () => {
  it("should delete refresh token from Redis", async () => {
    const mockRedis = makeMockRedis();
    mockGetRedis.mockReturnValue(mockRedis);

    await AuthService.logout("user-uuid", "dummy.access.token");

    expect(mockRedis.del).toHaveBeenCalledWith("refresh_token:user-uuid");
  });
});
