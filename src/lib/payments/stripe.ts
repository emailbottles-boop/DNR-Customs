import "server-only";
import { config } from "@/lib/config";
import { isPositive } from "@/lib/commerce/money";
import { PaymentError } from "./types";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "./types";

/**
 * Stripe Checkout, activated by setting STRIPE_SECRET_KEY.
 *
 * Implemented against Stripe's REST API with `fetch` rather than the SDK: this
 * is the only call the storefront needs, and it keeps the dependency out of the
 * tree for as long as payments stay off. Swap in the official SDK if the
 * integration grows past creating sessions.
 *
 * Amounts are already integer minor units, which is exactly what Stripe wants,
 * so no conversion happens here — the money module is the single source of
 * truth for what the customer is charged.
 */

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";

/** Stripe's API is form-encoded with bracketed paths for nested values. */
function encodeForm(
  value: unknown,
  prefix = "",
  params = new URLSearchParams(),
): URLSearchParams {
  if (value === undefined || value === null) return params;

  if (Array.isArray(value)) {
    value.forEach((item, index) => encodeForm(item, `${prefix}[${index}]`, params));
    return params;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      encodeForm(nested, prefix ? `${prefix}[${key}]` : key, params);
    }
    return params;
  }

  params.append(prefix, String(value));
  return params;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Card payment",

  customerNotice:
    "You'll be taken to Stripe to pay securely. Your order goes into production once payment clears.",

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const secretKey = config.payments.stripeSecretKey;
    if (!secretKey) {
      throw new PaymentError(
        "Stripe is selected but STRIPE_SECRET_KEY is not set.",
      );
    }

    const payload: Record<string, unknown> = {
      mode: "payment",
      success_url: `${request.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: request.cancelUrl,
      customer_email: request.email,
      // Ties the Stripe session back to our order and Printful's external_id.
      client_reference_id: request.reference,
      metadata: { order_reference: request.reference },
      line_items: request.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: line.unitPrice.currency.toLowerCase(),
          unit_amount: line.unitPrice.amount,
          product_data: {
            name: line.name,
            ...(line.description ? { description: line.description } : {}),
          },
        },
      })),
    };

    // Free shipping is expressed by omitting the option, not by a zero rate.
    if (isPositive(request.shipping)) {
      payload.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Shipping",
            fixed_amount: {
              amount: request.shipping.amount,
              currency: request.shipping.currency.toLowerCase(),
            },
          },
        },
      ];
    }

    const response = await fetch(STRIPE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Makes a retried request safe: Stripe returns the original session.
        "Idempotency-Key": request.reference,
      },
      body: encodeForm(payload).toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await response.json().catch(() => null)) as {
      url?: string;
      error?: { message?: string };
    } | null;

    if (!response.ok || !body?.url) {
      throw new PaymentError(
        body?.error?.message ?? `Stripe checkout failed (${response.status})`,
        body,
      );
    }

    return { kind: "redirect", url: body.url, reference: request.reference };
  },
};

export { encodeForm as __encodeFormForTests };
