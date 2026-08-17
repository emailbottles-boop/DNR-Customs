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
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/85 backdrop-blur">
      {/*
        Masthead: an empty first column on wide screens lets the wordmark sit
        dead centre while navigation stays flush right. Below `sm` the columns
        collapse to wordmark-left so the row never runs out of room.
      */}
      <div className="mx-auto grid h-20 max-w-6xl grid-cols-[1fr_auto] items-center gap-5 px-5 sm:h-24 sm:grid-cols-[1fr_auto_1fr] sm:gap-8">
        <Link
          href="/"
          className="-mr-[0.22em] text-xs uppercase tracking-[0.22em] text-ink sm:-mr-[0.36em] sm:col-start-2 sm:justify-self-center sm:text-[0.8125rem] sm:tracking-[0.36em]"
          aria-label="DNR Customs — home"
        >
          DNR Customs
        </Link>

        <nav
          className="flex items-center gap-4 justify-self-end sm:col-start-3 sm:gap-8"
          aria-label="Main"
        >
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`label link-rule transition-colors duration-300 hover:text-ink ${
                  active ? "text-ink" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/cart"
            className="label link-rule transition-colors duration-300 hover:text-ink"
          >
            Cart{" "}
            {/* Suppressed until hydrated: the server can't know the count. */}
            <span
              className={`transition-opacity duration-300 ${
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
