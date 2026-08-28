import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";
import { printfulRequest } from "@/lib/printful/client";
import { order as orderSchema } from "@/lib/printful/types";

/**
 * The admin view of the order book: Printful's orders joined with what Stripe
 * says was actually paid. Neither side alone is trustworthy for fulfilment —
 * Printful holds drafts nobody paid for (abandoned checkouts), and Stripe
 * holds payments Printful hasn't heard about if a webhook was missed.
 */

export type PaymentInfo = {
  paid: boolean;
  amountTotal: number | null;
  currency: string | null;
};

export type AdminOrder = {
  printfulId: number;
  reference: string | null;
  status: string;
  created: number | null;
  recipientName: string | null;
  recipientPlace: string | null;
  units: number;
  payment: PaymentInfo | null;
};

const adminOrderSchema = orderSchema.extend({
  recipient: z
    .object({
      name: z.string().nullish(),
      city: z.string().nullish(),
      country_code: z.string().nullish(),
    })
    .nullish(),
});

const stripeSessionList = z.object({
  data: z.array(
    z.object({
      client_reference_id: z.string().nullish(),
      payment_status: z.string().nullish(),
      amount_total: z.number().nullish(),
      currency: z.string().nullish(),
    }),
  ),
});

/**
 * Recent Stripe Checkout sessions, keyed by our order reference. 100 covers
 * far more history than a drop of this size generates; a shop that outgrows
 * it needs a database, not a longer list.
 */
export async function recentPayments(): Promise<Map<string, PaymentInfo>> {
  const map = new Map<string, PaymentInfo>();
  const key = config.payments.stripeSecretKey;
  if (!key) return map;

  const response = await fetch(
    "https://api.stripe.com/v1/checkout/sessions?limit=100",
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    console.error(`[admin] Stripe session list failed: ${response.status}`);
    return map;
  }

  const parsed = stripeSessionList.safeParse(await response.json());
  if (!parsed.success) return map;

  for (const session of parsed.data.data) {
    if (!session.client_reference_id) continue;
    // First (most recent) session per reference wins.
    if (map.has(session.client_reference_id)) continue;
    map.set(session.client_reference_id, {
      paid: session.payment_status === "paid",
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    });
  }
  return map;
}

/** True when Stripe confirms this reference was paid. */
export async function referenceIsPaid(reference: string): Promise<boolean> {
  return (await recentPayments()).get(reference)?.paid ?? false;
}

export async function listAdminOrders(): Promise<AdminOrder[]> {
  if (config.printful.mode === "mock") return [];

  const [orders, payments] = await Promise.all([
    printfulRequest({
      path: "/orders",
      schema: z.array(adminOrderSchema),
      query: { limit: 100 },
    }),
    recentPayments(),
  ]);

  const rows: AdminOrder[] = orders.map((order) => ({
    printfulId: order.id,
    reference: order.external_id ?? null,
    status: order.status,
    created: order.created ?? null,
    recipientName: order.recipient?.name ?? null,
    recipientPlace:
      [order.recipient?.city, order.recipient?.country_code]
        .filter(Boolean)
        .join(", ") || null,
    units: (order.items ?? []).reduce((total, item) => total + item.quantity, 0),
    payment: order.external_id ? (payments.get(order.external_id) ?? null) : null,
  }));

  // Actionable first: paid drafts, then other drafts, then everything newest-first.
  const rank = (row: AdminOrder) =>
    row.status === "draft" ? (row.payment?.paid ? 0 : 1) : 2;
  rows.sort((a, b) => rank(a) - rank(b) || (b.created ?? 0) - (a.created ?? 0));
  return rows;
}
