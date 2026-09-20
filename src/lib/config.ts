import "server-only";

/**
 * Server-side configuration, read once from the environment.
 *
 * The storefront is designed to boot with *no* credentials at all: without a
 * Printful token it serves a built-in demo catalog, and without Stripe keys it
 * falls back to the manual payment provider. That keeps `npm run dev` working
 * for anyone who clones the repo, and keeps the build green in CI.
 */

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * A secret as it was pasted. Quotes, line breaks, spaces and the invisible
 * characters a copy from a web page can carry are never part of a key, and a
 * key with one of them in it fails in the least visible way there is: every
 * Stripe call rejected, every webhook refused, nothing on screen to say why.
 */
export function cleanSecret(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.replace(/[\s"'​-‍﻿\u0000-\u001F\u007F]/g, "");
  return value ? value : undefined;
}

function secret(name: string): string | undefined {
  return cleanSecret(process.env[name]);
}

/** A positive integer or nothing; a garbled value must not close the shop. */
function parseCap(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[config] ignoring DROP_CAP_UNITS=${JSON.stringify(value)}; expected a positive integer.`);
    return null;
  }
  return parsed;
}

const printfulToken = secret("PRINTFUL_API_KEY");
const stripeSecret = secret("STRIPE_SECRET_KEY");

const paymentProviderId = stripeSecret ? ("stripe" as const) : ("manual" as const);
const autoConfirmRequested = optional("PRINTFUL_AUTO_CONFIRM") === "true";

/**
 * With Stripe, confirming an order is the webhook's job — it happens after the
 * payment clears. Honouring auto-confirm as well would push orders into
 * production the moment they are created, before anyone has paid, so the two
 * settings are resolved here rather than trusted independently.
 */
const autoConfirmOrders =
  paymentProviderId === "stripe" ? false : autoConfirmRequested;

if (autoConfirmRequested && paymentProviderId === "stripe") {
  console.warn(
    "[config] PRINTFUL_AUTO_CONFIRM is ignored while Stripe is enabled: orders are confirmed by the Stripe webhook once payment clears.",
  );
}

const preorderMode = optional("PREORDER_MODE") === "true";
const confirmOnPayoutRequested = optional("CONFIRM_ON_PAYOUT") === "true";

/**
 * Pre-order mode is the stricter of the two holds — every confirm is a human
 * act — so it wins when both are set, rather than the webhook quietly
 * confirming a batch the owner expected to review.
 */
const confirmOnPayout = confirmOnPayoutRequested && !preorderMode;

if (confirmOnPayoutRequested && preorderMode) {
  console.warn(
    "[config] CONFIRM_ON_PAYOUT is ignored while PREORDER_MODE is on: drafts wait for a manual confirm.",
  );
}
if (confirmOnPayoutRequested && paymentProviderId !== "stripe") {
  console.warn(
    "[config] CONFIRM_ON_PAYOUT has no effect without Stripe: payouts are a Stripe event.",
  );
}

export const config = {
  brand: {
    name: "D&R Customs",
    email: optional("CONTACT_EMAIL") ?? "hello@dnrcustoms.com",
  },


  printful: {
    token: printfulToken,
    /** Required when the token is account-level rather than store-level. */
    storeId: optional("PRINTFUL_STORE_ID"),
    baseUrl: optional("PRINTFUL_API_URL") ?? "https://api.printful.com",
    /** With no token we serve fixtures instead of failing to render. */
    mode: printfulToken ? ("live" as const) : ("mock" as const),
  },

  payments: {
    /**
     * "stripe" once a secret key is present, otherwise "manual": the order is
     * recorded as a draft in Printful and payment is arranged out of band.
     */
    provider: paymentProviderId,
    stripeSecretKey: stripeSecret,
    stripePublishableKey: optional("STRIPE_PUBLISHABLE_KEY"),
    stripeWebhookSecret: secret("STRIPE_WEBHOOK_SECRET"),
    /**
     * Pins the Stripe API version for outgoing calls. Unset means Stripe uses
     * the account's default, which Stripe can move — pinning makes upgrades a
     * deliberate act rather than something that happens to you mid-trade.
     */
    stripeApiVersion: optional("STRIPE_API_VERSION"),
    /**
     * True while Stripe is on test keys, where no real money moves.
     *
     * Printful has no such mode: its API is always live, always prints, always
     * bills. So a test payment against a real Printful token would produce a
     * genuine garment and a genuine charge. This flag exists to stop that —
     * see the webhook, which refuses to confirm orders while it is set.
     */
    stripeTestMode: stripeSecret?.startsWith("sk_test_") ?? false,
  },

  /**
   * Whether a newly created Printful order is confirmed for production
   * immediately. Printful only charges and prints once an order is confirmed,
   * so leaving this false means a bug in checkout costs nothing.
   *
   * Forced false under Stripe — see the resolution above.
   */
  autoConfirmOrders,

  /**
   * Total units the current drop will sell before the shop closes itself.
   *
   * Printful bills for printing the moment an order confirms, while Stripe
   * pays sales out days later — so a burst of orders is paid for out of the
   * owner's float. The cap bounds that exposure. Unset means uncapped.
   */
  dropCapUnits: parseCap(optional("DROP_CAP_UNITS")),

  /**
   * Pre-order mode: keep selling past the drop cap, but stop confirming.
   *
   * Payment still happens up front; the Printful order is left as a draft
   * instead of being confirmed by the webhook, so nothing is printed or
   * billed until the owner confirms each draft by hand in Printful's
   * dashboard — once the Stripe payouts have arrived to fund the Wallet.
   * The storefront discloses the delay before anyone pays.
   */
  preorderMode,

  /**
   * Confirm-on-payout: the webhook confirms an order only once Stripe has
   * paid that order's money into the bank, not when the card is charged.
   *
   * Printful bills for printing the moment an order confirms. Stripe pays a
   * sale out days after the charge. Confirming on the charge therefore has
   * the owner fronting every print run out of their own pocket for those
   * days; confirming on the payout means the customer's money is already in
   * the account that pays Printful. Orders ship a few days later. Nothing is
   * ever printed on credit.
   *
   * Needs the webhook endpoint subscribed to `payout.paid` as well as the
   * checkout events. Off by default: the webhook confirms on payment.
   */
  confirmOnPayout,

  /**
   * Password for /admin. Unset means the whole admin surface is disabled —
   * the routes 404 rather than sit behind an empty password.
   */
  adminPassword: optional("ADMIN_PASSWORD"),

  siteUrl: optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
} as const;

export type AppConfig = typeof config;
