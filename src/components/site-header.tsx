"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./use-cart";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const { count, ready } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ground/90 backdrop-blur">
      {/*
        A compact technical bar: logotype flush left, mono nav flush right.
        Nothing here takes the signal colour — the chrome stays behind the
        product, and the accent belongs to the page's primary action.
      */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-5 sm:h-16 sm:px-8">
        <Link
          href="/"
          className="display text-lg text-bone transition-colors duration-200 hover:text-bone-soft sm:text-xl"
          aria-label="D&amp;R Customs — home"
        >
          D&amp;R Customs
        </Link>

        <nav
          className="flex items-center gap-5 sm:gap-8"
          aria-label="Main"
        >
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`label link-rule transition-colors duration-200 hover:text-bone ${
                  active ? "text-bone" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/cart"
            className="label link-rule transition-colors duration-200 hover:text-bone"
          >
            Cart{" "}
            {/* Suppressed until hydrated: the server can't know the count. */}
            <span
              className={`transition-opacity duration-200 ${
                ready ? "opacity-100" : "opacity-0"
              }`}
              aria-label={ready ? `${count} items in cart` : undefined}
            >
              ({count})
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
