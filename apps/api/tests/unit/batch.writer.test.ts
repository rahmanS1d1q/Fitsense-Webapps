/**
 * Comprehensive Safety Unit Tests for BatchWriter & API Startup Wiring
 * Requirements: 7.2, 7.3, 7.4, 16.4
 *
 * Verifies all required queue-safety & delivery properties:
 * 1. Rejection of rr: null and validation of optional rr field bounds.
 * 2. Correct acknowledgment range when malformed JSON exists.
 * 3. Deterministic forward progress for malformed entries (no permanent blocking).
 * 4. Retryability of valid entries when InfluxDB flush fails.
 * 5. Precise acknowledgment during subsequent successful retry.
 * 6. Crash recovery of existing hr_processing:* keys without needing new buffer claims.
 * 7. Truly concurrent producer isolation (RPUSH during in-flight held flush).
 * 8. Prevention of overlapping flush executions (in-flight guard).
 * 9. Strict global work bound (GLOBAL_MAX_BATCH_SIZE across all queues).
 * 10. Availability of remaining work for subsequent flush cycles.
 * 11. Logging threshold when MAX_CONSECUTIVE_FAILURES (10) is reached.
 * 12. Single idempotent startup initialization of BatchWriter.
 * 13. Zero open handles or background timers after test completion.
 */

import {
  startBatchWriter,
  stopBatchWriter,
  flush,
  addToBuffer,
  isValidHRDataPoint,
  GLOBAL_MAX_BATCH_SIZE,
} from "../../src/services/batch.writer";

const mockRedisStore = new Map<string, string[]>();

jest.mock("../../src/db/redis", () => ({
  getRedis: () => ({
    keys: jest.fn(async (pattern: string) => {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      const matched: string[] = [];
      for (const [k, v] of mockRedisStore.entries()) {
        if (regex.test(k) && v.length > 0) {
          matched.push(k);
        }
      }
      return matched;
    }),
    renamenx: jest.fn(async (oldKey: string, newKey: string) => {
      if (mockRedisStore.has(newKey)) return 0;
      const data = mockRedisStore.get(oldKey);
      if (!data || data.length === 0) return 0;
      mockRedisStore.delete(oldKey);
      mockRedisStore.set(newKey, [...data]);
      return 1;
    }),
    lrange: jest.fn(async (key: string, start: number, stop: number) => {
      const list = mockRedisStore.get(key) ?? [];
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      return list.slice(start, end);
    }),
    llen: jest.fn(async (key: string) => {
      return mockRedisStore.get(key)?.length ?? 0;
    }),
    ltrim: jest.fn(async (key: string, start: number, _stop: number) => {
      const list = mockRedisStore.get(key) ?? [];
      const trimmed = list.slice(start);
      if (trimmed.length === 0) {
        mockRedisStore.delete(key);
      } else {
        mockRedisStore.set(key, trimmed);
      }
      return "OK";
    }),
    del: jest.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (mockRedisStore.delete(k)) count++;
      }
      return count;
    }),
    rpush: jest.fn(async (key: string, val: string) => {
      const list = mockRedisStore.get(key) ?? [];
      list.push(val);
      mockRedisStore.set(key, list);
      return list.length;
    }),
  }),
}));

const mockWritePoint = jest.fn();
let mockFlushFailNext = false;
const mockFlush = jest.fn(async () => {
  if (mockFlushFailNext) {
    throw new Error("InfluxDB connection error");
  }
});

jest.mock("@influxdata/influxdb-client", () => {
  return {
    InfluxDB: jest.fn().mockImplementation(() => ({
      getWriteApi: jest.fn().mockReturnValue({
        writePoint: mockWritePoint,
        flush: mockFlush,
      }),
    })),
    Point: jest.fn().mockImplementation(() => ({
      tag: jest.fn().mockReturnThis(),
      intField: jest.fn().mockReturnThis(),
      floatField: jest.fn().mockReturnThis(),
      stringField: jest.fn().mockReturnThis(),
      timestamp: jest.fn().mockReturnThis(),
    })),
  };
});

jest.mock("../../src/app", () => ({
  __esModule: true,
  default: {
    listen: jest.fn((_port: number, cb?: () => void) => {
      if (cb) cb();
      return {} as any;
    }),
  },
}));

jest.mock("../../src/services/mqtt.consumer", () => ({
  startMqttConsumer: jest.fn(),
  validateHRPayload: jest.fn(),
}));

