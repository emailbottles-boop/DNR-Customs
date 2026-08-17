import { money } from "@/lib/commerce/money";
import type { Product } from "@/lib/commerce/product";
import type { ShippingRate } from "./types";

/**
 * Demo catalog used when PRINTFUL_API_KEY is absent.
 *
 * Deliberately a single product, because the live shop is a single product:
 * Drop 01. A demo with four items would let a grid layout look fine locally and
 * break in production, which is the failure this fixture exists to prevent.
 *
 * Ids are negative, so a demo id can never be confused with a real Printful
 * sync id and a stray demo order can never match a live variant.
 */

const SIZES = ["S", "M", "L", "XL", "2XL"] as const;

/** Print-on-demand blanks carry an upcharge above XL. */
const SIZE_UPCHARGE: Partial<Record<(typeof SIZES)[number], number>> = {
  "2XL": 300,
};

function buildVariants(
  productId: number,
  price: number,
  colors: Array<{ name: string; swatch: string }>,
  soldOut: ReadonlyArray<[string, string]> = [],
) {
  const unavailable = new Set(soldOut.map(([color, size]) => `${color}/${size}`));

  return colors.flatMap((color, colorIndex) =>
    SIZES.map((size, sizeIndex) => ({
      // Deterministic negative ids, unique per product/colour/size.
      id: productId * 100 - (colorIndex * SIZES.length + sizeIndex) - 1,
      // Demo blanks have no real catalog counterpart.
      catalogVariantId: null,
      name: `${color.name} / ${size}`,
      size,
      color: color.name,
      price: money(price + (SIZE_UPCHARGE[size] ?? 0)),
      image: placeholder(color.swatch, color.name),
      available: !unavailable.has(`${color.name}/${size}`),
    })),
  );
}

/**
 * Inline SVG placeholder — no external image host, no network at build time.
 *
 * Dark field with the colourway named in tracked capitals, so the demo reads as
 * part of the storefront rather than as a broken image. Printful's real mockups
 * replace these the moment a token is configured.
 */
function placeholder(garment: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
<rect width="900" height="1200" fill="#1a181e"/>
<rect x="250" y="220" width="400" height="660" fill="${garment}"/>
<text x="450" y="972" font-family="Archivo, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="5" fill="#edeae3" text-anchor="middle">${label.toUpperCase()}</text>
<text x="450" y="1012" font-family="monospace" font-size="14" letter-spacing="4" fill="#5f5b55" text-anchor="middle">DROP 01</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: -1,
    slug: "drop-01-long-sleeve",
    name: "Drop 01 Long Sleeve",
    description:
      "Mid-weight cotton jersey, relaxed through the body, set-in sleeves and a ribbed collar that holds its shape. Printed to order, one at a time.",
    thumbnail: placeholder("#20222a", "Midnight"),
    images: [placeholder("#20222a", "Midnight")],
    variants: buildVariants(
      -1,
      4200,
      [
        { name: "Midnight", swatch: "#20222a" },
        { name: "Bone", swatch: "#e4dfd4" },
        { name: "Clay", swatch: "#9d7a63" },
      ],
      // A realistic gap: the picker must handle a colour/size pair that
      // simply is not made.
      [["Clay", "2XL"]],
    ),
  },
];

/** Flat-rate demo shipping options, shaped like real Printful rates. */
export const MOCK_SHIPPING_RATES: ShippingRate[] = [
  {
    id: "STANDARD",
    name: "Standard (demo)",
    rate: "4.99",
    currency: "USD",
    minDeliveryDays: 4,
    maxDeliveryDays: 8,
  },
  {
    id: "EXPRESS",
    name: "Express (demo)",
    rate: "14.99",
    currency: "USD",
    minDeliveryDays: 2,
    maxDeliveryDays: 3,
  },
];
