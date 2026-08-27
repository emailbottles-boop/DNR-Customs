"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "./use-cart";
import { MAX_UNITS_PER_ORDER, itemCount } from "@/lib/commerce/cart";
import { format } from "@/lib/commerce/money";
import { optionValues, selectColor, selectSize } from "@/lib/commerce/product";
import type { Product, ProductVariant } from "@/lib/commerce/product";

/**
 * Variant selection and add-to-cart.
 *
 * Printful variants are a flat list, not a matrix — a colour/size pair may
 * simply not exist. Rather than let someone pick an impossible combination and
 * fail at the end, unavailable options are disabled as the selection narrows.
 */
export function ProductPurchase({
  product,
  showPrice = true,
}: {
  product: Product;
  /**
   * The home page sets the price as a display element above this block, so it
   * suppresses the quiet one here rather than printing the same number twice.
   */
  showPrice?: boolean;
}) {
  const { add, cart, ready } = useCart();
  // Suppressed until hydration so server and first client render agree.
  const atOrderCap = ready && itemCount(cart) >= MAX_UNITS_PER_ORDER;

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

  /**
   * Choosing one axis reconciles the other. Without this, picking a colour
   * that is not made in the current size strands the shopper on a combination
   * that does not exist, and the buy button silently reads "Unavailable".
   */
  function chooseColor(next: string) {
    const resolved = selectColor(product, next, size);
    setColor(resolved.color);
    setSize(resolved.size);
  }

  function chooseSize(next: string) {
    const resolved = selectSize(product, next, color);
    setColor(resolved.color);
    setSize(resolved.size);
  }

  const canAdd = Boolean(selected?.available) && !atOrderCap;
  const price = selected?.price ?? firstAvailable?.price;

  function handleAdd() {
    if (!selected || !canAdd) return;
    add(product, selected);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="mt-10 border-t border-hairline pt-8">
      {/* Price stays quiet and technical — the garment and the action shout. */}
      {showPrice ? (
        <p className="label text-sm text-bone">
          {price ? format(price) : "Unavailable"}
        </p>
      ) : null}

      {colors.length > 0 ? (
        <fieldset className={showPrice ? "mt-10" : "mt-2"}>
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
                  onClick={() => chooseColor(option)}
                  className="swatch px-5 py-3 uppercase"
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <fieldset className="mt-8">
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
                  onClick={() => chooseSize(option)}
                  className="swatch min-w-16 px-5 py-3 uppercase"
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="btn btn-primary flex-1"
        >
          {atOrderCap
            ? `Limit ${MAX_UNITS_PER_ORDER} per order`
            : canAdd
              ? "Add to cart"
              : "Unavailable"}
        </button>

        <Link href="/cart" className="btn btn-ghost flex-1">
          {added ? "Added — view cart" : "View cart"}
        </Link>
      </div>

      {/* Announced politely so screen readers hear the result of the click. */}
      <p role="status" aria-live="polite" className="label mt-5 h-5">
        {added && selected ? `${product.name} (${selected.name}) added.` : ""}
      </p>

      {!canAdd && selected === undefined ? (
        <p className="label mt-1 text-alert">
          That combination isn&apos;t made. Try another colour or size.
        </p>
      ) : null}
    </div>
  );
}
