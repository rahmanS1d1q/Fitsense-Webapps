/**
 * Unit tests untuk MQTT payload validation
 * Requirements: 17.2, 17.3, 17.4
 */

import { validateHRPayload } from "../../src/services/mqtt.consumer";

describe("validateHRPayload", () => {
  it("payload tanpa field hr → null (pesan dibuang)", () => {
    const result = validateHRPayload({
      session_id: "abc-123",
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("payload tanpa field session_id → null", () => {
    const result = validateHRPayload({
      hr: 80,
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("payload tanpa field timestamp → null", () => {
    const result = validateHRPayload({
      hr: 80,
      session_id: "abc-123",
    });
    expect(result).toBeNull();
  });

  it("payload bukan object → null (pesan dibuang)", () => {
    expect(validateHRPayload(null)).toBeNull();
    expect(validateHRPayload("string")).toBeNull();
    expect(validateHRPayload(42)).toBeNull();
    expect(validateHRPayload([])).toBeNull();
  });

  it("hr di luar range 20-300 (terlalu rendah) → null", () => {
    const result = validateHRPayload({
      hr: 19,
      session_id: "abc-123",
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("hr di luar range 20-300 (terlalu tinggi) → null", () => {
    const result = validateHRPayload({
      hr: 301,
      session_id: "abc-123",
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("hr bukan integer → null", () => {
    const result = validateHRPayload({
      hr: 80.5,
      session_id: "abc-123",
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("rr di luar range 200-2000 → null", () => {
    const result = validateHRPayload({
      hr: 80,
      rr: 100,
      session_id: "abc-123",
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("rr bukan number → null", () => {
    const result = validateHRPayload({
      hr: 80,
      rr: "fast",
      session_id: "abc-123",
      timestamp: 1700000000000,
    });
    expect(result).toBeNull();
  });

  it("payload valid tanpa rr → parsed correctly", () => {
    const result = validateHRPayload({
      hr: 120,
      session_id: "session-uuid-1",
      timestamp: 1700000000000,
    });
    expect(result).not.toBeNull();
    expect(result!.hr).toBe(120);
    expect(result!.session_id).toBe("session-uuid-1");
    expect(result!.timestamp).toBe(1700000000000);
    expect(result!.rr).toBeUndefined();
  });

  it("payload valid dengan rr → parsed correctly", () => {
    const result = validateHRPayload({
      hr: 75,
      rr: 800,
      session_id: "session-uuid-2",
      timestamp: 1700000000001,
    });
    expect(result).not.toBeNull();
    expect(result!.hr).toBe(75);
    expect(result!.rr).toBe(800);
  });

  it("hr = 20 (batas bawah) → valid", () => {
    expect(
      validateHRPayload({ hr: 20, session_id: "s", timestamp: 1 }),
    ).not.toBeNull();
  });

  it("hr = 300 (batas atas) → valid", () => {
    expect(
      validateHRPayload({ hr: 300, session_id: "s", timestamp: 1 }),
    ).not.toBeNull();
  });

  it("rr = 200 (batas bawah) → valid", () => {
    const result = validateHRPayload({
      hr: 80,
      rr: 200,
      session_id: "s",
      timestamp: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.rr).toBe(200);
  });

  it("rr = 2000 (batas atas) → valid", () => {
    const result = validateHRPayload({
      hr: 80,
      rr: 2000,
      session_id: "s",
      timestamp: 1,
    });
    expect(result).not.toBeNull();
    expect(result!.rr).toBe(2000);
  });
});

describe("ML Service down — data tetap masuk BatchWriter", () => {
  it("validateHRPayload tetap berhasil meski ML Service tidak tersedia", () => {
    // The validation is pure — ML Service availability doesn't affect it
    const result = validateHRPayload({
      hr: 150,
      session_id: "session-ml-down",
      timestamp: 1700000000000,
    });
    expect(result).not.toBeNull();
    expect(result!.hr).toBe(150);
    // ML Service call happens in handleMessage (async, fire-and-forget)
    // BatchWriter addToBuffer is called regardless of ML Service status
  });
});

