import type { Money } from "./money";

/**
 * The storefront's own product shape. Nothing in the UI imports Printful types
 * directly — everything upstream is mapped into these, so swapping or adding a
 * fulfiller later is a change in one adapter rather than in every component.
 */

export type ProductVariant = {
  /** Printful sync variant id. What we send back when placing an order. */
  id: number;
  /**
   * Printful *catalog* variant id — the blank garment in their catalog, as
   * opposed to your store's version of it.
   *
   * Two different ids for the same thing, and the API is not consistent about
   * which it wants: orders are placed with the sync id, but shipping rates are
   * quoted against the catalog id. Null if Printful didn't report one.
   */
  catalogVariantId: number | null;
  /** Human label for the variant, e.g. "Black / L". */
  name: string;
  /** Parsed option values, e.g. { size: "L", color: "Black" }. */
  size: string | null;
  color: string | null;
  price: Money;
  image: string | null;
  available: boolean;
};

export type Product = {
  /** Printful sync product id. */
  id: number;
  /** URL-safe identifier used for /shop/[slug]. */
  slug: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  images: string[];
  variants: ProductVariant[];
};

/** Lowest price across in-stock variants; used for "from $X" on the grid. */
export function startingPrice(product: Product): Money | null {
  const prices = product.variants
    .filter((variant) => variant.available)
    .map((variant) => variant.price);
  if (prices.length === 0) return null;
  return prices.reduce((low, next) => (next.amount < low.amount ? next : low));
}

export function findVariant(
  product: Product,
  variantId: number,
): ProductVariant | undefined {
  return product.variants.find((variant) => variant.id === variantId);
}

/** Distinct option values in first-seen order, for building the picker UI. */
export function optionValues(
  product: Product,
  option: "size" | "color",
): string[] {
  const seen = new Set<string>();
  for (const variant of product.variants) {
    const value = variant[option];
    if (value) seen.add(value);
  }
  return [...seen];
}

export function isInStock(product: Product): boolean {
  return product.variants.some((variant) => variant.available);
}

export function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export type VariantSelection = { color: string | null; size: string | null };

/**
 * Resolves a selection to one that can actually be bought.
 *
 * Printful variants are a flat list, not a matrix: a colour/size pair may
 * simply not be made. Changing one axis can therefore strand the other — pick
 * 2XL in Black, switch to White, and if White stops at XL you are left holding
 * a combination that does not exist, with a dead "Unavailable" button and no
 * explanation.
 *
 * So the axis the shopper just touched is honoured, and the other one moves to
 * the nearest option that keeps the pair real. Reaching for a colour is a
 * statement about colour; silently correcting the size is far better than
 * refusing to sell.
 */

/**
 * The sellable size in `color` closest to `wanted`.
 *
 * Closest, not first: someone who reached for 2XL and lands on S has been
 * handed a garment that will not fit them. Distance is measured along the
 * product's own size order, which is the order Printful lists variants in, so
 * it follows S → M → L → XL rather than the alphabet. Ties go to the larger
 * size, because a shirt slightly too big is wearable and one too small is not.
 */
function nearestSize(
  product: Product,
  color: string | null,
  wanted: string | null,
): string | null | undefined {
  const order = optionValues(product, "size");
  const offered = product.variants.filter(
    (variant) => variant.available && variant.color === color,
  );
  if (offered.length === 0) return undefined;

  const target = wanted === null ? -1 : order.indexOf(wanted);
  if (target === -1) return offered[0].size;

  let best = offered[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const variant of offered) {
    const index = variant.size === null ? -1 : order.indexOf(variant.size);
    if (index === -1) continue;

    const distance = Math.abs(index - target);
    // Strictly closer wins; an equal distance goes to the larger size.
    if (distance < bestDistance || (distance === bestDistance && index > order.indexOf(best.size ?? ""))) {
      best = variant;
      bestDistance = distance;
    }
  }

  return best.size;
}

function reconcile(
  product: Product,
  want: VariantSelection,
  /** The axis the shopper changed. It is never overridden. */
  fixed: "color" | "size",
): VariantSelection {
  const exists = product.variants.some(
    (variant) =>
      variant.available &&
      variant.color === want.color &&
      variant.size === want.size,
  );
  if (exists) return want;

  if (fixed === "color") {
    const size = nearestSize(product, want.color, want.size);
    // No sellable size in that colour at all — leave the pair as asked so the
    // UI can show it as unavailable rather than jumping somewhere unrelated.
    return size === undefined ? want : { color: want.color, size };
  }

  const fallback = product.variants.find(
    (variant) => variant.available && variant.size === want.size,
  );
  return fallback ? { color: fallback.color, size: want.size } : want;
}

/** Choose a colour, moving the size if that colour is not made in it. */
export function selectColor(
  product: Product,
  color: string | null,
  currentSize: string | null,
): VariantSelection {
  return reconcile(product, { color, size: currentSize }, "color");
}

/** Choose a size, moving the colour if that size is not made in it. */
export function selectSize(
  product: Product,
  size: string | null,
  currentColor: string | null,
): VariantSelection {
  return reconcile(product, { color: currentColor, size }, "size");
}
