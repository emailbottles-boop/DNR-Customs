import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The owner's checks exist because a sister shop lost a real order to two
 * things nobody could see: a one-letter typo in the Stripe endpoint address
 * (every delivery 404ed) and a signing secret with thirty pasted characters
 * that could never be part of a key (every delivery refused). These tests
 * pin down that both are spotted, that the fix touches only what it should,
 * and that no key's value ever comes back.
 */

const RIGHT = "https://dnrcustoms.netlify.app/api/webhooks/stripe";
const ALL = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
];

type Endpoint = { id: string; url: string; status: string; enabled_events: string[] };
type Call = { url: string; method: string; body: string };

let endpoints: Endpoint[] = [];
let payouts: Array<{ id: string; status: string }> = [];
let payoutCharges: Record<string, Array<{ id: string; metadata: Record<string, string>; refunded?: boolean }>> = {};
let drafts: Array<{ id: number; external_id: string; status: string }> = [];
let confirmRefused: string | null = null;
let calls: Call[] = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function pf(result: unknown, code = 200) {
  return json({ code, result }, code);
}

async function boot(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  const base: Record<string, string> = {
    STRIPE_SECRET_KEY: "sk_live_fake_key_0001",
    STRIPE_WEBHOOK_SECRET: "whsec_fake_secret_0001",
    PRINTFUL_API_KEY: "pf_fake_token",
    NEXT_PUBLIC_SITE_URL: "https://dnrcustoms.netlify.app",
    CONFIRM_ON_PAYOUT: "true",
    ADMIN_PASSWORD: "long-enough-password",
  };
  for (const [key, value] of Object.entries({ ...base, ...env })) vi.stubEnv(key, value);
  return import("./health");
}

