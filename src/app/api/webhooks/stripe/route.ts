import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { verifyStripeSignature } from "@/lib/payments/stripe-signature";
import { confirmOrderByReference } from "@/lib/printful/store";

/**
 * Stripe webhook: turns a completed payment into a confirmed Printful order.
 *
 * This closes the loop. Checkout deliberately creates the Printful order as an
 * unconfirmed draft — nothing prints, nothing is billed — and only a verified
 * `checkout.session.completed` promotes it to production.
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

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: CheckoutSession };
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
