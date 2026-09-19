import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { verifyStripeSignature } from "@/lib/payments/stripe-signature";
import { ordersInPayout } from "@/lib/payments/stripe-payouts";
import { confirmOrderByReference } from "@/lib/printful/store";

/**
 * Stripe webhook: turns money that has arrived into a confirmed Printful order.
 *
 * This closes the loop. Checkout deliberately creates the Printful order as an
 * unconfirmed draft — nothing prints, nothing is billed — and only a verified
 * Stripe event promotes it to production. Which event depends on the mode:
 *
 *   default            `checkout.session.completed` — the card was charged.
 *   CONFIRM_ON_PAYOUT  `payout.paid` — the money reached the bank, days later.
 *   PREORDER_MODE      neither; the owner confirms each draft by hand.
 *
 * On status codes: Stripe retries anything that isn't 2xx, for days. So a
 * *transient* failure (Printful down) returns 5xx to earn a retry, while an
 * *unactionable* event (unknown reference, event we don't handle) returns 2xx,
 * because retrying it forever would never succeed.
 */

// The signature is computed over the exact bytes Stripe sent, so this route
// must never be statically optimised or have its body pre-parsed.
export const dynamic = "force-dynamic";

type CheckoutSession = {
  id?: string;
  client_reference_id?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string> | null;
};

type Payout = {
  id?: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: CheckoutSession & Payout };
};

