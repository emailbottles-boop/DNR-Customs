import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOLERANCE_SECONDS,
  parseSignatureHeader,
  signPayload,
  verifyStripeSignature,
} from "./stripe-signature";

/**
 * The webhook confirms orders for production, so a signature bug is a way to
 * order free merchandise. These cover the forgery routes an attacker actually
 * has: no signature, a guessed one, a replayed one, a tampered body, and a
 * body that has merely been re-serialised.
 */

const SECRET = "whsec_test_2f8a9c1e4b7d";
const NOW = 1_770_000_000;

const PAYLOAD = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { client_reference_id: "DNR-ABC-123", payment_status: "paid" } },
});

function verify(overrides: Partial<Parameters<typeof verifyStripeSignature>[0]> = {}) {
  return verifyStripeSignature({
    rawBody: PAYLOAD,
    header: signPayload(PAYLOAD, SECRET, NOW),
    secret: SECRET,
    nowSeconds: NOW,
    ...overrides,
  });
}

describe("parseSignatureHeader", () => {
  it("parses a timestamp and signature", () => {
    expect(parseSignatureHeader("t=1614556800,v1=abc123")).toEqual({
      timestamp: 1614556800,
      signatures: ["abc123"],
    });
  });

  it("keeps every v1 entry, for secret rollovers", () => {
    const parsed = parseSignatureHeader("t=1,v1=aaa,v1=bbb");
    expect(parsed?.signatures).toEqual(["aaa", "bbb"]);
  });

  it("ignores the legacy v0 scheme", () => {
    const parsed = parseSignatureHeader("t=1,v0=legacy,v1=current");
    expect(parsed?.signatures).toEqual(["current"]);
  });

  it("tolerates whitespace between parts", () => {
    expect(parseSignatureHeader("t=1614556800, v1=abc123")?.signatures).toEqual([
      "abc123",
    ]);
  });

  it("rejects headers with no timestamp or no signature", () => {
    expect(parseSignatureHeader("v1=abc")).toBeNull();
    expect(parseSignatureHeader("t=1614556800")).toBeNull();
    expect(parseSignatureHeader("")).toBeNull();
    expect(parseSignatureHeader("garbage")).toBeNull();
  });

  it("rejects a non-numeric timestamp", () => {
    expect(parseSignatureHeader("t=not-a-number,v1=abc")).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  it("accepts a genuine signature", () => {
    expect(verify()).toEqual({ valid: true });
  });

  it("accepts when one of several signatures matches", () => {
    const real = signPayload(PAYLOAD, SECRET, NOW).split("v1=")[1];
    expect(verify({ header: `t=${NOW},v1=deadbeef,v1=${real}` })).toEqual({
      valid: true,
    });
  });

  it("rejects a missing header", () => {
    const result = verify({ header: null });
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(verify({ header: "nonsense" }).valid).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const forged = signPayload(PAYLOAD, "whsec_attacker_guess", NOW);
    expect(verify({ header: forged })).toEqual({
      valid: false,
      reason: "signature mismatch",
    });
  });

  it("rejects a tampered body", () => {
    // Same signature, body edited to reference a different order.
    const tampered = PAYLOAD.replace("DNR-ABC-123", "DNR-XYZ-999");
    expect(verify({ rawBody: tampered })).toEqual({
      valid: false,
      reason: "signature mismatch",
    });
  });

  it("rejects a body that was merely re-serialised", () => {
    // This is why the route reads request.text() and never request.json():
    // a parse/stringify round trip is byte-different and must not verify.
    const reserialised = JSON.stringify(JSON.parse(PAYLOAD), null, 2);
    expect(verify({ rawBody: reserialised }).valid).toBe(false);
  });

  it("rejects a replayed request that is too old", () => {
    const stale = signPayload(PAYLOAD, SECRET, NOW - DEFAULT_TOLERANCE_SECONDS - 1);
    const result = verify({ header: stale });
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.reason).toContain("tolerance");
  });

  it("rejects a timestamp too far in the future", () => {
    const ahead = signPayload(PAYLOAD, SECRET, NOW + DEFAULT_TOLERANCE_SECONDS + 1);
    expect(verify({ header: ahead }).valid).toBe(false);
  });

  it("accepts a request at the edge of the tolerance window", () => {
    const edge = signPayload(PAYLOAD, SECRET, NOW - DEFAULT_TOLERANCE_SECONDS);
    expect(verify({ header: edge })).toEqual({ valid: true });
  });

  it("refuses to verify when no secret is configured", () => {
    // Must fail closed: no secret means nothing can be trusted.
    const result = verify({ secret: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects a signature of the payload without the timestamp prefix", () => {
    // A plausible implementation mistake: signing the body alone.
    const wrong = createHmac("sha256", SECRET).update(PAYLOAD).digest("hex");
    expect(verify({ header: `t=${NOW},v1=${wrong}` }).valid).toBe(false);
  });

  it("rejects a truncated signature", () => {
    const real = signPayload(PAYLOAD, SECRET, NOW).split("v1=")[1];
    expect(verify({ header: `t=${NOW},v1=${real.slice(0, 32)}` }).valid).toBe(false);
  });

  it("verifies an empty body consistently", () => {
    expect(
      verifyStripeSignature({
        rawBody: "",
        header: signPayload("", SECRET, NOW),
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ valid: true });
  });
});