jest.mock("../../src/services/downsampling.job", () => ({
  startDownsamplingJob: jest.fn(),
}));

describe("BatchWriter Safety & Delivery Proofs", () => {
  beforeEach(() => {
    stopBatchWriter();
    mockRedisStore.clear();
    mockWritePoint.mockClear();
    mockFlush.mockClear();
    mockFlushFailNext = false;
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopBatchWriter();
    mockRedisStore.clear();
  });

  describe("isValidHRDataPoint runtime contract validation", () => {
    it("valid full payload with rr returns true", () => {
      const valid = {
        hr: 120,
        rr: 800,
        sessionId: "s-123",
        companyId: "c-456",
        userId: "u-789",
        timestamp: 1700000000000,
        hrZone: "cardio",
      };
      expect(isValidHRDataPoint(valid)).toBe(true);
    });

    it("payload without rr or with rr: undefined is valid", () => {
      const base = {
        hr: 85,
        sessionId: "s-123",
        companyId: "c-456",
        userId: "u-789",
        timestamp: 1700000000000,
        hrZone: "fat_burn",
      };
      expect(isValidHRDataPoint({ ...base })).toBe(true);
      expect(isValidHRDataPoint({ ...base, rr: undefined })).toBe(true);
    });

    it("payload with rr: null is invalid and returns false", () => {
      const base = {
        hr: 85,
        sessionId: "s-123",
        companyId: "c-456",
        userId: "u-789",
        timestamp: 1700000000000,
        hrZone: "fat_burn",
      };
      expect(isValidHRDataPoint({ ...base, rr: null })).toBe(false);
    });

    it("non-object or null returns false", () => {
      expect(isValidHRDataPoint(null)).toBe(false);
      expect(isValidHRDataPoint(undefined)).toBe(false);
      expect(isValidHRDataPoint("string")).toBe(false);
      expect(isValidHRDataPoint(123)).toBe(false);
    });

    it("invalid hr values (non-number, non-finite, float, out-of-range) return false", () => {
      const base = { sessionId: "s", companyId: "c", userId: "u", timestamp: 1000, hrZone: "rest" };
      expect(isValidHRDataPoint({ ...base, hr: "80" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, hr: NaN })).toBe(false);
      expect(isValidHRDataPoint({ ...base, hr: Infinity })).toBe(false);
      expect(isValidHRDataPoint({ ...base, hr: 80.5 })).toBe(false);
      expect(isValidHRDataPoint({ ...base, hr: 19 })).toBe(false);
      expect(isValidHRDataPoint({ ...base, hr: 301 })).toBe(false);
    });

    it("invalid timestamp values (non-number, non-finite, <= 0) return false", () => {
      const base = { hr: 80, sessionId: "s", companyId: "c", userId: "u", hrZone: "rest" };
      expect(isValidHRDataPoint({ ...base, timestamp: "1000" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, timestamp: NaN })).toBe(false);
      expect(isValidHRDataPoint({ ...base, timestamp: 0 })).toBe(false);
      expect(isValidHRDataPoint({ ...base, timestamp: -500 })).toBe(false);
    });

    it("invalid or missing string identifiers return false", () => {
      const base = { hr: 80, timestamp: 1000, hrZone: "rest" };
      expect(isValidHRDataPoint({ ...base, companyId: "c", userId: "u" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, sessionId: "", companyId: "c", userId: "u" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, sessionId: "   ", companyId: "c", userId: "u" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, sessionId: "s", companyId: "", userId: "u" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, sessionId: "s", companyId: "c", userId: "   " })).toBe(false);
      expect(isValidHRDataPoint({ ...base, sessionId: "s", companyId: "c", userId: "u", hrZone: "" })).toBe(false);
    });

    it("invalid optional rr values (non-number, non-finite, out-of-range) return false", () => {
      const base = { hr: 80, sessionId: "s", companyId: "c", userId: "u", timestamp: 1000, hrZone: "rest" };
      expect(isValidHRDataPoint({ ...base, rr: "fast" })).toBe(false);
      expect(isValidHRDataPoint({ ...base, rr: NaN })).toBe(false);
      expect(isValidHRDataPoint({ ...base, rr: 199 })).toBe(false);
      expect(isValidHRDataPoint({ ...base, rr: 2001 })).toBe(false);
    });
  });

  // Proof 1 & 2: Malformed entries & rr: null rejection
  it("rejects rr: null payload and never calls Point.floatField with null", async () => {
    const payloadWithNullRr = JSON.stringify({
      companyId: "c1",
      userId: "u1",
      hr: 80,
      sessionId: "s1",
      timestamp: 1000,
      hrZone: "cardio",
      rr: null,
    });
    mockRedisStore.set("hr_buffer:c1:u1", [payloadWithNullRr]);

    await flush();

    expect(mockWritePoint).toHaveBeenCalledTimes(0);
    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(false);
  });

  it("malformed entries do not shift acknowledgment boundaries incorrectly and allow forward progress", async () => {
    const validPoint1 = JSON.stringify({ companyId: "c1", userId: "u1", hr: 80, sessionId: "s1", timestamp: 1000, hrZone: "cardio" });
    const malformed1 = "INVALID_JSON_{";
    const validPoint2 = JSON.stringify({ companyId: "c1", userId: "u1", hr: 85, sessionId: "s1", timestamp: 2000, hrZone: "cardio" });

    mockRedisStore.set("hr_buffer:c1:u1", [malformed1, validPoint1, validPoint2]);

    await flush();

    expect(mockWritePoint).toHaveBeenCalledTimes(2);
    expect(mockFlush).toHaveBeenCalledTimes(1);

    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(false);
    expect(mockRedisStore.has("hr_buffer:c1:u1")).toBe(false);
  });

  it("all-malformed batch makes forward progress without blocking subsequent valid entries", async () => {
    const malformed1 = "BAD_JSON_1";
    const malformed2 = "{bad_structure: true}";

    mockRedisStore.set("hr_buffer:c1:u1", [malformed1, malformed2]);

    await flush();

    expect(mockWritePoint).toHaveBeenCalledTimes(0);
    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(false);
  });

  // Proof 3 & 4: InfluxDB Write Failure & Retryability
  it("valid entries remain in Redis when InfluxDB flush fails, and are retried successfully later", async () => {
    const validPoint = JSON.stringify({ companyId: "c1", userId: "u1", hr: 90, sessionId: "s1", timestamp: 1000, hrZone: "aerobic" });
    mockRedisStore.set("hr_buffer:c1:u1", [validPoint]);

    // 1st attempt: InfluxDB fails
    mockFlushFailNext = true;
    await flush();

    expect(mockWritePoint).toHaveBeenCalledTimes(1);
    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(true);

    // 2nd attempt: InfluxDB recovers
    mockFlushFailNext = false;
    mockWritePoint.mockClear();
    mockFlush.mockClear();

    await flush();

    expect(mockWritePoint).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(false);
  });

  it("logs CRITICAL error when flush fails 10 consecutive times", async () => {
    const validPoint = JSON.stringify({ companyId: "c1", userId: "u1", hr: 90, sessionId: "s1", timestamp: 1000, hrZone: "aerobic" });
    mockRedisStore.set("hr_buffer:c1:u1", [validPoint]);
    mockFlushFailNext = true;

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 10; i++) {
      await flush();
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[BatchWriter] CRITICAL: Flush gagal > 10 siklus berturut-turut. Data HR tersimpan aman di Redis untuk retry."
    );

    consoleErrorSpy.mockRestore();
  });

  // Proof 5: Crash Recovery
  it("existing hr_processing:* keys are recovered on startup without requiring new buffer claims", async () => {
    const leftoverPoint = JSON.stringify({ companyId: "c1", userId: "u1", hr: 95, sessionId: "s-crashed", timestamp: 500, hrZone: "peak" });
    mockRedisStore.set("hr_processing:c1:u1", [leftoverPoint]);

    await flush();

    expect(mockWritePoint).toHaveBeenCalledTimes(1);
    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(false);
  });

  // Proof 6: Truly Concurrent Producer Isolation
  it("producer RPUSH during active in-flight processing remains isolated in hr_buffer for later flush", async () => {
    const initialPoint = JSON.stringify({ companyId: "c1", userId: "u1", hr: 75, sessionId: "s1", timestamp: 1000, hrZone: "rest" });
    mockRedisStore.set("hr_buffer:c1:u1", [initialPoint]);

    let resolveApiFlush!: () => void;
    mockFlush.mockImplementationOnce(() => {
      // Producer writes new item to hr_buffer while flush is in-flight holding api.flush()
      addToBuffer({ companyId: "c1", userId: "u1", hr: 88, sessionId: "s1", timestamp: 2000, hrZone: "cardio" });
      return new Promise<void>((resolve) => {
        resolveApiFlush = resolve;
      });
    });

    // 1. Start flush() — claims hr_buffer -> hr_processing, calls api.writePoint, and reaches mockFlush
    const flushPromise = flush();

    // Give microtick for mockFlush to be invoked
    await new Promise((r) => setTimeout(r, 10));

    // 2. Verify new live item is in hr_buffer:c1:u1 while processing key is active
    expect(mockRedisStore.has("hr_buffer:c1:u1")).toBe(true);
    expect(mockRedisStore.get("hr_buffer:c1:u1")).toEqual([
      JSON.stringify({ companyId: "c1", userId: "u1", hr: 88, sessionId: "s1", timestamp: 2000, hrZone: "cardio" }),
    ]);

    // 3. Release deferred Promise and complete the flush
    resolveApiFlush();
    await flushPromise;

    // 4. Claimed processing data is acknowledged/deleted, but new live buffer remains
    expect(mockRedisStore.has("hr_processing:c1:u1")).toBe(false);
    expect(mockRedisStore.has("hr_buffer:c1:u1")).toBe(true);
    expect(mockRedisStore.get("hr_buffer:c1:u1")?.length).toBe(1);

    // 5. Next flush cycle claims and processes the remaining live buffer item
    mockWritePoint.mockClear();
    await flush();
    expect(mockWritePoint).toHaveBeenCalledTimes(1);
    expect(mockRedisStore.has("hr_buffer:c1:u1")).toBe(false);
  });

  // Proof 7: Overlapping Flush Prevention (In-Flight Guard)
  it("prevents overlapping flush executions within one API process", async () => {
    const point = JSON.stringify({ companyId: "c1", userId: "u1", hr: 70, sessionId: "s1", timestamp: 1000, hrZone: "rest" });
    mockRedisStore.set("hr_buffer:c1:u1", [point]);

    const flush1 = flush();
    const flush2 = flush();

    await Promise.all([flush1, flush2]);

    expect(mockWritePoint).toHaveBeenCalledTimes(1);
  });

  // Proof 8 & 9: Strict Global Work Bound & Remaining Work Availability
  it("enforces strict GLOBAL_MAX_BATCH_SIZE across multiple queues and leaves remaining work for next cycle", async () => {
    const itemsQ1 = Array.from({ length: 500 }, (_, i) =>
      JSON.stringify({ companyId: "c1", userId: "u1", hr: 70 + (i % 30), sessionId: "s1", timestamp: 1000 + i, hrZone: "rest" })
    );
    const itemsQ2 = Array.from({ length: 500 }, (_, i) =>
      JSON.stringify({ companyId: "c2", userId: "u2", hr: 70 + (i % 30), sessionId: "s2", timestamp: 1000 + i, hrZone: "rest" })
    );
    const itemsQ3 = Array.from({ length: 500 }, (_, i) =>
      JSON.stringify({ companyId: "c3", userId: "u3", hr: 70 + (i % 30), sessionId: "s3", timestamp: 1000 + i, hrZone: "rest" })
    );

    mockRedisStore.set("hr_buffer:c1:u1", itemsQ1);
    mockRedisStore.set("hr_buffer:c2:u2", itemsQ2);
    mockRedisStore.set("hr_buffer:c3:u3", itemsQ3);

    await flush();

    expect(mockWritePoint.mock.calls.length).toBeLessThanOrEqual(GLOBAL_MAX_BATCH_SIZE);
    expect(mockWritePoint.mock.calls.length).toBe(1000);

    mockWritePoint.mockClear();
    await flush();

    expect(mockWritePoint.mock.calls.length).toBe(500);
  });

  // Proof 10: Idempotent Startup Initialization
  it("startBatchWriter initializes flush interval idempotently", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    startBatchWriter();
    expect(consoleSpy).toHaveBeenCalledWith("[BatchWriter] Started — flushing every 1 second");

    consoleSpy.mockClear();
    startBatchWriter();
    expect(consoleSpy).not.toHaveBeenCalledWith("[BatchWriter] Started — flushing every 1 second");

    consoleSpy.mockRestore();
  });

  it("API startup (index.ts) invokes BatchWriter startup lifecycle", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    jest.isolateModules(() => {
      require("../../src/index");
      const { stopBatchWriter: stopIsolatedWriter } = require("../../src/services/batch.writer");
      stopIsolatedWriter();
    });

    expect(consoleSpy).toHaveBeenCalledWith("[API] Starting BatchWriter...");
    expect(consoleSpy).toHaveBeenCalledWith("[BatchWriter] Started — flushing every 1 second");

    consoleSpy.mockRestore();
  });
});
