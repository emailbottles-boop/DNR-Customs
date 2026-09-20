"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The owner's checks, on the page they already look at. One button asks the
 * server whether every key is one its upstream accepts and whether Stripe is
 * sending events to the right address; the answers come back as plain lines,
 * never a key's value. Two more put things right with nothing to type.
 */

type Shape = { set: boolean; prefix: string; length: number; stray: boolean; odd: number };
type Endpoint = { id: string; url: string; status: string; ours: boolean; missing_events: string[] };
type WebhookStatus = { url: string; ok: boolean; problem: string | null; endpoint: Endpoint | null };
type Health = {
  mode: "payout" | "preorder" | "payment";
  test_mode: boolean;
  stripe: Shape & { live: string };
  printful: Shape & { live: string };
  webhook: Shape & { usable: boolean; endpoint: WebhookStatus | null };
  site_url: string;
};
type Repair = WebhookStatus & { action: "moved" | "updated" | "needs-create" | "already-ok"; events: string[] };
type Settle = {
  note: string | null;
  payouts_checked: string[];
  confirmed: string[];
  failed: Array<{ reference: string; error: string }>;
  missing: string[];
  still_waiting: string[];
};

type Line = { ok: boolean; text: string };

function shapeText(k: Shape): string {
  if (!k.set) return "not set";
  const notes: string[] = [];
  if (k.stray) notes.push("stray characters were cleaned off");
  if (k.odd) notes.push(`${k.odd} character${k.odd === 1 ? "" : "s"} that cannot be part of a key — re-enter it`);
  return `${k.prefix}… (${k.length} characters${notes.length ? `, ${notes.join("; ")}` : ""})`;
}

function linesFor(h: Health): Line[] {
  const lines: Line[] = [];
  lines.push({
    ok: h.stripe.set && !h.stripe.odd && h.stripe.live === "ok",
    text: `Stripe secret key ${shapeText(h.stripe)}${h.stripe.set ? ` — ${h.stripe.live === "ok" ? "Stripe accepts it" : h.stripe.live}` : ""}`,
  });
  lines.push({
    ok: h.printful.set && !h.printful.odd && h.printful.live === "ok",
    text: `Printful token ${shapeText(h.printful)}${h.printful.set ? ` — ${h.printful.live === "ok" ? "Printful accepts it" : h.printful.live}` : ""}`,
  });
  lines.push({
    ok: h.webhook.usable,
    text: `Stripe webhook secret ${shapeText(h.webhook)}${h.webhook.set && !h.webhook.usable ? " — every Stripe message will be refused until this is re-entered" : ""}`,
  });
  const ep = h.webhook.endpoint;
  if (ep) {
    lines.push({
      ok: ep.ok,
      text: `Stripe webhook endpoint ${ep.ok ? `${ep.url} — enabled, every event on` : (ep.problem ?? "not right")}`,
    });
  }
  if (h.test_mode) lines.push({ ok: false, text: "Stripe is on TEST keys — nothing goes to print." });
  return lines;
}

async function call<T>(path: string, method: "GET" | "POST"): Promise<T> {
  const response = await fetch(path, { method, headers: { Accept: "application/json" } });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body;
}

export function ChecksPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy("check");
    setError(null);
    setMessage(null);
    try {
      const h = await call<Health>("/api/admin/health", "GET");
      setHealth(h);
      setLines(linesFor(h));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function fix() {
    setBusy("fix");
    setError(null);
    try {
      const r = await call<Repair>("/api/admin/webhook", "POST");
      const what =
        r.action === "moved"
          ? `Moved the endpoint to ${r.url}; the signing secret you set still applies.`
          : r.action === "updated"
            ? `Switched on every event at ${r.url}.`
            : r.action === "needs-create"
              ? `No endpoint exists. In Stripe → Developers → Webhooks, add a destination at ${r.url} listening to ${r.events.join(", ")}, then put its signing secret in STRIPE_WEBHOOK_SECRET and redeploy.`
              : "The endpoint was already right.";
      setMessage(what);
      await check();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function settle() {
    setBusy("settle");
    setError(null);
    try {
      const r = await call<Settle>("/api/admin/settle", "POST");
      const bits: string[] = [];
      if (r.note) bits.push(r.note);
      if (r.confirmed.length) bits.push(`sent to print: ${r.confirmed.join(", ")}`);
      if (r.still_waiting.length) bits.push(`${r.still_waiting.length} draft${r.still_waiting.length === 1 ? "" : "s"} not in any payout yet`);
      if (r.missing.length) bits.push(`paid out but no Printful order: ${r.missing.join(", ")}`);
      if (r.failed.length) bits.push(`Printful would not print: ${r.failed.map((f) => `${f.reference} — ${f.error}`).join("; ")}`);
      setMessage(`Checked ${r.payouts_checked.length} payout${r.payouts_checked.length === 1 ? "" : "s"} — ${bits.join(" · ") || "nothing to do"}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const endpoint = health?.webhook.endpoint ?? null;
  const fixable = endpoint !== null && !endpoint.ok;

  return (
    <div className="mt-8 border-b border-hairline pb-8">
      <p className="label">Checks</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={check} disabled={busy !== null} className="btn btn-ghost px-4 py-2 text-xs">
          {busy === "check" ? "Asking Stripe and Printful…" : "Check keys"}
        </button>
        {fixable ? (
          <button type="button" onClick={fix} disabled={busy !== null} className="btn btn-ghost px-4 py-2 text-xs">
            {busy === "fix" ? "Fixing…" : "Fix webhook"}
          </button>
        ) : null}
        {health?.mode === "payout" ? (
          <button type="button" onClick={settle} disabled={busy !== null} className="btn btn-ghost px-4 py-2 text-xs">
            {busy === "settle" ? "Asking Stripe…" : "Settle payouts"}
          </button>
        ) : null}
      </div>
      {lines.length ? (
        <ul className="mt-4 space-y-1 text-sm">
          {lines.map((line) => (
            <li key={line.text} className={line.ok ? "text-bone-soft" : "text-alert"}>
              {line.ok ? "✓ " : "✗ "}
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="mt-3 text-sm text-bone-soft">{message}</p> : null}
      {error ? <p className="label mt-3 text-alert">{error}</p> : null}
    </div>
  );
}