beforeEach(() => {
  endpoints = [];
  payouts = [];
  payoutCharges = {};
  drafts = [];
  confirmRefused = null;
  calls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, method, body });
    const u = new URL(url);

    if (u.host === "api.stripe.com") {
      if (u.pathname === "/v1/checkout/sessions" && method === "GET") return json({ data: [] });
      if (u.pathname === "/v1/webhook_endpoints" && method === "GET") return json({ data: endpoints, has_more: false });
      if (u.pathname.startsWith("/v1/webhook_endpoints/") && method === "POST") {
        const id = u.pathname.split("/").pop();
        const e = endpoints.find((x) => x.id === id);
        if (!e) return json({ error: { message: `No such webhook endpoint: ${id}` } }, 404);
        const form = new URLSearchParams(body);
        if (form.get("url")) e.url = form.get("url")!;
        if (form.get("disabled") === "false") e.status = "enabled";
        const events = [...form.entries()].filter(([k]) => k.startsWith("enabled_events[")).map(([, v]) => v);
        if (events.length) e.enabled_events = events;
        return json(e);
      }
      if (u.pathname === "/v1/payouts") return json({ data: payouts, has_more: false });
      if (u.pathname === "/v1/balance_transactions") {
        const id = u.searchParams.get("payout") ?? "";
        return json({
          data: (payoutCharges[id] ?? []).map((c) => ({ id: `txn_${c.id}`, type: "charge", source: { object: "charge", ...c } })),
          has_more: false,
        });
      }
      throw new Error(`unexpected Stripe request: ${method} ${url}`);
    }

    if (u.host === "api.printful.com") {
      if (u.pathname === "/store/products") return pf([]);
      if (u.pathname === "/orders" && method === "GET") return pf(drafts);
      const byRef = u.pathname.match(/^\/orders\/@(.+)$/);
      if (byRef) {
        const ref = decodeURIComponent(byRef[1]);
        const d = drafts.find((x) => x.external_id === ref);
        return d ? pf(d) : pf(null, 404);
      }
      const confirm = u.pathname.match(/^\/orders\/(\d+)\/confirm$/);
      if (confirm && method === "POST") {
        const d = drafts.find((x) => x.id === Number(confirm[1]));
        if (d && d.external_id === confirmRefused) {
          return json({ code: 400, result: "Order cannot be confirmed: no payment method on file", error: { message: "no payment method on file" } }, 400);
        }
        return pf({ ...d, status: "pending" });
      }
      throw new Error(`unexpected Printful request: ${method} ${url}`);
    }
    throw new Error(`unexpected request: ${method} ${url}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const posts = (pattern: RegExp) => calls.filter((c) => pattern.test(c.url) && c.method === "POST");

describe("secret shapes", () => {
  it("reports shape only, and flags stray and impossible characters", async () => {
    const { secretShape, usableWebhookSecret } = await boot();
    expect(secretShape("sk_live_abc123")).toEqual({ set: true, prefix: "sk_", length: 14, stray: false, odd: 0 });
    expect(secretShape('"whsec_abc"\r\n')).toMatchObject({ prefix: "whsec_", length: 9, stray: true, odd: 0 });
    // Thirty lookalike letters from a copy, exactly what the sister shop had.
    const mangled = `whsec_${"а".repeat(30)}`; // Cyrillic а
    expect(secretShape(mangled).odd).toBe(30);
    expect(usableWebhookSecret(mangled)).toBe(false);
    expect(usableWebhookSecret("whsec_fine_0001")).toBe(true);
    expect(secretShape(undefined)).toEqual({ set: false, prefix: "", length: 0, stray: false, odd: 0 });
  });

  it("redacts keys and long ids out of upstream errors", async () => {
    const { redactUpstream } = await boot();
    expect(redactUpstream("Invalid API Key provided: sk_live_****abcd")).toBe("Invalid API Key provided: sk_…");
    expect(redactUpstream("store 12345678 rejected token 987654321")).toBe("store … rejected token …");
    expect(redactUpstream("colour #000000 is fine")).toBe("colour #000000 is fine");
  });
});

describe("the Stripe endpoint", () => {
  it("spots an endpoint at a wrong address on the shop domain — the typo that bounced every delivery", async () => {
    const { webhookStatus } = await boot();
    endpoints = [{ id: "we_typo", url: "https://dnrcustoms.netlify.app/api/webhooks/strip", status: "enabled", enabled_events: ALL }];
    const status = await webhookStatus();
    expect(status.ok).toBe(false);
    expect(status.problem).toBe("Stripe is sending to https://dnrcustoms.netlify.app/api/webhooks/strip (wrong address) and every message is bouncing");
    expect(status.endpoint?.id).toBe("we_typo");
    expect(status.url).toBe(RIGHT);
  });

  it("moves that endpoint to the right address with every event, keeping its signing secret", async () => {
    const { repairWebhook } = await boot();
    endpoints = [{ id: "we_typo", url: "https://dnrcustoms.netlify.app/api/webhooks/strip", status: "enabled", enabled_events: ["checkout.session.completed"] }];
    const out = await repairWebhook();
    expect(out).toMatchObject({ action: "moved", ok: true, problem: null });
    const [update] = posts(/webhook_endpoints\/we_typo$/);
    const form = new URLSearchParams(update.body);
    expect(form.get("url")).toBe(RIGHT);
    expect(form.get("disabled")).toBe("false");
    expect([...form.entries()].filter(([k]) => k.startsWith("enabled_events[")).map(([, v]) => v)).toEqual(ALL);
    // Never a new endpoint: that would mean a new secret nobody has.
    expect(posts(/\/v1\/webhook_endpoints$/)).toHaveLength(0);
  });

  it("switches on missing events and re-enables a right-address endpoint", async () => {
    const { repairWebhook, webhookStatus } = await boot();
    endpoints = [{ id: "we_ok", url: RIGHT, status: "disabled", enabled_events: ["checkout.session.completed"] }];
    expect((await webhookStatus()).problem).toBe("the endpoint is disabled");
    expect((await repairWebhook()).action).toBe("updated");
    expect(endpoints[0]).toMatchObject({ status: "enabled", enabled_events: ALL });
  });

  it("says exactly what to create when there is no endpoint, and creates nothing itself", async () => {
    const { repairWebhook } = await boot();
    const out = await repairWebhook();
    expect(out.action).toBe("needs-create");
    expect(out.url).toBe(RIGHT);
    expect(out.events).toEqual(ALL);
    expect(posts(/webhook_endpoints/)).toHaveLength(0);
  });

  it("leaves a right endpoint alone", async () => {
    const { repairWebhook } = await boot();
    endpoints = [{ id: "we_ok", url: RIGHT, status: "enabled", enabled_events: ["*"] }];
    expect((await repairWebhook()).action).toBe("already-ok");
    expect(posts(/webhook_endpoints/)).toHaveLength(0);
  });
});

describe("the health check", () => {
  it("says whether each upstream accepts its key, never the key itself", async () => {
    const { shopHealth } = await boot({ STRIPE_WEBHOOK_SECRET: `whsec_${"а".repeat(30)}` });
    endpoints = [{ id: "we_ok", url: RIGHT, status: "enabled", enabled_events: ALL }];
    const h = await shopHealth();
    expect(h.mode).toBe("payout");
    expect(h.stripe).toMatchObject({ set: true, prefix: "sk_", live: "ok" });
    expect(h.printful).toMatchObject({ set: true, live: "ok" });
    expect(h.webhook).toMatchObject({ set: true, odd: 30, usable: false });
    expect(h.webhook.endpoint?.ok).toBe(true);
    const text = JSON.stringify(h);
    expect(text).not.toContain("sk_live_fake_key_0001");
    expect(text).not.toContain("pf_fake_token");
    expect(text).not.toContain("whsec_а");
  });

  it("reports a key Stripe rejects without repeating it", async () => {
    const { shopHealth } = await boot();
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("api.stripe.com")) return json({ error: { message: "Invalid API Key provided: sk_live_****0001" } }, 401);
      return pf([]);
    });
    const h = await shopHealth();
    expect(h.stripe.live).toBe("Invalid API Key provided: sk_…");
    expect(h.webhook.endpoint?.ok).toBe(false);
  });
});

describe("settling payouts", () => {
  it("confirms the drafts whose money is in the bank and leaves the rest waiting", async () => {
    const { settlePayouts } = await boot();
    drafts = [
      { id: 1, external_id: "DNR-PAIDOUT", status: "draft" },
      { id: 2, external_id: "DNR-WAITING", status: "draft" },
      { id: 3, external_id: "DNR-ABANDONED", status: "draft" },
    ];
    payouts = [{ id: "po_1", status: "paid" }];
    payoutCharges = { po_1: [{ id: "ch_1", metadata: { order_reference: "DNR-PAIDOUT" } }, { id: "ch_r", metadata: { order_reference: "DNR-REFUNDED" }, refunded: true }] };
    const out = await settlePayouts();
    expect(out).toMatchObject({ mode: "payout", note: null, payouts_checked: ["po_1"], confirmed: ["DNR-PAIDOUT"], failed: [], missing: [] });
    expect(out.still_waiting.sort()).toEqual(["DNR-ABANDONED", "DNR-WAITING"]);
    expect(posts(/\/orders\/1\/confirm$/)).toHaveLength(1);
    expect(posts(/\/confirm$/)).toHaveLength(1);
  });

  it("reports why Printful would not print a paid-out draft", async () => {
    const { settlePayouts } = await boot();
    drafts = [{ id: 7, external_id: "DNR-BROKEN", status: "draft" }];
    payouts = [{ id: "po_2", status: "paid" }];
    payoutCharges = { po_2: [{ id: "ch_7", metadata: { order_reference: "DNR-BROKEN" } }] };
    confirmRefused = "DNR-BROKEN";
    const out = await settlePayouts();
    expect(out.confirmed).toEqual([]);
    expect(out.failed).toEqual([{ reference: "DNR-BROKEN", error: "no payment method on file" }]);
  });

  it("asks Stripe nothing when no draft is waiting, and never confirms on test keys or off payout mode", async () => {
    let { settlePayouts } = await boot();
    expect((await settlePayouts()).payouts_checked).toEqual([]);
    expect(calls.filter((c) => /\/v1\/payouts/.test(c.url))).toHaveLength(0);

    ({ settlePayouts } = await boot({ STRIPE_SECRET_KEY: "sk_test_fake" }));
    drafts = [{ id: 1, external_id: "DNR-X", status: "draft" }];
    expect((await settlePayouts()).note).toMatch(/test keys/);

    ({ settlePayouts } = await boot({ CONFIRM_ON_PAYOUT: "false" }));
    expect((await settlePayouts()).note).toMatch(/does not confirm on payout/);
    expect(posts(/\/confirm$/)).toHaveLength(0);
  });
});

describe("secrets as pasted", () => {
  it("cleans quotes, line breaks and invisible characters off a key before use", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", '"sk_test_abc"\r\n');
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "​whsec_abc ");
    const { config } = await import("@/lib/config");
    expect(config.payments.stripeSecretKey).toBe("sk_test_abc");
    expect(config.payments.stripeTestMode).toBe(true);
    expect(config.payments.stripeWebhookSecret).toBe("whsec_abc");
  });
});
