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

function makeMockPool(rows: Record<string, unknown>[] = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
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
      name: "Test User",
      email: "test@example.com",
      password_hash: "$2b$10$hashedpassword",
      role: "member",
      club_id: "club-uuid",
    };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser]));
    mockGetRedis.mockReturnValue(makeMockRedis());
    // Password comparison fails
    mockBcryptCompare.mockResolvedValue(false as never);

    await expect(
      AuthService.login("test@example.com", "wrongpassword"),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("should return jwt, mqttToken, refreshToken on successful login", async () => {
    const fakeUser = {
      id: "user-uuid",
      name: "Test User",
      email: "test@example.com",
      password_hash: "$2b$10$hashedpassword",
      role: "member",
      club_id: "club-uuid",
    };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser]));
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

  it("should return new jwt and mqttToken on valid refresh", async () => {
    const mockRedis = makeMockRedis();
    mockRedis.get = jest.fn().mockResolvedValue("valid-refresh-token");
    mockUuidv4.mockReturnValue("new-refresh-token" as never);
    mockGetRedis.mockReturnValue(mockRedis);

    const fakeUser = { id: "user-uuid", club_id: "club-uuid", role: "member" };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser]));

    const result = await AuthService.refresh(
      "user-uuid",
      "valid-refresh-token",
    );

    expect(result.jwt).toBeDefined();
    expect(result.mqttToken).toBeDefined();
  });
});

describe("AuthService.logout", () => {
  it("should delete refresh token from Redis", async () => {
    const mockRedis = makeMockRedis();
    mockGetRedis.mockReturnValue(mockRedis);

    await AuthService.logout("user-uuid");

    expect(mockRedis.del).toHaveBeenCalledWith("refresh_token:user-uuid");
  });
});
