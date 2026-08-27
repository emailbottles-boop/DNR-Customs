"use client";

import Link from "next/link";
import { useCart } from "@/components/use-cart";
import { ProductImage } from "@/components/product-image";
import { MAX_UNITS_PER_ORDER } from "@/lib/commerce/cart";
import { format, multiply } from "@/lib/commerce/money";

export default function CartPage() {
  const { cart, count, total, ready, remove, updateQuantity } = useCart();

  // The cart lives in localStorage, so there is nothing to show until mount.
  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-32 sm:px-10">
        <p className="label">Loading cart…</p>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-36 text-center sm:px-10">
        <p className="label">Cart — empty</p>
        <h1 className="display mt-8 text-6xl sm:text-8xl">
          Nothing
          <br />
          selected
        </h1>
        <p className="prose-body mx-auto mt-10 text-sm">
          The current line is a short one — it rewards a slow look.
        </p>
        <Link href="/shop" className="btn btn-primary mt-14">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 sm:px-10">
      <header className="border-b border-hairline py-24 sm:py-28">
        <p className="label">
          {count} {count === 1 ? "item" : "items"}
        </p>
        <h1 className="display mt-6 text-7xl sm:text-8xl">Cart</h1>
      </header>

      <ul>
        {cart.lines.map((line) => (
          <li
            key={line.variantId}
            className="flex gap-6 border-b border-hairline py-10 sm:gap-10"
          >
            <Link
              href={`/shop/${line.slug}`}
              className="group relative aspect-[3/4] w-28 shrink-0 overflow-hidden bg-surface sm:w-36"
            >
              <ProductImage
                src={line.image}
                alt={line.productName}
                sizes="(min-width: 640px) 144px, 112px"
                className="transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <Link
                  href={`/shop/${line.slug}`}
                  className="display-sub link-rule text-lg sm:text-xl"
                >
                  {line.productName}
                </Link>
                <p className="label mt-4">{line.variantName}</p>
                <p className="mt-2 font-mono text-xs tabular-nums text-bone-faint">
                  {format(line.unitPrice)} each
                </p>
                <button
                  type="button"
                  onClick={() => remove(line.variantId)}
                  className="label link-rule mt-6 inline-block hover:text-bone"
                >
                  Remove
                </button>
              </div>

              <div className="flex items-end justify-between gap-8 sm:flex-col sm:items-end sm:gap-6">
                <label className="flex items-center gap-3">
                  <span className="sr-only">
                    Quantity for {line.productName} {line.variantName}
                  </span>
                  <span aria-hidden="true" className="label">
                    Qty
                  </span>
                  <select
                    value={line.quantity}
                    onChange={(event) =>
                      updateQuantity(line.variantId, Number(event.target.value))
                    }
                    className="border border-hairline-lit bg-surface px-3 py-2 font-mono text-xs tabular-nums text-bone transition-colors hover:border-bone-soft"
                  >
                    {Array.from(
                      { length: MAX_UNITS_PER_ORDER },
                      (_, index) => index + 1,
                    ).map((quantity) => (
                      <option key={quantity} value={quantity}>
                        {quantity}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="font-mono text-base whitespace-nowrap tabular-nums text-bone">
                  {format(multiply(line.unitPrice, line.quantity))}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-12 py-14 sm:flex-row sm:items-start sm:justify-between">
        <p className="prose-body max-w-xs text-xs">
          Shipping and tax calculated at checkout. Everything is printed to
          order.
        </p>

        <div className="w-full sm:max-w-xs">
          <div className="flex items-baseline justify-between gap-6 border-b border-hairline pb-5">
            <span className="label">Subtotal</span>
            <span className="font-mono text-lg tabular-nums text-bone">
              {format(total)}
            </span>
          </div>
          <Link href="/checkout" className="btn btn-primary mt-8 w-full">
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
