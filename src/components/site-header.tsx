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
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Link
          href="/"
          className="display text-xl tracking-tight"
          aria-label="DNR Customs — home"
        >
          DNR<span className="text-accent">.</span>
        </Link>

        <nav className="flex items-center gap-6" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`text-sm transition-colors hover:text-foreground ${
                  active ? "text-foreground" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/cart"
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            Cart
            {/* Suppressed until hydrated: the server can't know the count. */}
            <span
              className={`min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold transition-opacity ${
                count > 0
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface-raised text-muted"
              } ${ready ? "opacity-100" : "opacity-0"}`}
              aria-label={ready ? `${count} items in cart` : undefined}
            >
              {count}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
