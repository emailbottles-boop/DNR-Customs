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
      <div className="mx-auto max-w-4xl px-5 py-16">
        <p className="eyebrow">Loading cart…</p>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h1 className="display text-3xl">Your cart is empty</h1>
        <p className="mt-3 text-sm text-muted">
          Nothing here yet. The good stuff is one click away.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-md bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <p className="eyebrow">{count} {count === 1 ? "item" : "items"}</p>
      <h1 className="display mt-2 text-4xl">Cart</h1>

      <ul className="mt-10 divide-y divide-border border-y border-border">
        {cart.lines.map((line) => (
          <li key={line.variantId} className="flex gap-5 py-6">
            <Link
              href={`/shop/${line.slug}`}
              className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-md border border-border bg-surface"
            >
              <ProductImage src={line.image} alt={line.productName} sizes="96px" />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <Link
                  href={`/shop/${line.slug}`}
                  className="text-sm font-medium transition-colors hover:text-accent"
                >
                  {line.productName}
                </Link>
                <p className="mt-1 text-sm text-muted">{line.variantName}</p>
                <p className="mt-1 text-sm text-muted">
                  {format(line.unitPrice)} each
                </p>
                <button
                  type="button"
                  onClick={() => remove(line.variantId)}
                  className="mt-2 text-xs text-muted underline underline-offset-4 transition-colors hover:text-danger"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">
                    Quantity for {line.productName} {line.variantName}
                  </span>
                  <select
                    value={line.quantity}
                    onChange={(event) =>
                      updateQuantity(line.variantId, Number(event.target.value))
                    }
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
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
                <p className="text-sm font-semibold whitespace-nowrap">
                  {format(multiply(line.unitPrice, line.quantity))}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-end gap-4">
        <div className="flex w-full max-w-xs justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="font-semibold">{format(total)}</span>
        </div>
        <p className="text-xs text-muted">
          Shipping and tax calculated at checkout.
        </p>
        <Link
          href="/checkout"
          className="rounded-md bg-accent px-8 py-3.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
