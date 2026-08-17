import Link from "next/link";
import { config } from "@/lib/config";

export function SiteFooter({ demoMode }: { demoMode: boolean }) {
  return (
    <footer className="mt-32 border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-20 sm:flex-row sm:items-end sm:justify-between sm:gap-16 sm:px-8 sm:py-24">
        <div>
          {/* The wordmark is the graphic down here — set large and cropped tight. */}
          <p className="display text-4xl text-bone sm:text-6xl">
            D&amp;R Customs
          </p>
          <p className="prose-body mt-6 text-sm">{config.brand.tagline}</p>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <Link
            href="/shop"
            className="label link-rule transition-colors duration-200 hover:text-bone"
          >
            Shop
          </Link>
          <a
            href={`mailto:${config.brand.email}`}
            className="label link-rule transition-colors duration-200 hover:text-bone"
          >
            {config.brand.email}
          </a>
        </div>
      </div>

      {/* Technical facts, in the mono register: hairline strip, no box. */}
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-10 gap-y-3 px-5 py-6 sm:px-8">
          <span className="label text-bone-faint">Printed to order</span>
          <span className="label text-bone-faint">Ships worldwide</span>
        </div>
      </div>

      {demoMode ? (
        <div className="border-t border-hairline bg-void">
          <p className="label mx-auto max-w-6xl px-5 py-6 text-center text-bone-faint sm:px-8">
            Demo catalog — set PRINTFUL_API_KEY to load real products
          </p>
        </div>
      ) : null}
    </footer>
  );
}
