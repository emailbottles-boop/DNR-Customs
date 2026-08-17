import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verification for Stripe's `Stripe-Signature` header.
 *
 * This is the security boundary of the whole payment flow. The webhook is a
 * public endpoint whose only job is to confirm an order for production — anyone
 * who can forge a request to it gets free merchandise. So the rules are strict:
 *
 *   - the signature is computed over the EXACT raw request body; any
 *     re-serialisation (JSON.parse then stringify) changes the bytes and must
 *     fail verification,
 *   - comparison is constant-time, so timing can't be used to guess a digest,
 *   - old signatures are rejected, so a captured request can't be replayed.
 *
 * Implemented against the documented scheme rather than the Stripe SDK, which
 * keeps the dependency out of the tree — the same choice the checkout adapter
 * makes.
 */

/** Reject signatures older than this. Stripe's own default tolerance. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureResult =
  | { valid: true }
  | { valid: false; reason: string };

type Parsed = { timestamp: number; signatures: string[] };

/**
 * Parses `t=1614556800,v1=abc...,v1=def...` into its parts.
 *
 * Stripe may send several v1 entries during a secret rollover, so every one is
 * kept and any single match is enough.
 */
export function parseSignatureHeader(header: string): Parsed | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === "t") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      timestamp = parsed;
    } else if (key === "v1") {
      signatures.push(value);
    }
    // v0 entries are for a legacy scheme we do not accept.
  }

  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies a Stripe webhook signature.
 *
 * `rawBody` must be the untouched request body as sent over the wire.
 */
export function verifyStripeSignature({
  rawBody,
  header,
  secret,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  rawBody: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): SignatureResult {
  if (!secret) return { valid: false, reason: "no signing secret configured" };
  if (!header) return { valid: false, reason: "missing Stripe-Signature header" };

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { valid: false, reason: "malformed Stripe-Signature header" };

  // Replay protection. Checked before the HMAC so a flood of stale requests is
  // rejected without doing crypto work.
  const age = Math.abs(nowSeconds - parsed.timestamp);
  if (age > toleranceSeconds) {
    return { valid: false, reason: `timestamp outside tolerance (${age}s)` };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  for (const candidate of parsed.signatures) {
    if (constantTimeEquals(candidate, expected)) return { valid: true };
  }

  return { valid: false, reason: "signature mismatch" };
}

/**
 * Test/tooling helper: produces a header Stripe would have sent. Exported so the
 * webhook can be exercised end to end without a live Stripe account.
 */
export function signPayload(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
