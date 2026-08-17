import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/printful/store";
import { config } from "@/lib/config";

export default async function HomePage() {
  const products = await listProducts();
  const featured = products.slice(0, 3);

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <p className="eyebrow">Printed to order · Made in small runs</p>
          <h1 className="display mt-5 text-5xl sm:text-7xl lg:text-8xl">
            Built for
            <br />
            the long
            <br />
            <span className="text-accent">haul.</span>
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-muted">
            {config.brand.name} makes heavyweight staples with considered
            graphics. Nothing is warehoused — every piece is printed when you
            order it, so we never make what nobody wants.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
            >
              Shop the line
            </Link>
            <Link
              href="/about"
              className="rounded-md border border-border px-6 py-3 text-sm font-semibold transition-colors hover:border-muted"
            >
              How it&apos;s made
            </Link>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Selected pieces</p>
              <h2 className="display mt-2 text-3xl">In stock now</h2>
            </div>
            <Link
              href="/shop"
              className="shrink-0 text-sm text-muted transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                priority={index === 0}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {[
            {
              title: "Print on demand",
              body: "Each order is produced after it's placed. No deadstock, no landfill.",
            },
            {
              title: "Heavyweight only",
              body: "220gsm cotton and up. Garments that hold shape past one season.",
            },
            {
              title: "Ships worldwide",
              body: "Fulfilled from the facility closest to you to cut transit time.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-surface p-7">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
