import "server-only";
import { z } from "zod";
import { cleanSecret, config } from "@/lib/config";
import { encodeForm } from "@/lib/payments/stripe";
import { ordersInPayout } from "@/lib/payments/stripe-payouts";
import { printfulRequest } from "@/lib/printful/client";
import { confirmOrderByReference } from "@/lib/printful/store";

/**
 * The owner's checks: is every key one its upstream accepts, is Stripe
 * sending events to the right address with the right events, and has any
 * paid-out order been left as a draft. Written after a sister shop lost a
 * real order to a one-letter typo in its webhook address and a signing
 * secret with thirty pasted characters that could never be part of a key —
 * neither visible anywhere until a customer's money had sat unnoticed.
 *
 * Nothing here ever returns a secret's value. Shapes only.
 */

export type SecretShape = {
  set: boolean;
  /** The part before the first underscore (sk_, whsec_), capped so a key is never handed back. */
  prefix: string;
  length: number;
  /** The stored value carried characters that had to be cleaned off (quotes, a line break). */
  stray: boolean;
  /** Characters that cannot be part of any key: a lookalike letter from a copy, say. */
  odd: number;
};

export function secretShape(raw: string | undefined): SecretShape {
  const value = raw ?? "";
  const clean = cleanSecret(value) ?? "";
  const underscore = clean.indexOf("_");
  return {
    set: clean.length > 0,
    prefix: clean.slice(0, Math.min(underscore > 0 ? underscore + 1 : 4, 8)),
    length: clean.length,
    stray: clean !== value,
    odd: (clean.match(/[^A-Za-z0-9_-]/g) ?? []).length,
  };
}

/** True when a signing secret set by hand could ever verify anything. */
export function usableWebhookSecret(raw: string | undefined): boolean {
  return /^whsec_[A-Za-z0-9_-]+$/.test(cleanSecret(raw) ?? "");
}

/**
 * Upstream error text, safe to show the owner: Stripe prints the tail of a
 * key it rejects, Printful names store and token ids. Neither belongs on a
 * screen.
 */
export function redactUpstream(message: unknown): string {
  return String(message ?? "")
    .replace(/\b(sk|rk|pk|whsec)_[A-Za-z0-9_*?-]+/g, "$1_…")
    .replace(/\*{2,}[A-Za-z0-9]+/g, "****")
    .replace(/(?<![#A-Za-z0-9_])\d{6,}\b/g, "…");
}

/** Every event the webhook acts on. Stripe sends only what an endpoint is
 *  subscribed to, so a missing one here is a silent hole in the money path. */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
] as const;

/** Where Stripe must send events: the shop's own public address. */
export function webhookUrl(): string {
  return `${config.siteUrl.replace(/\/+$/, "")}/api/webhooks/stripe`;
}

class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

async function stripe(method: "GET" | "POST", path: string, payload?: unknown): Promise<unknown> {
  const key = config.payments.stripeSecretKey;
  if (!key) throw new StripeError("STRIPE_SECRET_KEY is not set.", 0);
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (config.payments.stripeApiVersion) headers["Stripe-Version"] = config.payments.stripeApiVersion;
  let url = `https://api.stripe.com/v1${path}`;
  let body: string | undefined;
  if (method === "GET") {
    if (payload) url += `?${encodeForm(payload).toString()}`;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encodeForm(payload ?? {}).toString();
  }
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) {
    throw new StripeError(data?.error?.message ?? `Stripe returned ${response.status}`, response.status);
  }
  return data;
}

const endpointList = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      status: z.string().nullish(),
      enabled_events: z.array(z.string()).nullish(),
    }),
  ),
});

export type Endpoint = {
  id: string;
  url: string;
  status: string;
  /** At exactly the address this shop needs. */
  ours: boolean;
  missing_events: string[];
};

export type WebhookStatus = {
  url: string;
  ok: boolean;
  problem: string | null;
  /** The right endpoint, else the nearest wrong one on this shop's domain, else null. */
  endpoint: Endpoint | null;
  endpoints: Endpoint[];
};

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

