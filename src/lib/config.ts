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

const printfulToken = optional("PRINTFUL_API_KEY");
const stripeSecret = optional("STRIPE_SECRET_KEY");

export const config = {
  brand: {
    name: "DNR Customs",
    tagline: "Made to order, never to stock.",
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
    provider: stripeSecret ? ("stripe" as const) : ("manual" as const),
    stripeSecretKey: stripeSecret,
    stripePublishableKey: optional("STRIPE_PUBLISHABLE_KEY"),
    stripeWebhookSecret: optional("STRIPE_WEBHOOK_SECRET"),
  },

  /**
   * Draft orders are never auto-confirmed for fulfilment. Printful only charges
   * and prints once an order is confirmed, so leaving this false means a bug in
   * checkout costs nothing. Flip it only after payments are wired end to end.
   */
  autoConfirmOrders: optional("PRINTFUL_AUTO_CONFIRM") === "true",

  siteUrl: optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
} as const;

export type AppConfig = typeof config;
