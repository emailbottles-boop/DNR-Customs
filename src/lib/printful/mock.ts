import { money } from "@/lib/commerce/money";
import type { Product } from "@/lib/commerce/product";
import type { ShippingRate } from "./types";

/**
 * Demo catalog used when PRINTFUL_API_KEY is absent.
 *
 * This exists so the storefront renders, builds, and can be developed against
 * with no credentials and no network. Product ids are negative, which makes it
 * impossible to confuse a demo id with a real Printful sync id, and guarantees
 * a stray demo order can never match a live variant.
 */

const SIZES = ["S", "M", "L", "XL", "2XL"] as const;

function buildVariants(
  productId: number,
  price: number,
  colors: Array<{ name: string; swatch: string }>,
) {
  return colors.flatMap((color, colorIndex) =>
    SIZES.map((size, sizeIndex) => ({
      // Deterministic negative ids, unique per product/colour/size.
      id: productId * 100 - (colorIndex * SIZES.length + sizeIndex) - 1,
      name: `${color.name} / ${size}`,
      size,
      color: color.name,
      // Larger sizes carry the usual print-on-demand upcharge.
      price: money(price + (size === "2XL" ? 300 : 0)),
      image: placeholder(color.swatch, `${color.name} ${size}`),
      available: !(color.name === "Bone" && size === "2XL"),
    })),
  );
}

/** Inline SVG placeholder: no external image host, no network at build time. */
function placeholder(background: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="${background}"/>
<text x="400" y="500" font-family="system-ui, sans-serif" font-size="34" fill="#00000055" text-anchor="middle">${label}</text>
<text x="400" y="545" font-family="system-ui, sans-serif" font-size="20" fill="#00000033" text-anchor="middle">DEMO CATALOG</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: -1,
    slug: "dnr-heavyweight-tee--1",
    name: "DNR Heavyweight Tee",
    description:
      "220gsm combed cotton, boxy fit, screen-printed front hit. The staple the whole line is built around.",
    thumbnail: placeholder("#e7e4dd", "Heavyweight Tee"),
    images: [placeholder("#e7e4dd", "Heavyweight Tee")],
    variants: buildVariants(-1, 3800, [
      { name: "Bone", swatch: "#e7e4dd" },
      { name: "Black", swatch: "#1b1b1b" },
      { name: "Faded Olive", swatch: "#6b7157" },
    ]),
  },
  {
    id: -2,
    slug: "dnr-embroidered-hoodie--2",
    name: "DNR Embroidered Hoodie",
    description:
      "Heavy fleece pullover with a stitched chest mark, double-lined hood and ribbed cuffs.",
    thumbnail: placeholder("#2c2f36", "Embroidered Hoodie"),
    images: [placeholder("#2c2f36", "Embroidered Hoodie")],
    variants: buildVariants(-2, 7400, [
      { name: "Charcoal", swatch: "#2c2f36" },
      { name: "Sand", swatch: "#cbb99d" },
    ]),
  },
  {
    id: -3,
    slug: "dnr-work-cap--3",
    name: "DNR Work Cap",
    description:
      "Unstructured six-panel cap, cotton twill, adjustable strap back. One size.",
    thumbnail: placeholder("#3f4a3c", "Work Cap"),
    images: [placeholder("#3f4a3c", "Work Cap")],
    variants: [
      {
        id: -301,
        name: "Olive / One Size",
        size: "One Size",
        color: "Olive",
        price: money(3200),
        image: placeholder("#3f4a3c", "Work Cap Olive"),
        available: true,
      },
      {
        id: -302,
        name: "Black / One Size",
        size: "One Size",
        color: "Black",
        price: money(3200),
        image: placeholder("#1b1b1b", "Work Cap Black"),
        available: true,
      },
    ],
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