/** Events that mean the customer has actually paid. */
const CONFIRMING_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: Request) {
  const secret = config.payments.stripeWebhookSecret;

  if (!secret) {
    // Refuse rather than accept unverifiable calls: an endpoint that confirms
    // orders without checking signatures is a way to order free merchandise.
    console.error(
      "[webhooks/stripe] STRIPE_WEBHOOK_SECRET is not set; refusing to process.",
    );
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 500 },
    );
  }

  // Raw text, never request.json() — re-serialising changes the bytes and the
  // signature would no longer match.
  const rawBody = await request.text();

  const result = verifyStripeSignature({
    rawBody,
    header: request.headers.get("stripe-signature"),
    secret,
  });

  if (!result.valid) {
    console.warn(`[webhooks/stripe] rejected: ${result.reason}`);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  // A delayed payment method fails long after the session completed. Nothing to
  // confirm — the draft simply stays a draft.
  if (event.type === "checkout.session.async_payment_failed") {
    const failed = event.data?.object ?? {};
    console.warn(
      `[webhooks/stripe] payment failed for ${
        failed.client_reference_id ?? failed.metadata?.order_reference ?? "?"
      }; order left as a draft.`,
    );
    return NextResponse.json({ received: true, confirmed: false });
  }

  if (event.type === "payout.paid") {
    return handlePayoutPaid(event.data?.object ?? {});
  }

  // A payout that bounced is money still in Stripe, not in the bank. The
  // orders it covered stay drafts; Stripe retries the payout on its own and
  // a fresh `payout.paid` confirms them then.
  if (event.type === "payout.failed" || event.type === "payout.canceled") {
    console.warn(
      `[webhooks/stripe] payout ${event.data?.object?.id ?? "?"} ${event.type.slice("payout.".length)}; the orders it covered stay drafts.`,
    );
    return NextResponse.json({ received: true, confirmed: false });
  }

  // Both of these mean "the money is in". `completed` covers cards, which
  // settle immediately. `async_payment_succeeded` covers slower methods —
  // bank debits and the like — whose session completes while the payment is
  // still pending and only clears minutes or days later. Listening for
  // `completed` alone would leave those orders unconfirmed forever.
  if (!CONFIRMING_EVENTS.has(event.type ?? "")) {
    // Signed but uninteresting: acknowledge so Stripe stops sending it.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data?.object ?? {};
  const reference =
    session.client_reference_id || session.metadata?.order_reference;

  if (!reference) {
    console.error(
      `[webhooks/stripe] session ${session.id ?? "?"} carried no order reference.`,
    );
    return NextResponse.json({ received: true, confirmed: false });
  }

  // Async payment methods complete the session before the money settles.
  // Confirming then would put an unpaid order into production; the matching
  // async_payment_succeeded event arrives once it clears and confirms it then.
  if (session.payment_status && session.payment_status !== "paid") {
    console.info(
      `[webhooks/stripe] ${reference} not yet paid (${session.payment_status}); leaving as draft until payment clears.`,
    );
    return NextResponse.json({ received: true, confirmed: false });
  }

  /**
   * Test payments must never reach production.
   *
   * Stripe has a test mode; Printful does not. Its API is always live — it
   * prints and bills for real regardless of what the payment side was doing.
   * Confirming here on a test payment would mean a real garment made and a
   * real card charged for money that never existed. The draft is left in
   * place so the rest of the flow is still genuinely exercised.
   */
  if (config.payments.stripeTestMode) {
    console.warn(
      `[webhooks/stripe] TEST MODE — not confirming ${reference}. The Printful draft exists and can be confirmed by hand, but nothing has been printed or billed.`,
    );
    return NextResponse.json({ received: true, confirmed: false, testMode: true });
  }

  /**
   * Pre-order mode: the money is real and verified, but confirmation is
   * deliberately manual. The draft waits in Printful until the owner funds
   * the Wallet and confirms it from the dashboard. Acknowledged with 200 so
   * Stripe does not retry — retrying would change nothing.
   */
  if (config.preorderMode) {
    console.info(
      `[webhooks/stripe] PRE-ORDER — ${reference} is paid and left as a draft. Confirm it in Printful when funded.`,
    );
    return NextResponse.json({ received: true, confirmed: false, preorder: true });
  }

  /**
   * Confirm-on-payout: paid, verified, and held. The charge is in Stripe's
   * balance, not yet in the bank, and Printful would bill for printing the
   * moment this confirmed. The `payout.paid` event that carries this charge
   * to the bank confirms it then. Nothing to retry, so 200.
   */
  if (config.confirmOnPayout) {
    console.info(
      `[webhooks/stripe] ${reference} is paid and held as a draft until Stripe pays it out.`,
    );
    return NextResponse.json({ received: true, confirmed: false, heldForPayout: true });
  }

  try {
    const outcome = await confirmOrderByReference(reference);

    switch (outcome.status) {
      case "confirmed":
        console.info(
          `[webhooks/stripe] ${reference} paid — Printful order ${outcome.orderId} confirmed.`,
        );
        return NextResponse.json({ received: true, confirmed: true });

      case "already-confirmed":
        // Expected on a Stripe retry; not an error.
        console.info(
          `[webhooks/stripe] ${reference} already ${outcome.printfulStatus}; nothing to do.`,
        );
        return NextResponse.json({ received: true, confirmed: true });

      case "not-found":
        // Payment taken with no matching draft. Needs a human, but retrying
        // will not conjure the order, so acknowledge and shout in the logs.
        console.error(
          `[webhooks/stripe] PAID BUT NO ORDER: no Printful draft for ${reference}. Fulfil manually.`,
        );
        return NextResponse.json({ received: true, confirmed: false });
    }
  } catch (error) {
    // Transient — let Stripe retry.
    console.error(`[webhooks/stripe] failed to confirm ${reference}:`, error);
    return NextResponse.json(
      { error: "Could not confirm the order." },
      { status: 503 },
    );
  }
}

/**
 * The money is in the bank. Confirm every order this payout paid for.
 *
 * Each confirm is idempotent, so the whole batch is safe to retry: if one
 * order's confirm fails part-way through — Printful down, or Printful's own
 * billing declined — the response is 5xx, Stripe re-sends the event, and the
 * orders already confirmed are reported as such rather than confirmed twice.
 * Stripe keeps retrying for days; if the failure outlasts that, the order is
 * still a paid draft in /admin with a confirm button. Nothing is ever lost,
 * and nothing is ever printed before it has been paid for in full.
 */
async function handlePayoutPaid(payout: Payout) {
  const payoutId = payout.id;

  // Off unless asked for: in the default mode the checkout event already
  // confirmed these orders, and a payout is just money moving.
  if (!config.confirmOnPayout) {
    return NextResponse.json({ received: true, ignored: "payout.paid" });
  }

  if (!payoutId) {
    console.error("[webhooks/stripe] payout.paid carried no payout id.");
    return NextResponse.json({ received: true, confirmed: false });
  }

  if (config.payments.stripeTestMode) {
    console.warn(
      `[webhooks/stripe] TEST MODE — not confirming the orders in payout ${payoutId}.`,
    );
    return NextResponse.json({ received: true, confirmed: false, testMode: true });
  }

  let batch;
  try {
    batch = await ordersInPayout(payoutId);
  } catch (error) {
    // Could not even learn which orders were paid. Transient; retry.
    console.error(`[webhooks/stripe] could not read payout ${payoutId}:`, error);
    return NextResponse.json(
      { error: "Could not read the payout." },
      { status: 503 },
    );
  }

  for (const skip of batch.skipped) {
    console.warn(
      `[webhooks/stripe] payout ${payoutId}: charge ${skip.chargeId} skipped (${skip.reason}).`,
    );
  }

  const confirmed: string[] = [];
  const missing: string[] = [];
  const failed: string[] = [];

  for (const { reference } of batch.orders) {
    try {
      const outcome = await confirmOrderByReference(reference);
      switch (outcome.status) {
        case "confirmed":
          console.info(
            `[webhooks/stripe] payout ${payoutId}: ${reference} paid out — Printful order ${outcome.orderId} confirmed.`,
          );
          confirmed.push(reference);
          break;
        case "already-confirmed":
          confirmed.push(reference);
          break;
        case "not-found":
          console.error(
            `[webhooks/stripe] PAID BUT NO ORDER: no Printful draft for ${reference} (payout ${payoutId}). Fulfil manually.`,
          );
          missing.push(reference);
          break;
      }
    } catch (error) {
      console.error(
        `[webhooks/stripe] payout ${payoutId}: failed to confirm ${reference}:`,
        error,
      );
      failed.push(reference);
    }
  }

  if (failed.length > 0) {
    // Let Stripe retry the event. Everything already confirmed stays
    // confirmed; the retry only has the failures left to do.
    return NextResponse.json(
      { error: "Could not confirm every order.", confirmed, failed },
      { status: 503 },
    );
  }

  console.info(
    `[webhooks/stripe] payout ${payoutId}: ${confirmed.length} confirmed, ${missing.length} missing, ${batch.skipped.length} skipped.`,
  );
  return NextResponse.json({
    received: true,
    confirmed: confirmed.length > 0,
    orders: confirmed,
    ...(missing.length > 0 ? { missing } : {}),
  });
}
