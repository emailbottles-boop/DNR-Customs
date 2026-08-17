import Link from "next/link";
import { config } from "@/lib/config";

export function SiteFooter({ demoMode }: { demoMode: boolean }) {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="display text-lg">
            DNR<span className="text-accent">.</span> Customs
          </p>
          <p className="mt-1 text-sm text-muted">{config.brand.tagline}</p>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted sm:items-end">
          <Link href="/shop" className="transition-colors hover:text-foreground">
            Shop
          </Link>
          <a
            href={`mailto:${config.brand.email}`}
            className="transition-colors hover:text-foreground"
          >
            {config.brand.email}
          </a>
        </div>
      </div>

      {demoMode ? (
        <div className="border-t border-border px-5 py-3 text-center">
          <p className="eyebrow">
            Demo catalog — set PRINTFUL_API_KEY to load real products
          </p>
        </div>
      ) : null}
    </footer>
  );
}
