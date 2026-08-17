import Link from "next/link";
import { config } from "@/lib/config";

export function SiteFooter({ demoMode }: { demoMode: boolean }) {
  return (
    <footer className="mt-32 border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-20 sm:flex-row sm:items-end sm:justify-between sm:py-24">
        <div>
          <p className="-mr-[0.36em] text-[0.8125rem] uppercase tracking-[0.36em] text-ink">
            DNR Customs
          </p>
          <p className="editorial mt-5 text-xl text-ink-soft">
            {config.brand.tagline}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <Link
            href="/shop"
            className="label link-rule transition-colors duration-300 hover:text-ink"
          >
            Shop
          </Link>
          <a
            href={`mailto:${config.brand.email}`}
            className="label link-rule transition-colors duration-300 hover:text-ink"
          >
            {config.brand.email}
          </a>
        </div>
      </div>

      {demoMode ? (
        <div className="border-t border-rule">
          <p className="label mx-auto max-w-6xl px-5 py-6 text-center text-ink-faint">
            Demo catalog — set PRINTFUL_API_KEY to load real products
          </p>
        </div>
      ) : null}
    </footer>
  );
}
