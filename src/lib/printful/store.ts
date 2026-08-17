import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";
import { parseDecimal } from "@/lib/commerce/money";
import type { Money } from "@/lib/commerce/money";
import type { Product } from "@/lib/commerce/product";
import { PrintfulError, printfulRequest } from "./client";
import { idFromSlug, toProduct } from "./catalog";
import { MOCK_PRODUCTS, MOCK_SHIPPING_RATES } from "./mock";
import {
  order as orderSchema,
  shippingRate as shippingRateSchema,
  syncProductDetail,
  syncProductSummary,
} from "./types";
import type { PrintfulOrder, Recipient } from "./types";

/**
 * The storefront's only entry point to product and order data.
 *
 * Every function here transparently serves the demo catalog when Printful is
 * not configured, so callers never branch on credentials.
 */

const isMock = config.printful.mode === "mock";

/** Catalog reads are cached; a shop's products change on the order of hours. */
const CATALOG_TTL_SECONDS = 300;

export function isDemoCatalog(): boolean {
  return isMock;
}

export async function listProducts(): Promise<Product[]> {
  if (isMock) return MOCK_PRODUCTS;

  const summaries = await printfulRequest({
    path: "/store/products",
    schema: z.array(syncProductSummary),
    query: { limit: 100 },
    revalidate: CATALOG_TTL_SECONDS,
  });

  const visible = summaries.filter((summary) => !summary.is_ignored);

  // Printful has no bulk detail endpoint, so variants require a call per
  // product. Settled rather than all: one bad product must not empty the shop.
  const details = await Promise.allSettled(
    visible.map((summary) => fetchProductDetail(summary.id)),
  );

  const products: Product[] = [];
  for (const [index, result] of details.entries()) {
    if (result.status === "fulfilled") {
      if (result.value) products.push(result.value);
    } else {
      console.error(
        `[printful] skipping product ${visible[index].id}:`,
        result.reason,
      );
    }
  }

  return products;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isMock) {
    return MOCK_PRODUCTS.find((product) => product.slug === slug) ?? null;
  }

  const id = idFromSlug(slug);
  if (id === null) return null;

  try {
    return await fetchProductDetail(id);
  } catch (error) {
    // A slug pointing at a deleted product should 404, not 500.
    if (error instanceof PrintfulError && error.status === 404) return null;
    throw error;
  }
}

async function fetchProductDetail(id: number): Promise<Product | null> {
  const detail = await printfulRequest({
    path: `/store/products/${id}`,
    schema: syncProductDetail,
    revalidate: CATALOG_TTL_SECONDS,
  });
  return toProduct(detail);
}

export type ShippingOption = {
  id: string;
  name: string;
  rate: Money;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
};

export type OrderItemInput = { variantId: number; quantity: number };

/** What /shipping/rates needs: the catalog id, not the sync id. */
export type ShippingItemInput = {
  catalogVariantId: number | null;
  variantId: number;
  quantity: number;
};

export async function getShippingOptions(
  recipient: Recipient,
  items: ShippingItemInput[],
): Promise<ShippingOption[]> {
  const rates = isMock
    ? MOCK_SHIPPING_RATES
    : await printfulRequest({
        path: "/shipping/rates",
        schema: z.array(shippingRateSchema),
        method: "POST",
        body: {
          recipient,
          // This endpoint quotes against catalog variants. Orders use the sync
          // id instead; sending that here is rejected. Fall back to the sync id
          // only when Printful reported no catalog id at all, which should not
          // happen for a synced product.
          items: items.map((item) => ({
            variant_id: item.catalogVariantId ?? item.variantId,
            quantity: item.quantity,
          })),
          currency: "USD",
        },
      });

  const options: ShippingOption[] = [];
  for (const rate of rates) {
    const parsed = parseDecimal(rate.rate, "USD");
    if (!parsed) continue;
    options.push({
      id: rate.id,
      name: rate.name,
      rate: parsed,
      minDeliveryDays: rate.minDeliveryDays ?? null,
      maxDeliveryDays: rate.maxDeliveryDays ?? null,
    });
  }
  return options;
}

