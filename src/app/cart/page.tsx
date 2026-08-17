"use client";

import Link from "next/link";
import { useCart } from "@/components/use-cart";
import { ProductImage } from "@/components/product-image";
import { MAX_QUANTITY_PER_LINE } from "@/lib/commerce/cart";
import { format, multiply } from "@/lib/commerce/money";

export default function CartPage() {
  const { cart, count, total, ready, remove, updateQuantity } = useCart();

  // The cart lives in localStorage, so there is nothing to show until mount.
  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-24">
        <p className="label">Loading cart…</p>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-32 text-center">
        <p className="label">Cart</p>
        <h1 className="display mt-6 text-5xl sm:text-6xl">
          Your cart is empty
        </h1>
        <p className="mx-auto mt-8 max-w-sm text-sm leading-relaxed text-ink-soft">
          Nothing selected yet. The current line is a short one — it rewards a
          slow look.
        </p>
        <Link href="/shop" className="btn btn-primary mt-12">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-24">
      <p className="label">
        {count} {count === 1 ? "item" : "items"}
      </p>
      <h1 className="display mt-5 text-6xl sm:text-7xl">Cart</h1>

      <ul className="mt-16 border-t border-rule">
        {cart.lines.map((line) => (
          <li
            key={line.variantId}
            className="flex gap-6 border-b border-rule py-10 sm:gap-10"
          >
            <Link
              href={`/shop/${line.slug}`}
              className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden bg-paper-deep sm:w-36"
            >
              <ProductImage
                src={line.image}
                alt={line.productName}
                sizes="(min-width: 640px) 144px, 112px"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <Link
                  href={`/shop/${line.slug}`}
                  className="link-rule text-base"
                >
                  {line.productName}
                </Link>
                <p className="mt-3 text-sm text-ink-soft">{line.variantName}</p>
                <p className="mt-1 text-sm text-ink-faint">
                  {format(line.unitPrice)} each
                </p>
                <button
                  type="button"
                  onClick={() => remove(line.variantId)}
                  className="label link-rule mt-6 inline-block"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-end justify-between gap-8 sm:flex-col sm:items-end sm:gap-6">
                <label className="flex items-center gap-3">
                  <span className="sr-only">
                    Quantity for {line.productName} {line.variantName}
                  </span>
                  <select
                    value={line.quantity}
                    onChange={(event) =>
                      updateQuantity(line.variantId, Number(event.target.value))
                    }
                    className="border-b border-rule-strong bg-transparent py-2 pr-1 text-sm transition-colors focus:border-ink focus:outline-none"
                  >
                    {Array.from(
                      { length: MAX_QUANTITY_PER_LINE },
                      (_, index) => index + 1,
                    ).map((quantity) => (
                      <option key={quantity} value={quantity}>
                        {quantity}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm whitespace-nowrap">
                  {format(multiply(line.unitPrice, line.quantity))}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-14 flex flex-col items-stretch gap-8 sm:items-end">
        <div className="w-full sm:max-w-xs">
          <div className="flex justify-between border-b border-rule pb-4">
            <span className="label">Subtotal</span>
            <span className="text-sm">{format(total)}</span>
          </div>
          <p className="editorial mt-4 text-sm text-ink-soft">
            Shipping and tax calculated at checkout.
          </p>
        </div>
        <Link href="/checkout" className="btn btn-primary w-full sm:w-auto">
          Checkout
        </Link>
      </div>
    </div>
  );
}