/**
 * What Stripe has for this shop's webhook: the endpoint at the right address,
 * or the nearest wrong one (a typo in the path 404s every delivery and the
 * shop never hears that anyone paid), and what is wrong with it.
 */
export async function webhookStatus(): Promise<WebhookStatus> {
  const wanted = webhookUrl();
  const parsed = endpointList.safeParse(await stripe("GET", "/webhook_endpoints", { limit: 100 }));
  if (!parsed.success) throw new StripeError("Unrecognised endpoint list.", 0);
  const endpoints: Endpoint[] = parsed.data.data.map((e) => {
    const events = e.enabled_events ?? [];
    const all = events.includes("*");
    return {
      id: e.id,
      url: e.url,
      status: e.status ?? "",
      ours: e.url === wanted,
      missing_events: all ? [] : WEBHOOK_EVENTS.filter((x) => !events.includes(x)),
    };
  });
  const ours = endpoints.find((e) => e.ours && e.status === "enabled") ?? endpoints.find((e) => e.ours) ?? null;
  const nearMiss = ours ? null : (endpoints.find((e) => sameHost(e.url, wanted)) ?? null);
  let problem: string | null = null;
  if (!ours && nearMiss) problem = `Stripe is sending to ${nearMiss.url} (wrong address) and every message is bouncing`;
  else if (!ours) problem = "no endpoint set up: Stripe is not telling the shop about payments";
  else if (ours.status !== "enabled") problem = `the endpoint is ${ours.status}`;
  else if (ours.missing_events.length) problem = `not subscribed to ${ours.missing_events.join(", ")}`;
  return { url: wanted, ok: !problem, problem, endpoint: ours ?? nearMiss, endpoints };
}

export type RepairResult = WebhookStatus & {
  /** moved: a wrong address on this domain was pointed right; updated: events or enabled fixed;
   *  needs-create: no endpoint exists and this app keeps no store for a new secret, so the
   *  owner creates it in Stripe and sets STRIPE_WEBHOOK_SECRET; already-ok: nothing to do. */
  action: "moved" | "updated" | "needs-create" | "already-ok";
  events: readonly string[];
};

/**
 * Put the endpoint right with nothing to type. An endpoint at a wrong
 * address on the shop's own domain is moved to the right one — its signing
 * secret stays the same, so the STRIPE_WEBHOOK_SECRET already set keeps
 * working. One at the right address gets every event and is re-enabled.
 * With no endpoint at all there is nowhere here to keep a fresh secret (no
 * database), so the answer is the exact address and events to create.
 */
export async function repairWebhook(): Promise<RepairResult> {
  const before = await webhookStatus();
  if (before.ok) return { ...before, action: "already-ok", events: WEBHOOK_EVENTS };
  if (!before.endpoint) return { ...before, action: "needs-create", events: WEBHOOK_EVENTS };
  await stripe("POST", `/webhook_endpoints/${encodeURIComponent(before.endpoint.id)}`, {
    url: before.url,
    enabled_events: WEBHOOK_EVENTS,
    disabled: false,
    description: `${config.brand.name} storefront (managed from /admin)`,
  });
  const after = await webhookStatus();
  return { ...after, action: before.endpoint.ours ? "updated" : "moved", events: WEBHOOK_EVENTS };
}

export type Health = {
  mode: "payout" | "preorder" | "payment";
  test_mode: boolean;
  stripe: SecretShape & { live: string };
  printful: SecretShape & { live: string };
  webhook: SecretShape & { usable: boolean; endpoint: WebhookStatus | null };
  site_url: string;
};

async function probe(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (error) {
    return redactUpstream(error instanceof Error ? error.message : error);
  }
}

