import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signPayload } from "@/lib/payments/stripe-signature";

/**
 * The whole money path, end to end, against stand-in Stripe and Printful.
 *
 * The unit tests around this one each prove a piece — signature checking, form
 * encoding, decimal parsing. None of them prove the pieces are wired to each
 * other, which is the only thing that matters on the day a stranger buys a
 * shirt. This drives the real `placeOrder` and the real webhook route and
 * asserts on the actual HTTP requests that leave the process:
 *
 *   catalog read -> re-price -> shipping quote -> Printful draft
 *     -> Stripe session -> signed webhook -> Printful confirm
 *
 * Both upstreams are impersonated by a fetch stub that records every call, so
 * a wrong URL, a missing `confirm=false`, or a price taken from the client
 * instead of the catalog shows up as a failed assertion rather than as a real
 * garment printed for a penny.
 */

const PRINTFUL_BASE = "https://printful.test";
const RETAIL_PRICE = "25.00";
const SYNC_VARIANT_ID = 4011;
const CATALOG_VARIANT_ID = 9871;
const PRINTFUL_ORDER_ID = 771122;

type Call = { url: string; method: string; body: string; headers: Record<string, string> };

let calls: Call[] = [];
/** Status Printful reports for the draft when the webhook looks it up. */
let draftStatus = "draft";

function envelope(result: unknown, code = 200) {
  return new Response(JSON.stringify({ code, result }), {
    status: code,
    headers: { "Content-Type": "application/json" },
  });
}

const PRODUCT_DETAIL = {
  sync_product: {
    id: 55,
    name: "Drop 01 Long Sleeve",
    description: "Heavyweight long sleeve.",
    thumbnail_url: "https://files.cdn.printful.com/drop01.png",
  },
  sync_variants: [
    {
      id: SYNC_VARIANT_ID,
      name: "Drop 01 Long Sleeve - Black / L",
      variant_id: CATALOG_VARIANT_ID,
      retail_price: RETAIL_PRICE,
      currency: "USD",
      availability_status: "active",
      files: [{ type: "preview", preview_url: "https://files.cdn.printful.com/v.png" }],
      options: [],
    },
  ],
};

/** Impersonates both upstreams and records everything sent to them. */
function installFetchStub() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, method, body, headers: (init?.headers ?? {}) as Record<string, string> });

    if (url.startsWith(`${PRINTFUL_BASE}/store/products/`)) return envelope(PRODUCT_DETAIL);
    if (url.startsWith(`${PRINTFUL_BASE}/store/products`)) {
      return envelope([{ id: 55, name: "Drop 01 Long Sleeve", is_ignored: false }]);
    }
    if (url.startsWith(`${PRINTFUL_BASE}/shipping/rates`)) {
      return envelope([
        { id: "STANDARD", name: "Flat Rate", rate: "4.99", currency: "USD", minDeliveryDays: 3, maxDeliveryDays: 7 },
        { id: "EXPRESS", name: "Express", rate: "14.99", currency: "USD", minDeliveryDays: 1, maxDeliveryDays: 3 },
      ]);
    }
    if (url.match(/\/orders\/\d+\/confirm$/)) {
      return envelope({ id: PRINTFUL_ORDER_ID, external_id: "REF", status: "pending", shipping: "STANDARD" });
    }
    if (url.includes("/orders/@")) {
      return envelope({ id: PRINTFUL_ORDER_ID, external_id: "REF", status: draftStatus, shipping: "STANDARD" });
    }
    if (url.startsWith(`${PRINTFUL_BASE}/orders`)) {
      return envelope({ id: PRINTFUL_ORDER_ID, external_id: "REF", status: "draft", shipping: "STANDARD" });
    }
    if (url.startsWith("https://api.stripe.com/v1/checkout/sessions")) {
      return new Response(
        JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  });
}

/** Boots the modules with a given environment; config reads env at import. */
async function boot(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return {
    service: await import("./service"),
    webhook: await import("@/app/api/webhooks/stripe/route"),
  };
}

