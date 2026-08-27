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

const printfulToken = optional("PRINTFUL_API_KEY");
const stripeSecret = optional("STRIPE_SECRET_KEY");

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
    stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
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

  siteUrl: optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
} as const;

export type AppConfig = typeof config;