/** Every key's shape and whether its upstream accepts it, plus the endpoint. */
export async function shopHealth(): Promise<Health> {
  const stripeKey = secretShape(process.env.STRIPE_SECRET_KEY);
  const printfulToken = secretShape(process.env.PRINTFUL_API_KEY);
  const webhook = secretShape(process.env.STRIPE_WEBHOOK_SECRET);
  const [stripeLive, printfulLive, endpoint] = await Promise.all([
    stripeKey.set ? probe(() => stripe("GET", "/checkout/sessions", { limit: 1 })) : Promise.resolve("not set"),
    printfulToken.set
      ? probe(() => printfulRequest({ path: "/store/products", schema: z.array(z.unknown()), query: { limit: 1 } }))
      : Promise.resolve("not set"),
    stripeKey.set
      ? webhookStatus().catch(
          (error): WebhookStatus => ({
            url: webhookUrl(),
            ok: false,
            problem: `could not ask Stripe: ${redactUpstream(error instanceof Error ? error.message : error)}`,
            endpoint: null,
            endpoints: [],
          }),
        )
      : Promise.resolve(null),
  ]);
  return {
    mode: config.preorderMode ? "preorder" : config.confirmOnPayout ? "payout" : "payment",
    test_mode: config.payments.stripeTestMode,
    stripe: { ...stripeKey, live: stripeLive },
    printful: { ...printfulToken, live: printfulLive },
    webhook: { ...webhook, usable: usableWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET), endpoint },
    site_url: config.siteUrl,
  };
}

const draftList = z.array(
  z.object({
    id: z.number(),
    external_id: z.string().nullish(),
    status: z.string(),
  }),
);

export type SettleResult = {
  mode: Health["mode"];
  note: string | null;
  payouts_checked: string[];
  confirmed: string[];
  failed: Array<{ reference: string; error: string }>;
  missing: string[];
  still_waiting: string[];
};

/**
 * The safety net for a missed `payout.paid`: every Printful draft with a
 * reference is checked against Stripe's recent paid payouts, and the ones
 * whose money is in the bank are confirmed exactly as the webhook would
 * have. Drafts nobody paid for are never in a payout, so they stay drafts.
 * Never on test keys.
 */
export async function settlePayouts(): Promise<SettleResult> {
  const mode: Health["mode"] = config.preorderMode ? "preorder" : config.confirmOnPayout ? "payout" : "payment";
  const empty: SettleResult = { mode, note: null, payouts_checked: [], confirmed: [], failed: [], missing: [], still_waiting: [] };
  if (mode !== "payout") return { ...empty, note: "The shop does not confirm on payout, so there is nothing to settle." };
  if (config.payments.stripeTestMode) return { ...empty, note: "Stripe is on test keys; nothing goes to print." };
  if (config.printful.mode === "mock") return { ...empty, note: "No Printful token; there are no live drafts." };

  const drafts = await printfulRequest({ path: "/orders", schema: draftList, query: { status: "draft", limit: 100 } });
  const waiting = new Set(drafts.map((d) => d.external_id?.trim()).filter((ref): ref is string => Boolean(ref)));
  if (waiting.size === 0) return empty;

  const payouts = z
    .object({ data: z.array(z.object({ id: z.string(), status: z.string().nullish() })) })
    .parse(await stripe("GET", "/payouts", { status: "paid", limit: 10 }));

  const result = { ...empty };
  for (const payout of payouts.data) {
    if (waiting.size === 0) break;
    let batch;
    try {
      batch = await ordersInPayout(payout.id);
    } catch (error) {
      result.failed.push({ reference: payout.id, error: redactUpstream(error instanceof Error ? error.message : error) });
      continue;
    }
    result.payouts_checked.push(payout.id);
    for (const { reference } of batch.orders) {
      if (!waiting.has(reference)) continue;
      waiting.delete(reference);
      try {
        const outcome = await confirmOrderByReference(reference);
        if (outcome.status === "not-found") result.missing.push(reference);
        else result.confirmed.push(reference);
      } catch (error) {
        result.failed.push({ reference, error: redactUpstream(error instanceof Error ? error.message : error) });
      }
    }
  }
  result.still_waiting = [...waiting];
  return result;
}
