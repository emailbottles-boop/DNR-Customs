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
