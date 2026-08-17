"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "./use-cart";
import { format } from "@/lib/commerce/money";
import { optionValues } from "@/lib/commerce/product";
import type { Product, ProductVariant } from "@/lib/commerce/product";

/**
 * Variant selection and add-to-cart.
 *
 * Printful variants are a flat list, not a matrix — a colour/size pair may
 * simply not exist. Rather than let someone pick an impossible combination and
 * fail at the end, unavailable options are disabled as the selection narrows.
 */
export function ProductPurchase({ product }: { product: Product }) {
  const { add } = useCart();

  const colors = useMemo(() => optionValues(product, "color"), [product]);
  const sizes = useMemo(() => optionValues(product, "size"), [product]);

  const firstAvailable =
    product.variants.find((variant) => variant.available) ?? product.variants[0];

  const [color, setColor] = useState<string | null>(firstAvailable?.color ?? null);
  const [size, setSize] = useState<string | null>(firstAvailable?.size ?? null);
  const [added, setAdded] = useState(false);

  const selected: ProductVariant | undefined = useMemo(
    () =>
      product.variants.find(
        (variant) => variant.color === color && variant.size === size,
      ),
    [product.variants, color, size],
  );

  /** A size is offered only if it exists in the chosen colour, and vice versa. */
  const sizeAvailable = (candidate: string) =>
    product.variants.some(
      (variant) =>
        variant.size === candidate &&
        (color === null || variant.color === color) &&
        variant.available,
    );

  const colorAvailable = (candidate: string) =>
    product.variants.some(
      (variant) => variant.color === candidate && variant.available,
    );

  const canAdd = Boolean(selected?.available);
  const price = selected?.price ?? firstAvailable?.price;

  function handleAdd() {
    if (!selected || !canAdd) return;
    add(product, selected);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="mt-12 border-t border-rule pt-10">
      <p className="text-lg font-light">
        {price ? format(price) : "Unavailable"}
      </p>

      {colors.length > 0 ? (
        <fieldset className="mt-12">
          <legend className="label">
            Colour{color ? ` — ${color}` : ""}
          </legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {colors.map((option) => {
              const available = colorAvailable(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!available}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className="swatch px-5 py-3 text-[11px] uppercase tracking-[0.18em]"
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <fieldset className="mt-10">
          <legend className="label">Size{size ? ` — ${size}` : ""}</legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {sizes.map((option) => {
              const available = sizeAvailable(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!available}
                  aria-pressed={size === option}
                  onClick={() => setSize(option)}
                  className="swatch min-w-16 px-5 py-3 text-[11px] uppercase tracking-[0.18em]"
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-14 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="btn btn-primary"
        >
          {canAdd ? "Add to cart" : "Unavailable"}
        </button>

        <Link href="/cart" className="btn btn-ghost">
          {added ? "Added — view cart" : "View cart"}
        </Link>
      </div>

      {/* Announced politely so screen readers hear the result of the click. */}
      <p role="status" aria-live="polite" className="label mt-5 h-5">
        {added && selected ? `${product.name} (${selected.name}) added.` : ""}
      </p>

      {!canAdd && selected === undefined ? (
        <p className="mt-1 text-xs text-ink-soft">
          That combination isn&apos;t made. Try another colour or size.
        </p>
      ) : null}
    </div>
  );
}
