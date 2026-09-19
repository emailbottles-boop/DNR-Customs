import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A payout names no orders — only charges, and only when asked. These tests
 * pin down the walk from payout to charge to order reference, because a
 * mistake here is not a failed test but a paid order that never prints, or a
 * refunded one that does.
 */

type Charge = {
  id: string;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
  refunded?: boolean;
  disputed?: boolean;
};

type Page = { data: unknown[]; has_more: boolean };

let requests: string[] = [];
let pages: Page[] = [];
let sessionsByIntent: Record<string, { client_reference_id?: string; metadata?: Record<string, string> }> = {};
let failWith: number | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function charge(row: Charge) {
  return { id: `txn_${row.id}`, type: "charge", source: { object: "charge", ...row } };
}

beforeEach(() => {
  requests = [];
  pages = [];
  sessionsByIntent = {};
  failWith = null;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fake");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push(url);
    if (failWith) return json({ error: { message: "nope" } }, failWith);

    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/balance_transactions")) {
      const after = parsed.searchParams.get("starting_after");
      const index = after ? pages.findIndex((page) => (page.data.at(-1) as { id: string }).id === after) + 1 : 0;
      return json(pages[index] ?? { data: [], has_more: false });
    }
    if (parsed.pathname.endsWith("/checkout/sessions")) {
      const intent = parsed.searchParams.get("payment_intent") ?? "";
      const session = sessionsByIntent[intent];
      return json({ data: session ? [session] : [] });
    }
    throw new Error(`unexpected request: ${url}`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  vi.resetModules();
  return import("./stripe-payouts");
}

describe("ordersInPayout", () => {
  it("returns the order reference stamped on each charge", async () => {
    pages = [
      {
        data: [
          charge({ id: "ch_1", metadata: { order_reference: "DNR-A" } }),
          charge({ id: "ch_2", metadata: { order_reference: "DNR-B" } }),
          // The payout's own transaction, and a fee: not charges, not orders.
          { id: "txn_po", type: "payout", source: { object: "payout", id: "po_1" } },
          { id: "txn_fee", type: "stripe_fee", source: null },
        ],
        has_more: false,
      },
    ];
    const { ordersInPayout } = await load();

    const result = await ordersInPayout("po_1");

    expect(result.orders.map((o) => o.reference)).toEqual(["DNR-A", "DNR-B"]);
    expect(result.skipped).toEqual([]);
    // Asked for this payout's transactions, with the charge expanded inline.
    expect(requests[0]).toContain("payout=po_1");
    expect(requests[0]).toContain("expand%5B%5D=data.source");
  });

  it("skips refunded and disputed charges rather than printing them", async () => {
    pages = [
      {
        data: [
          charge({ id: "ch_ok", metadata: { order_reference: "DNR-OK" } }),
          charge({ id: "ch_ref", metadata: { order_reference: "DNR-REF" }, refunded: true }),
          charge({ id: "ch_dis", metadata: { order_reference: "DNR-DIS" }, disputed: true }),
        ],
        has_more: false,
      },
    ];
    const { ordersInPayout } = await load();

    const result = await ordersInPayout("po_2");

    expect(result.orders.map((o) => o.reference)).toEqual(["DNR-OK"]);
    expect(result.skipped).toEqual([
      { chargeId: "ch_ref", reason: "refunded" },
      { chargeId: "ch_dis", reason: "disputed" },
    ]);
  });

  it("falls back to the Checkout Session for a charge without stamped metadata", async () => {
    pages = [
      { data: [charge({ id: "ch_old", payment_intent: "pi_old", metadata: {} })], has_more: false },
    ];
    sessionsByIntent = { pi_old: { client_reference_id: "DNR-OLD" } };
    const { ordersInPayout } = await load();

    const result = await ordersInPayout("po_3");

    expect(result.orders).toEqual([{ reference: "DNR-OLD", chargeId: "ch_old" }]);
    expect(requests.some((url) => url.includes("checkout/sessions") && url.includes("payment_intent=pi_old"))).toBe(true);
  });

  it("skips a charge that belongs to no order, such as a donation on the same account", async () => {
    pages = [{ data: [charge({ id: "ch_gift", payment_intent: "pi_gift", metadata: {} })], has_more: false }];
    const { ordersInPayout } = await load();

    const result = await ordersInPayout("po_4");

    expect(result.orders).toEqual([]);
    expect(result.skipped).toEqual([{ chargeId: "ch_gift", reason: "no-reference" }]);
  });

  it("follows pagination so a big day is confirmed in full", async () => {
    pages = [
      { data: [charge({ id: "ch_p1", metadata: { order_reference: "DNR-P1" } })], has_more: true },
      { data: [charge({ id: "ch_p2", metadata: { order_reference: "DNR-P2" } })], has_more: false },
    ];
    const { ordersInPayout } = await load();

    const result = await ordersInPayout("po_5");

    expect(result.orders.map((o) => o.reference)).toEqual(["DNR-P1", "DNR-P2"]);
    expect(requests[1]).toContain("starting_after=txn_ch_p1");
  });

  it("does not confirm the same charge twice if Stripe repeats it across pages", async () => {
    pages = [
      { data: [charge({ id: "ch_dup", metadata: { order_reference: "DNR-DUP" } })], has_more: true },
      { data: [charge({ id: "ch_dup", metadata: { order_reference: "DNR-DUP" } })], has_more: false },
    ];
    const { ordersInPayout } = await load();

    const result = await ordersInPayout("po_6");

    expect(result.orders).toHaveLength(1);
  });

  it("throws on a Stripe error so the webhook can ask for a retry", async () => {
    failWith = 500;
    const { ordersInPayout, StripeApiError } = await load();

    await expect(ordersInPayout("po_7")).rejects.toBeInstanceOf(StripeApiError);
  });
});
