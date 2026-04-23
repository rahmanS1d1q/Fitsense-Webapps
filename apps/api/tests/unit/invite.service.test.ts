/**
 * Unit tests for InviteService
 * Requirements: 18.3, 18.6
 */

jest.mock("../../src/db/client");
jest.mock("bcryptjs");

import bcrypt from "bcryptjs";
import * as InviteService from "../../src/services/invite.service";
import { getPool } from "../../src/db/client";

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

// ─── Mock helpers ────────────────────────────────────────────────────────────

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

function makeMockPool(client: ReturnType<typeof makeMockClient>) {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue(client),
  } as unknown as ReturnType<typeof getPool>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InviteService.validateAndUseInvite", () => {
  it("should throw HTTP 410 when invite code is expired", async () => {
    const expiredDate = new Date(Date.now() - 1000); // 1 second ago
    const mockClient = makeMockClient([
      [], // BEGIN
      [
        {
          id: "invite-id",
          club_id: "club-uuid",
          expires_at: expiredDate,
          used_at: null,
        },
      ], // SELECT invite
    ]);
    mockGetPool.mockReturnValue(makeMockPool(mockClient));

    await expect(
      InviteService.validateAndUseInvite({
        code: "expired-code",
        name: "Test User",
        email: "test@example.com",
        password: "Password1",
      }),
    ).rejects.toMatchObject({ statusCode: 410 });
  });

  it("should throw HTTP 410 when invite code has already been used", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const usedAt = new Date();
    const mockClient = makeMockClient([
      [], // BEGIN
      [
        {
          id: "invite-id",
          club_id: "club-uuid",
          expires_at: futureDate,
          used_at: usedAt,
        },
      ], // SELECT invite
    ]);
    mockGetPool.mockReturnValue(makeMockPool(mockClient));

    await expect(
      InviteService.validateAndUseInvite({
        code: "used-code",
        name: "Test User",
        email: "test@example.com",
        password: "Password1",
      }),
    ).rejects.toMatchObject({ statusCode: 410 });
  });

  it("should throw HTTP 410 when invite code does not exist", async () => {
    const mockClient = makeMockClient([
      [], // BEGIN
      [], // SELECT invite — not found
    ]);
    mockGetPool.mockReturnValue(makeMockPool(mockClient));

    await expect(
      InviteService.validateAndUseInvite({
        code: "nonexistent-code",
        name: "Test User",
        email: "test@example.com",
        password: "Password1",
      }),
    ).rejects.toMatchObject({ statusCode: 410 });
  });

  it("should throw HTTP 409 when email is already registered", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const mockClient = makeMockClient([
      [], // BEGIN
      [
        {
          id: "invite-id",
          club_id: "club-uuid",
          expires_at: futureDate,
          used_at: null,
        },
      ], // SELECT invite
      [{ id: "existing-user-id" }], // SELECT email check — found
    ]);
    mockGetPool.mockReturnValue(makeMockPool(mockClient));

    await expect(
      InviteService.validateAndUseInvite({
        code: "valid-code",
        name: "Test User",
        email: "existing@example.com",
        password: "Password1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("should create member account and mark code as used on valid registration", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const newUser = {
      id: "new-user-id",
      name: "New Member",
      email: "newmember@example.com",
      role: "member",
      club_id: "club-uuid",
    };

    const mockClient = makeMockClient([
      [], // BEGIN
      [
        {
          id: "invite-id",
          club_id: "club-uuid",
          expires_at: futureDate,
          used_at: null,
        },
      ], // SELECT invite
      [], // SELECT email check — not found
      [newUser], // INSERT user
      [], // UPDATE invite used_at
      [], // COMMIT
    ]);
    mockGetPool.mockReturnValue(makeMockPool(mockClient));
    mockBcryptHash.mockResolvedValue("hashed-password" as never);

    const result = await InviteService.validateAndUseInvite({
      code: "valid-code",
      name: "New Member",
      email: "newmember@example.com",
      password: "Password1",
    });

    expect(result.user.id).toBe("new-user-id");
    expect(result.user.role).toBe("member");
    expect(result.user.clubId).toBe("club-uuid");

    // Verify invite was marked as used
    const updateCall = mockClient.query.mock.calls.find(
      (call) =>
        typeof call[0] === "string" && call[0].includes("UPDATE invite_codes"),
    );
    expect(updateCall).toBeDefined();
  });

  it("should throw HTTP 400 when password does not meet requirements", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const mockClient = makeMockClient([
      [], // BEGIN
      [
        {
          id: "invite-id",
          club_id: "club-uuid",
          expires_at: futureDate,
          used_at: null,
        },
      ], // SELECT invite
      [], // SELECT email check — not found
    ]);
    mockGetPool.mockReturnValue(makeMockPool(mockClient));

    await expect(
      InviteService.validateAndUseInvite({
        code: "valid-code",
        name: "Test User",
        email: "test@example.com",
        password: "weak", // too short, no uppercase, no digit
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
