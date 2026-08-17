import { isCurrency, parseDecimal } from "@/lib/commerce/money";
import type { Currency } from "@/lib/commerce/money";
import { slugify } from "@/lib/commerce/product";
import type { Product, ProductVariant } from "@/lib/commerce/product";
import type { SyncProductDetail, SyncVariant } from "./types";

/**
 * Maps Printful's sync-product wire format onto the storefront's domain types.
 *
 * Pure and network-free so it can be unit tested against real response shapes.
 */

/**
 * Size tokens Printful uses across its catalog. Variant names are unlabelled
 * ("Black / L"), so telling size from colour means recognising the sizes.
 */
const SIZE_TOKENS = new Set([
  "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl",
  "2xl", "3xl", "4xl", "5xl", "6xl",
  "one size", "os",
]);

function isSizeToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  if (SIZE_TOKENS.has(normalized)) return true;
  // Numeric and dimensional sizes: "32", "10.5", "18″×24″", "8x10".
  return /^\d+(\.\d+)?\s*("|″|''|in|cm|mm)?$/.test(normalized) ||
    /^\d+\s*[x×]\s*\d+/.test(normalized);
}

/**
 * Pulls option tokens out of a variant name. Printful gives us either
 * "Product Name - Black / L" on the sync variant or "... (Black / L)" on the
 * underlying catalog product, and sometimes neither.
 */
export function parseVariantOptions(variant: SyncVariant): {
  size: string | null;
  color: string | null;
  label: string;
} {
  const fromCatalog = variant.product?.name?.match(/\(([^()]*)\)\s*$/)?.[1];
  const fromSyncName = variant.name.includes(" - ")
    ? variant.name.slice(variant.name.lastIndexOf(" - ") + 3)
    : null;

  const source = fromCatalog ?? fromSyncName ?? "";
  const tokens = source
    .split("/")
    .map((token) => token.trim())
    .filter(Boolean);

  let size: string | null = null;
  let color: string | null = null;

  for (const token of tokens) {
    if (!size && isSizeToken(token)) size = token;
    else if (!color) color = token;
  }

  // A lone unmatched token is far more often a size than a colour.
  if (!size && !color && tokens.length === 1) size = tokens[0];

  const label = [color, size].filter(Boolean).join(" / ") || variant.name;
  return { size, color, label };
}

function variantImage(variant: SyncVariant): string | null {
  const preview = variant.files?.find((file) => file.preview_url)?.preview_url;
  return preview ?? variant.product?.image ?? null;
}

/**
 * Printful reports availability as free text ("active", "discontinued",
 * "out_of_stock"). Anything not explicitly unavailable is treated as sellable,
 * so an unfamiliar new status doesn't silently hide the whole catalog.
 */
const UNAVAILABLE = new Set(["discontinued", "out_of_stock", "temporary_out_of_stock"]);

function isAvailable(variant: SyncVariant): boolean {
  const status = variant.availability_status?.trim().toLowerCase();
  if (status && UNAVAILABLE.has(status)) return false;
  return variant.synced !== false;
}

export function toVariant(
  variant: SyncVariant,
  fallbackCurrency: Currency,
): ProductVariant | null {
  const currencyCode = variant.currency?.toUpperCase();
  const currency =
    currencyCode && isCurrency(currencyCode) ? currencyCode : fallbackCurrency;

  const price = parseDecimal(variant.retail_price, currency);
  // A variant with no usable price cannot be sold; drop it rather than show $0.
  if (!price) return null;

  const { size, color, label } = parseVariantOptions(variant);

  return {
    id: variant.id,
    // Printful reports this on the sync variant itself and again on the nested
    // catalog product; either will do, and it is needed to quote shipping.
    catalogVariantId: variant.variant_id ?? variant.product?.variant_id ?? null,
    name: label,
    size,
    color,
    price,
    image: variantImage(variant),
    available: isAvailable(variant),
  };
}

export function toProduct(
  detail: SyncProductDetail,
  fallbackCurrency: Currency = "USD",
): Product | null {
  const { sync_product: syncProduct, sync_variants: syncVariants } = detail;

  const variants = syncVariants
    .map((variant) => toVariant(variant, fallbackCurrency))
    .filter((variant): variant is ProductVariant => variant !== null);

  // Nothing sellable means nothing to show.
  if (variants.length === 0) return null;

  const images = [
    syncProduct.thumbnail_url,
    ...variants.map((variant) => variant.image),
  ].filter((image): image is string => Boolean(image));

  return {
    id: syncProduct.id,
    slug: buildSlug(syncProduct.name, syncProduct.id),
    name: syncProduct.name,
    description: syncProduct.description?.trim() || null,
    thumbnail: syncProduct.thumbnail_url ?? images[0] ?? null,
    images: [...new Set(images)],
    variants,
  };
}

/**
 * Slugs carry the Printful id so two products sharing a name stay distinct and
 * a lookup by slug never has to guess.
 */
export function buildSlug(name: string, id: number): string {
  return `${slugify(name, "product")}-${id}`;
}

export function idFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
