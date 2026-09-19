import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";

/**
 * Which orders a Stripe payout paid for.
 *
 * A payout is a lump sum: Stripe sweeps every charge whose funds have become
 * available into one bank transfer. The `payout.paid` event names the payout
 * and nothing else, so to learn which orders just got funded the webhook has
 * to ask Stripe for the payout's balance transactions and walk them back to
 * the charge, and from the charge to our order reference.
 *
 * The reference rides on the charge's metadata — checkout stamps it onto the
 * PaymentIntent, and Stripe copies PaymentIntent metadata to the charge it
 * creates. Charges made before that stamping existed are resolved the slow
 * way, by looking up the Checkout Session for their PaymentIntent.
 */

const STRIPE_API = "https://api.stripe.com/v1";

const chargeSchema = z.object({
  object: z.literal("charge"),
  id: z.string(),
  payment_intent: z.string().nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
  refunded: z.boolean().nullish(),
  disputed: z.boolean().nullish(),
});

/** A balance transaction's source is polymorphic; only charges concern us. */
const balanceTransactionSchema = z.object({
  id: z.string(),
  type: z.string(),
  source: z.union([chargeSchema, z.object({ object: z.string() }).passthrough(), z.string()]).nullish(),
});

const balanceTransactionList = z.object({
  data: z.array(balanceTransactionSchema),
  has_more: z.boolean().nullish(),
});

const sessionList = z.object({
  data: z.array(
    z.object({
      client_reference_id: z.string().nullish(),
      metadata: z.record(z.string(), z.string()).nullish(),
    }),
  ),
});

export type PayoutOrder = {
  reference: string;
  chargeId: string;
};

export type SkippedCharge = {
  chargeId: string;
  reason: "refunded" | "disputed" | "no-reference";
};

export type PayoutOrders = {
  orders: PayoutOrder[];
  skipped: SkippedCharge[];
};

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

async function stripeGet(path: string, params: URLSearchParams): Promise<unknown> {
  const key = config.payments.stripeSecretKey;
  if (!key) throw new StripeApiError("STRIPE_SECRET_KEY is not set.", 0);

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (config.payments.stripeApiVersion) {
    headers["Stripe-Version"] = config.payments.stripeApiVersion;
  }

  const response = await fetch(`${STRIPE_API}${path}?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new StripeApiError(
      body?.error?.message ?? `Stripe returned ${response.status}`,
      response.status,
    );
  }
  return body;
}

/** The reference a charge carries, if checkout stamped one on it. */
function referenceFromMetadata(
  metadata: Record<string, string> | null | undefined,
): string | null {
  const value = metadata?.order_reference?.trim();
  return value ? value : null;
}

/**
 * Fallback for charges without stamped metadata: the Checkout Session that
 * produced the PaymentIntent still knows the order. One extra call per such
 * charge, which only ever happens for orders that predate the stamping.
 */
async function referenceFromSession(paymentIntent: string): Promise<string | null> {
  const params = new URLSearchParams({ payment_intent: paymentIntent, limit: "1" });
  const parsed = sessionList.safeParse(await stripeGet("/checkout/sessions", params));
  if (!parsed.success) return null;
  const session = parsed.data.data[0];
  if (!session) return null;
  return (
    session.client_reference_id?.trim() ||
    referenceFromMetadata(session.metadata) ||
    null
  );
}

/**
 * Every order whose money arrived in this payout, ready to confirm.
 *
 * Charges that were refunded in full or are under dispute are reported as
 * skipped rather than confirmed: the money for those has gone, or may go,
 * back to the customer, and printing the garment anyway is how a refund
 * turns into a loss. Charges with no order behind them — a donation link on
 * the same account, say — are skipped too. Skips are returned, not thrown,
 * so one odd charge never blocks the rest of the batch.
 */
export async function ordersInPayout(payoutId: string): Promise<PayoutOrders> {
  const orders: PayoutOrder[] = [];
  const skipped: SkippedCharge[] = [];
  const seen = new Set<string>();

  let startingAfter: string | undefined;
  // A payout is bounded — Stripe's own page cap is 100 and a drop of this
  // size never nears it — but the loop still follows `has_more` so a big
  // day is confirmed in full rather than only its first page.
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ payout: payoutId, limit: "100" });
    params.append("expand[]", "data.source");
    if (startingAfter) params.set("starting_after", startingAfter);

    const parsed = balanceTransactionList.safeParse(
      await stripeGet("/balance_transactions", params),
    );
    if (!parsed.success) {
      throw new StripeApiError("Unrecognised balance transaction list.", 0);
    }

    for (const transaction of parsed.data.data) {
      const charge = chargeSchema.safeParse(transaction.source);
      if (!charge.success) continue; // the payout itself, a refund, a fee…
      if (seen.has(charge.data.id)) continue;
      seen.add(charge.data.id);

      if (charge.data.refunded) {
        skipped.push({ chargeId: charge.data.id, reason: "refunded" });
        continue;
      }
      if (charge.data.disputed) {
        skipped.push({ chargeId: charge.data.id, reason: "disputed" });
        continue;
      }

      let reference = referenceFromMetadata(charge.data.metadata);
      if (!reference && charge.data.payment_intent) {
        reference = await referenceFromSession(charge.data.payment_intent);
      }
      if (!reference) {
        skipped.push({ chargeId: charge.data.id, reason: "no-reference" });
        continue;
      }

      orders.push({ reference, chargeId: charge.data.id });
    }

    if (!parsed.data.has_more || parsed.data.data.length === 0) break;
    startingAfter = parsed.data.data[parsed.data.data.length - 1].id;
  }

  return { orders, skipped };
}
