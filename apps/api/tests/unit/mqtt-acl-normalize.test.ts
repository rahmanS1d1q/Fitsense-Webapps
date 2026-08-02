/**
 * Unit tests: EMQX action normalization and ACL member guard
 * Tests focused on the normalizeAction() fix and member ACL behavior
 * with real EMQX action string variants.
 */

import { normalizeAction, checkAcl } from "../../src/routes/mqtt-webhook.routes";

const COMPANY = "c9a1b2c3-d4e5-4f67-8901-abcdef123456";
const USER    = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const OTHER   = "f0e1d2c3-b4a5-6789-0123-456789abcdef";

// ─── normalizeAction ──────────────────────────────────────────────────────────

describe("normalizeAction", () => {
  it("normalizes lowercase 'publish' to 'publish'", () => {
    expect(normalizeAction("publish")).toBe("publish");
  });

  it("normalizes uppercase 'PUBLISH' to 'publish'", () => {
    expect(normalizeAction("PUBLISH")).toBe("publish");
  });

  it("normalizes lowercase 'subscribe' to 'subscribe'", () => {
    expect(normalizeAction("subscribe")).toBe("subscribe");
  });

  it("normalizes uppercase 'SUBSCRIBE' to 'subscribe'", () => {
    expect(normalizeAction("SUBSCRIBE")).toBe("subscribe");
  });

  it("normalizes 'SUBSCRIBE(Q0)' to 'subscribe'", () => {
    expect(normalizeAction("SUBSCRIBE(Q0)")).toBe("subscribe");
  });

  it("normalizes 'SUBSCRIBE(Q1)' to 'subscribe'", () => {
    expect(normalizeAction("SUBSCRIBE(Q1)")).toBe("subscribe");
  });

  it("normalizes 'SUBSCRIBE(Q2)' to 'subscribe'", () => {
    expect(normalizeAction("SUBSCRIBE(Q2)")).toBe("subscribe");
  });

  it("normalizes mixed-case 'Subscribe(Q1)' to 'subscribe'", () => {
    expect(normalizeAction("Subscribe(Q1)")).toBe("subscribe");
  });

  it("returns null for empty string", () => {
    expect(normalizeAction("")).toBe(null);
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeAction("   ")).toBe(null);
  });

  it("returns null for unrecognized action 'read'", () => {
    expect(normalizeAction("read")).toBe(null);
  });

  it("returns null for unrecognized action 'WRITE'", () => {
    expect(normalizeAction("WRITE")).toBe(null);
  });

  it("returns null for null input", () => {
    expect(normalizeAction(null)).toBe(null);
  });

  it("returns null for numeric input", () => {
    expect(normalizeAction(42)).toBe(null);
  });

  it("returns null for undefined input", () => {
    expect(normalizeAction(undefined)).toBe(null);
  });
});

// ─── Member ACL — canonical actions ──────────────────────────────────────────

describe("member ACL with canonical action strings", () => {
  it("member can publish own HR with action 'publish'", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/hr`, "publish")).toBe(true);
  });

  it("member can subscribe own HR with action 'subscribe'", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/hr`, "subscribe")).toBe(true);
  });

  it("member can subscribe own alerts with action 'subscribe'", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/alerts`, "subscribe")).toBe(true);
  });
});

// ─── Member ACL — EMQX variant actions (normalization integration) ────────────

describe("member ACL with EMQX variant action strings (via normalizeAction)", () => {
  it("member can publish own HR with action 'PUBLISH' after normalization", () => {
    const action = normalizeAction("PUBLISH");
    expect(action).toBe("publish");
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/hr`, action!)).toBe(true);
  });

  it("member can subscribe own alerts with action 'SUBSCRIBE' after normalization", () => {
    const action = normalizeAction("SUBSCRIBE");
    expect(action).toBe("subscribe");
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/alerts`, action!)).toBe(true);
  });

  it("member can subscribe own alerts with action 'SUBSCRIBE(Q0)' after normalization", () => {
    const action = normalizeAction("SUBSCRIBE(Q0)");
    expect(action).toBe("subscribe");
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/alerts`, action!)).toBe(true);
  });

  it("member can subscribe own alerts with action 'SUBSCRIBE(Q1)' after normalization", () => {
    const action = normalizeAction("SUBSCRIBE(Q1)");
    expect(action).toBe("subscribe");
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/alerts`, action!)).toBe(true);
  });

  it("member can subscribe own alerts with action 'SUBSCRIBE(Q2)' after normalization", () => {
    const action = normalizeAction("SUBSCRIBE(Q2)");
    expect(action).toBe("subscribe");
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/alerts`, action!)).toBe(true);
  });

  it("invalid action 'WRITE' is denied (normalizeAction returns null)", () => {
    const action = normalizeAction("WRITE");
    expect(action).toBe(null);
    // null action means ACL route returns deny before checkAcl — verified by normalizeAction returning null
  });
});

// ─── Member cannot access another user's or company's topics ─────────────────

describe("member cannot access another user's or company's topics", () => {
  it("member cannot publish another user's HR topic", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${OTHER}/hr`, "publish")).toBe(false);
  });

  it("member cannot subscribe another user's HR topic", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${OTHER}/hr`, "subscribe")).toBe(false);
  });

  it("member cannot subscribe another user's alerts topic", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${OTHER}/alerts`, "subscribe")).toBe(false);
  });

  it("member cannot publish to another company's HR topic", () => {
    const otherCompany = "99999999-0000-1111-2222-333333333333";
    expect(checkAcl("member", USER, COMPANY, `fitsense/${otherCompany}/${USER}/hr`, "publish")).toBe(false);
  });

  it("member cannot subscribe to another company's alerts topic", () => {
    const otherCompany = "99999999-0000-1111-2222-333333333333";
    expect(checkAcl("member", USER, COMPANY, `fitsense/${otherCompany}/${USER}/alerts`, "subscribe")).toBe(false);
  });

  it("member cannot publish to own alerts topic", () => {
    expect(checkAcl("member", USER, COMPANY, `fitsense/${COMPANY}/${USER}/alerts`, "publish")).toBe(false);
  });
});
