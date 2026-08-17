import { money } from "@/lib/commerce/money";
import type { Product } from "@/lib/commerce/product";
import type { ShippingRate } from "./types";

/**
 * Demo catalog used when PRINTFUL_API_KEY is absent.
 *
 * Shaped to mirror the real DNR Customs line so the storefront looks like
 * itself before credentials are added. Product ids are negative, which makes it
 * impossible to confuse a demo id with a real Printful sync id and guarantees a
 * stray demo order can never match a live variant.
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
 * Inline SVG placeholder — no external image host and no network at build time.
 *
 * Deliberately quiet: a paper-toned field with the colourway named in small
 * tracked capitals, so the demo reads as editorial rather than as a broken
 * image. Real photography replaces these the moment Printful is connected.
 */
function placeholder(garment: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
<rect width="900" height="1200" fill="#efece4"/>
<rect x="250" y="230" width="400" height="640" fill="${garment}"/>
<text x="450" y="965" font-family="Jost, Futura, system-ui, sans-serif" font-size="21" letter-spacing="4.6" fill="#14120f" text-anchor="middle">${label.toUpperCase()}</text>
<text x="450" y="1002" font-family="Jost, Futura, system-ui, sans-serif" font-size="14" letter-spacing="3.4" fill="#9c968b" text-anchor="middle">DNR CUSTOMS</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: -1,
    slug: "long-sleeve-shirt",
    name: "Long Sleeve Shirt",
    description:
      "A relaxed long sleeve cut in mid-weight cotton jersey, with set-in sleeves and a ribbed collar that holds its shape. Printed to order, one at a time.",
    thumbnail: placeholder("#20222a", "Midnight"),
    images: [placeholder("#20222a", "Midnight")],
    variants: buildVariants(-1, 4200, [
      { name: "Midnight", swatch: "#20222a" },
      { name: "Bone", swatch: "#e4dfd4" },
      { name: "Clay", swatch: "#9d7a63" },
    ]),
  },
  {
    id: -2,
    slug: "heavyweight-tee",
    name: "Heavyweight Tee",
    description:
      "220gsm combed cotton with a boxy body and a wide-set neck rib. The staple the rest of the line is drawn around.",
    thumbnail: placeholder("#e4dfd4", "Bone"),
    images: [placeholder("#e4dfd4", "Bone")],
    variants: buildVariants(
      -2,
      3800,
      [
        { name: "Bone", swatch: "#e4dfd4" },
        { name: "Black", swatch: "#171614" },
        { name: "Sage", swatch: "#7c8271" },
      ],
      // A realistic gap: the picker must handle a missing colour/size pair.
      [["Sage", "2XL"]],
    ),
  },
  {
    id: -3,
    slug: "embroidered-hoodie",
    name: "Embroidered Hoodie",
    description:
      "Heavy brushed fleece with a stitched chest mark, double-lined hood and ribbed cuffs. Cut long in the body.",
    thumbnail: placeholder("#2f3138", "Charcoal"),
    images: [placeholder("#2f3138", "Charcoal")],
    variants: buildVariants(-3, 7400, [
      { name: "Charcoal", swatch: "#2f3138" },
      { name: "Sand", swatch: "#c9b79c" },
    ]),
  },
  {
    id: -4,
    slug: "six-panel-cap",
    name: "Six-Panel Cap",
    description:
      "Unstructured cotton twill cap with an adjustable strap back. One size.",
    thumbnail: placeholder("#3d4438", "Olive"),
    images: [placeholder("#3d4438", "Olive")],
    variants: [
      {
        id: -401,
        catalogVariantId: null,
        name: "Olive / One Size",
        size: "One Size",
        color: "Olive",
        price: money(3200),
        image: placeholder("#3d4438", "Olive"),
        available: true,
      },
      {
        id: -402,
        catalogVariantId: null,
        name: "Black / One Size",
        size: "One Size",
        color: "Black",
        price: money(3200),
        image: placeholder("#171614", "Black"),
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
