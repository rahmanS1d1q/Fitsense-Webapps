/**
 * Unit tests for PasswordResetService
 * Requirements: 19.2, 19.3, 19.5
 */

jest.mock("../../src/db/client");
jest.mock("../../src/db/redis");
jest.mock("bcryptjs");
jest.mock("nodemailer");

import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import * as PasswordResetService from "../../src/services/password-reset.service";
import { getPool } from "../../src/db/client";
import { getRedis } from "../../src/db/redis";

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

// ─── Mock helpers ────────────────────────────────────────────────────────────

function makeMockRedis(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as ReturnType<typeof getRedis>;
}

function makeMockClient(queryResponses: Record<string, unknown>[][] = []) {
  let callIndex = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      const rows = queryResponses[callIndex++] ?? [];
      return Promise.resolve({ rows });
    }),
    release: jest.fn(),
  };
}

function makeMockPool(
  poolQueryRows: Record<string, unknown>[] = [],
  client?: ReturnType<typeof makeMockClient>,
) {
  return {
    query: jest.fn().mockResolvedValue({ rows: poolQueryRows }),
    connect: jest.fn().mockResolvedValue(client ?? makeMockClient()),
  } as unknown as ReturnType<typeof getPool>;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Mock nodemailer to avoid real SMTP calls
  mockNodemailer.createTransport = jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({}),
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PasswordResetService.requestReset", () => {
  it("should return HTTP 200 with identical response when email is not registered", async () => {
    // Email not found in DB
    mockGetPool.mockReturnValue(makeMockPool([]));
    mockGetRedis.mockReturnValue(makeMockRedis());

    const result = await PasswordResetService.requestReset(
      "notfound@example.com",
    );

    // Must return same shape as success — anti-enumeration
    expect(result).toHaveProperty("sent");
    expect(typeof result.sent).toBe("boolean");
  });

  it("should return { sent: true } when email is registered and token is stored", async () => {
    const fakeUser = { id: "user-uuid", email: "registered@example.com" };
    mockGetPool.mockReturnValue(makeMockPool([fakeUser]));
    mockGetRedis.mockReturnValue(makeMockRedis());

    const result = await PasswordResetService.requestReset(
      "registered@example.com",
    );

    expect(result.sent).toBe(true);
  });

  it("should return { sent: false } when rate limit is exceeded", async () => {
    mockGetPool.mockReturnValue(makeMockPool([]));
    // incr returns 4 (> 3 limit)
    mockGetRedis.mockReturnValue(
      makeMockRedis({ incr: jest.fn().mockResolvedValue(4) }),
    );

    const result = await PasswordResetService.requestReset("any@example.com");

    expect(result.sent).toBe(false);
  });
});

describe("PasswordResetService.resetPassword", () => {
  it("should update password and invalidate sessions when token is valid", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const tokenRow = {
      id: "token-id",
      user_id: "user-uuid",
      expires_at: futureDate,
      used_at: null,
    };

    const mockClient = makeMockClient([
      [], // BEGIN
      [tokenRow], // SELECT token
      [], // UPDATE password
      [], // UPDATE token used_at
      [], // COMMIT
    ]);
    mockGetPool.mockReturnValue(makeMockPool([], mockClient));
    const mockRedis = makeMockRedis();
    mockGetRedis.mockReturnValue(mockRedis);
    mockBcryptHash.mockResolvedValue("new-hashed-password" as never);

    await PasswordResetService.resetPassword(
      "valid-raw-token-abc123",
      "NewPassword1",
    );

    // Verify password was updated
    const updatePasswordCall = mockClient.query.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE users SET password_hash"),
    );
    expect(updatePasswordCall).toBeDefined();

    // Verify token was marked as used
    const markUsedCall = mockClient.query.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE password_reset_tokens SET used_at"),
    );
    expect(markUsedCall).toBeDefined();

    // Verify sessions were invalidated
    expect(mockRedis.del).toHaveBeenCalledWith("refresh_token:user-uuid");
  });

  it("should throw HTTP 410 when token has already been used", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const usedAt = new Date();
    const tokenRow = {
      id: "token-id",
      user_id: "user-uuid",
      expires_at: futureDate,
      used_at: usedAt, // already used
    };

    const mockClient = makeMockClient([
      [], // BEGIN
      [tokenRow], // SELECT token
    ]);
    mockGetPool.mockReturnValue(makeMockPool([], mockClient));
    mockGetRedis.mockReturnValue(makeMockRedis());

    await expect(
      PasswordResetService.resetPassword("used-token", "NewPassword1"),
    ).rejects.toMatchObject({ statusCode: 410 });
  });

  it("should throw HTTP 410 when token is expired", async () => {
    const pastDate = new Date(Date.now() - 1000); // expired
    const tokenRow = {
      id: "token-id",
      user_id: "user-uuid",
      expires_at: pastDate,
      used_at: null,
    };

    const mockClient = makeMockClient([
      [], // BEGIN
      [tokenRow], // SELECT token
    ]);
    mockGetPool.mockReturnValue(makeMockPool([], mockClient));
    mockGetRedis.mockReturnValue(makeMockRedis());

    await expect(
      PasswordResetService.resetPassword("expired-token", "NewPassword1"),
    ).rejects.toMatchObject({ statusCode: 410 });
  });

  it("should throw HTTP 410 when token does not exist", async () => {
    const mockClient = makeMockClient([
      [], // BEGIN
      [], // SELECT token — not found
    ]);
    mockGetPool.mockReturnValue(makeMockPool([], mockClient));
    mockGetRedis.mockReturnValue(makeMockRedis());

    await expect(
      PasswordResetService.resetPassword("nonexistent-token", "NewPassword1"),
    ).rejects.toMatchObject({ statusCode: 410 });
  });
});
