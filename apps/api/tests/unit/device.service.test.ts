/**
 * Unit tests for DeviceService
 * Requirements: 4.2, 4.3
 */

jest.mock("../../src/db/client");

import * as DeviceService from "../../src/services/device.service";
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
  } as unknown as ReturnType<typeof getPool>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── validateDeviceType ───────────────────────────────────────────────────────

describe("DeviceService.validateDeviceType", () => {
  it("should return true for coospo_h6", () => {
    expect(DeviceService.validateDeviceType("coospo_h6")).toBe(true);
  });

  it("should return true for coospo_hw706", () => {
    expect(DeviceService.validateDeviceType("coospo_hw706")).toBe(true);
  });

  it("should return false for unknown device type", () => {
    expect(DeviceService.validateDeviceType("polar_h10")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(DeviceService.validateDeviceType("")).toBe(false);
  });
});

// ─── registerDevice — duplicate MAC address → HTTP 409 ───────────────────────

describe("DeviceService.registerDevice", () => {
  it("should throw HTTP 409 when mac_address is already registered for the same member", async () => {
    // MAC check returns existing device
    mockGetPool.mockReturnValue(
      makeMockPool([{ rows: [{ id: "device-existing" }] }]),
    );

    await expect(
      DeviceService.registerDevice("user-1", "club-1", {
        device_type: "coospo_h6",
        mac_address: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "MAC_CONFLICT" });
  });

  it("should throw HTTP 400 when device_type is not supported", async () => {
    mockGetPool.mockReturnValue(makeMockPool([]));

    await expect(
      DeviceService.registerDevice("user-1", "club-1", {
        device_type: "unsupported_device",
        mac_address: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_DEVICE_TYPE",
    });
  });

  it("should register device successfully when mac_address is unique for the member", async () => {
    const newDevice = {
      id: "device-new",
      user_id: "user-1",
      club_id: "club-1",
      device_type: "coospo_h6",
      mac_address: "AA:BB:CC:DD:EE:FF",
      registered_at: new Date(),
    };

    mockGetPool.mockReturnValue(
      makeMockPool([
        { rows: [] }, // MAC uniqueness check: no conflict
        { rows: [newDevice] }, // INSERT result
      ]),
    );

    const result = await DeviceService.registerDevice("user-1", "club-1", {
      device_type: "coospo_h6",
      mac_address: "AA:BB:CC:DD:EE:FF",
    });

    expect(result.device_type).toBe("coospo_h6");
    expect(result.mac_address).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("should allow same mac_address for different members", async () => {
    const newDevice = {
      id: "device-new",
      user_id: "user-2",
      club_id: "club-1",
      device_type: "coospo_hw706",
      mac_address: "AA:BB:CC:DD:EE:FF",
      registered_at: new Date(),
    };

    // MAC check for user-2 returns no conflict (different user)
    mockGetPool.mockReturnValue(
      makeMockPool([
        { rows: [] }, // MAC uniqueness check: no conflict for this user
        { rows: [newDevice] }, // INSERT result
      ]),
    );

    const result = await DeviceService.registerDevice("user-2", "club-1", {
      device_type: "coospo_hw706",
      mac_address: "AA:BB:CC:DD:EE:FF",
    });

    expect(result.user_id).toBe("user-2");
  });
});

// ─── listDevices ──────────────────────────────────────────────────────────────

describe("DeviceService.listDevices", () => {
  it("should return all devices for a user", async () => {
    const devices = [
      {
        id: "d1",
        user_id: "user-1",
        club_id: "club-1",
        device_type: "coospo_h6",
        mac_address: "AA:BB:CC:DD:EE:01",
        registered_at: new Date(),
      },
      {
        id: "d2",
        user_id: "user-1",
        club_id: "club-1",
        device_type: "coospo_hw706",
        mac_address: "AA:BB:CC:DD:EE:02",
        registered_at: new Date(),
      },
    ];

    mockGetPool.mockReturnValue(makeMockPool([{ rows: devices }]));

    const result = await DeviceService.listDevices("user-1");
    expect(result).toHaveLength(2);
  });
});