const LIVE_ENV = {
  PRINTFUL_API_KEY: "pk_fake_for_tests",
  PRINTFUL_API_URL: PRINTFUL_BASE,
  STRIPE_SECRET_KEY: "sk_live_fake_for_tests",
  STRIPE_WEBHOOK_SECRET: "whsec_fake_for_tests",
  NEXT_PUBLIC_SITE_URL: "https://dnrcustoms.store",
};

const RECIPIENT = {
  name: "Sam Buyer",
  address1: "14 Example Ave",
  address2: "",
  city: "Austin",
  state_code: "TX",
  country_code: "US",
  zip: "78701",
  email: "sam@example.com",
  phone: "",
};

beforeEach(() => {
  calls = [];
  draftStatus = "draft";
  installFetchStub();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function find(pattern: RegExp, method?: string) {
  return calls.find((c) => pattern.test(c.url) && (!method || c.method === method));
}

describe("a real order, from cart to a confirmed Printful order", () => {
  it("prices, drafts, charges and confirms — in that order", async () => {
    const { service, webhook } = await boot(LIVE_ENV);

    const result = await service.placeOrder({
      recipient: RECIPIENT,
      items: [{ variantId: SYNC_VARIANT_ID, quantity: 2 }],
      shippingOptionId: "STANDARD",
    });

    // Money: 2 x $25.00 + $4.99, computed server-side from the catalog.
    expect(result.totals.subtotal.amount).toBe(5000);
    expect(result.totals.shipping.amount).toBe(499);
    expect(result.totals.total.amount).toBe(5499);
    expect(result.totals.total.formatted).toBe("$54.99");

    // The Printful order is created as a draft. `confirm=false` is the single
    // flag standing between a failed payment and a printed garment.
    const draft = find(/\/orders(\?|$)/, "POST");
    expect(draft, "Printful order was never created").toBeDefined();
    expect(draft!.url).toContain("confirm=false");
    const draftBody = JSON.parse(draft!.body);
    expect(draftBody.external_id).toBe(result.reference);
    expect(draftBody.items).toEqual([{ sync_variant_id: SYNC_VARIANT_ID, quantity: 2 }]);
    expect(draftBody.recipient.zip).toBe("78701");

    // Shipping is quoted on the catalog variant id, not the sync id.
    const rates = find(/\/shipping\/rates/, "POST");
    expect(JSON.parse(rates!.body).items).toEqual([
      { variant_id: CATALOG_VARIANT_ID, quantity: 2 },
    ]);

    // Stripe is charged the server's number, in minor units, and is told which
    // order it belongs to so the webhook can find it again.
    const stripe = find(/api\.stripe\.com/, "POST");
    expect(stripe, "Stripe session was never created").toBeDefined();
    const form = new URLSearchParams(stripe!.body);
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("2500");
    expect(form.get("line_items[0][quantity]")).toBe("2");
    expect(form.get("shipping_options[0][shipping_rate_data][fixed_amount][amount]")).toBe("499");
    expect(form.get("client_reference_id")).toBe(result.reference);
    expect(form.get("success_url")).toBe(
      "https://dnrcustoms.store/checkout/confirmed?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(result.redirectUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_123");

    // Nothing has been confirmed yet: the customer has not paid.
    expect(find(/\/confirm$/)).toBeUndefined();

    // Now Stripe says the money landed, signed with the real HMAC.
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_123", client_reference_id: result.reference, payment_status: "paid" } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await webhook.POST(
      new Request("https://dnrcustoms.store/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": `t=${timestamp},v1=${signPayload(payload, "whsec_fake_for_tests", timestamp)}`,
        },
        body: payload,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, confirmed: true });

    // The order is looked up by our own reference, then confirmed.
    expect(find(new RegExp(`/orders/@${result.reference}`))).toBeDefined();
    expect(find(/\/orders\/\d+\/confirm$/, "POST")).toBeDefined();
  });

  it("charges the catalog price, not a price the browser claims", async () => {
    const { service } = await boot(LIVE_ENV);

    // A tampered cart can only ever send ids and quantities — there is no
    // price field to forge, and the server looks the price up regardless.
    const result = await service.placeOrder({
      recipient: RECIPIENT,
      items: [{ variantId: SYNC_VARIANT_ID, quantity: 1 }],
      shippingOptionId: "STANDARD",
      // @ts-expect-error deliberately smuggling a field the schema rejects
      unitPrice: 1,
    });

    expect(result.totals.subtotal.amount).toBe(2500);
    const form = new URLSearchParams(find(/api\.stripe\.com/, "POST")!.body);
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("2500");
  });

  it("falls back to the cheapest rate when the browser sends a stale shipping id", async () => {
    const { service } = await boot(LIVE_ENV);
    const result = await service.placeOrder({
      recipient: RECIPIENT,
      items: [{ variantId: SYNC_VARIANT_ID, quantity: 1 }],
      shippingOptionId: "NO_LONGER_OFFERED",
    });
    expect(result.totals.shipping.amount).toBe(499);
  });

  it("refuses an unpaid session", async () => {
    const { service, webhook } = await boot(LIVE_ENV);
    const { reference } = await service.placeOrder({
      recipient: RECIPIENT,
      items: [{ variantId: SYNC_VARIANT_ID, quantity: 1 }],
      shippingOptionId: "STANDARD",
    });

    const payload = JSON.stringify({
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: { id: "cs_2", client_reference_id: reference, payment_status: "unpaid" } },
    });
    const t = Math.floor(Date.now() / 1000);
    const response = await webhook.POST(
      new Request("https://dnrcustoms.store/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": `t=${t},v1=${signPayload(payload, "whsec_fake_for_tests", t)}` },
        body: payload,
      }),
    );

    expect(await response.json()).toEqual({ received: true, confirmed: false });
    expect(find(/\/confirm$/)).toBeUndefined();
  });

  it("refuses a forged webhook, so nobody can order a free shirt", async () => {
    const { webhook } = await boot(LIVE_ENV);
    const payload = JSON.stringify({
      id: "evt_3",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "DNR-FORGED", payment_status: "paid" } },
    });
    const t = Math.floor(Date.now() / 1000);

    const response = await webhook.POST(
      new Request("https://dnrcustoms.store/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": `t=${t},v1=${"0".repeat(64)}` },
        body: payload,
      }),
    );

    expect(response.status).toBe(400);
    expect(find(/\/confirm$/)).toBeUndefined();
  });

  it("is idempotent when Stripe retries a webhook", async () => {
    const { webhook } = await boot(LIVE_ENV);
    draftStatus = "pending"; // already confirmed by the first delivery

    const payload = JSON.stringify({
      id: "evt_4",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "DNR-ALREADY", payment_status: "paid" } },
    });
    const t = Math.floor(Date.now() / 1000);
    const response = await webhook.POST(
      new Request("https://dnrcustoms.store/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": `t=${t},v1=${signPayload(payload, "whsec_fake_for_tests", t)}` },
        body: payload,
      }),
    );

    expect(await response.json()).toEqual({ received: true, confirmed: true });
    // Confirmed once, not twice: Printful is never asked again.
    expect(find(/\/confirm$/)).toBeUndefined();
  });

  it("never sends a test payment to production", async () => {
    // Stripe has a test mode; Printful does not. A test-key payment must not
    // reach the confirm endpoint or a real shirt gets printed for fake money.
    const { webhook } = await boot({ ...LIVE_ENV, STRIPE_SECRET_KEY: "sk_test_fake" });
    const payload = JSON.stringify({
      id: "evt_5",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "DNR-TESTMODE", payment_status: "paid" } },
    });
    const t = Math.floor(Date.now() / 1000);
    const response = await webhook.POST(
      new Request("https://dnrcustoms.store/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": `t=${t},v1=${signPayload(payload, "whsec_fake_for_tests", t)}` },
        body: payload,
      }),
    );

    expect(await response.json()).toEqual({ received: true, confirmed: false, testMode: true });
    expect(find(/\/confirm$/)).toBeUndefined();
  });

  it("fails closed when the webhook secret is missing", async () => {
    const env = { ...LIVE_ENV } as Record<string, string>;
    delete env.STRIPE_WEBHOOK_SECRET;
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const { webhook } = await boot(env);

    const response = await webhook.POST(
      new Request("https://dnrcustoms.store/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=abc" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(500);
    expect(find(/\/confirm$/)).toBeUndefined();
  });
});
