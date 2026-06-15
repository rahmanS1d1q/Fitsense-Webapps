/**
 * Unit tests untuk SessionService
 * Requirements: 10.2
 */

jest.mock("../../src/db/client");
jest.mock("@influxdata/influxdb-client");

import * as SessionService from "../../src/services/session.service";
import { getPool } from "../../src/db/client";

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

function makeMockPool(
  queryResults: Array<{ rows: Record<string, unknown>[] }>,
) {
  let callIndex = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      const result = queryResults[callIndex] ?? { rows: [] };
      callIndex++;
      return Promise.resolve(result);
    }),
    connect: jest.fn(),
  } as unknown as ReturnType<typeof getPool>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SessionService.startSession", () => {
  it("start sesi ketika sesi aktif sudah ada → HTTP 409", async () => {
    // Active session exists
    mockGetPool.mockReturnValue(
      makeMockPool([{ rows: [{ id: "existing-session-id" }] }]),
    );

    await expect(
      SessionService.startSession("user-1", "company-1"),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "SESSION_CONFLICT",
    });
  });

  it("start sesi berhasil ketika tidak ada sesi aktif", async () => {
    const newSession = {
      id: "new-session-id",
      user_id: "user-1",
      company_id: "company-1",
      started_at: new Date(),
      ended_at: null,
      avg_hr: null,
      max_hr: null,
      min_hr: null,
      duration_minutes: null,
      hr_zone: null,
      auto_closed: false,
      created_at: new Date(),
    };

    mockGetPool.mockReturnValue(
      makeMockPool([
        { rows: [] }, // no active session
        { rows: [newSession] }, // INSERT result
      ]),
    );

    const result = await SessionService.startSession("user-1", "company-1");
    expect(result.id).toBe("new-session-id");
    expect(result.ended_at).toBeNull();
  });
});

describe("SessionService.listSessions", () => {
  it("mengembalikan daftar sesi historis member", async () => {
    const sessions = [
      {
        id: "s1",
        user_id: "user-1",
        company_id: "company-1",
        started_at: new Date(),
        ended_at: new Date(),
      },
      {
        id: "s2",
        user_id: "user-1",
        company_id: "company-1",
        started_at: new Date(),
        ended_at: null,
      },
    ];
    mockGetPool.mockReturnValue(makeMockPool([{ rows: sessions }]));

    const result = await SessionService.listSessions("company-1", "user-1");
    expect(result).toHaveLength(2);
  });
});

describe("SessionService.getSession", () => {
  it("mengembalikan HTTP 404 jika sesi tidak ditemukan", async () => {
    mockGetPool.mockReturnValue(makeMockPool([{ rows: [] }]));

    await expect(
      SessionService.getSession("company-1", "user-1", "nonexistent-session"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("mengembalikan sesi jika ditemukan", async () => {
    const session = {
      id: "session-1",
      user_id: "user-1",
      company_id: "company-1",
      started_at: new Date(),
      ended_at: null,
    };
    mockGetPool.mockReturnValue(makeMockPool([{ rows: [session] }]));

    const result = await SessionService.getSession(
      "company-1",
      "user-1",
      "session-1",
    );
    expect(result.id).toBe("session-1");
  });
});