export type CreateOrderInput = {
  recipient: Recipient;
  items: OrderItemInput[];
  shippingOptionId?: string;
  /** Our own reference, echoed back by Printful for reconciliation. */
  externalId: string;
};

/**
 * Creates the order in Printful.
 *
 * Deliberately created *unconfirmed* unless `PRINTFUL_AUTO_CONFIRM=true`: an
 * unconfirmed order is a draft that is never printed and never charged. Until
 * payment capture is live, confirming automatically would mean shipping goods
 * that nobody has paid for.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<PrintfulOrder> {
  if (isMock) {
    return {
      id: Math.floor(Date.now() / 1000),
      external_id: input.externalId,
      status: "draft",
      shipping: input.shippingOptionId ?? "STANDARD",
      created: Math.floor(Date.now() / 1000),
      costs: null,
      retail_costs: null,
    };
  }

  return printfulRequest({
    path: "/orders",
    schema: orderSchema,
    method: "POST",
    query: { confirm: config.autoConfirmOrders },
    body: {
      external_id: input.externalId,
      recipient: input.recipient,
      shipping: input.shippingOptionId,
      items: input.items.map((item) => ({
        sync_variant_id: item.variantId,
        quantity: item.quantity,
      })),
    },
  });
}

export type ConfirmResult =
  | { status: "confirmed"; orderId: number }
  | { status: "already-confirmed"; orderId: number; printfulStatus: string }
  | { status: "not-found" };

/**
 * Confirms a draft order for production, looked up by our own reference.
 *
 * This is the moment money turns into a printed garment: until it runs, the
 * order is an inert draft that Printful neither prints nor bills. It is called
 * only from the Stripe webhook, after a verified payment.
 *
 * Idempotent by necessity — Stripe retries webhooks, and confirming twice must
 * not double-charge. An order that is already past draft is reported as such
 * rather than re-confirmed.
 */
export async function confirmOrderByReference(
  reference: string,
): Promise<ConfirmResult> {
  if (isMock) {
    console.info(`[printful:mock] would confirm order ${reference}`);
    return { status: "confirmed", orderId: 0 };
  }

  let existing: PrintfulOrder;
  try {
    // "@" prefixes a lookup by external_id rather than Printful's own id.
    existing = await printfulRequest({
      path: `/orders/@${encodeURIComponent(reference)}`,
      schema: orderSchema,
    });
  } catch (error) {
    if (error instanceof PrintfulError && error.status === 404) {
      return { status: "not-found" };
    }
    throw error;
  }

  if (existing.status !== "draft") {
    return {
      status: "already-confirmed",
      orderId: existing.id,
      printfulStatus: existing.status,
    };
  }

  const confirmed = await printfulRequest({
    path: `/orders/${existing.id}/confirm`,
    schema: orderSchema,
    method: "POST",
  });

  return { status: "confirmed", orderId: confirmed.id };
}

/**
 * Re-prices a cart from catalog data. The client sends ids and quantities only;
 * every price the customer is charged is resolved here, server-side, so a
 * tampered cart cannot set its own prices.
 */
export async function priceItems(items: OrderItemInput[]): Promise<{
  lines: Array<{
    variantId: number;
    quantity: number;
    unitPrice: Money;
    productName: string;
    variantName: string;
    image: string | null;
    catalogVariantId: number | null;
  }>;
  missing: number[];
}> {
  const products = await listProducts();
  const index = new Map<
    number,
    {
      product: Product;
      price: Money;
      name: string;
      image: string | null;
      catalogVariantId: number | null;
    }
  >();

  for (const product of products) {
    for (const variant of product.variants) {
      if (!variant.available) continue;
      index.set(variant.id, {
        product,
        price: variant.price,
        name: variant.name,
        // Prefer the variant's own mockup; fall back to the product shot.
        image: variant.image ?? product.thumbnail,
        catalogVariantId: variant.catalogVariantId,
      });
    }
  }

  const lines = [];
  const missing: number[] = [];

  for (const item of items) {
    const match = index.get(item.variantId);
    if (!match) {
      missing.push(item.variantId);
      continue;
    }
    lines.push({
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: match.price,
      productName: match.product.name,
      variantName: match.name,
      image: match.image,
      catalogVariantId: match.catalogVariantId,
    });
  }

  return { lines, missing };
}
