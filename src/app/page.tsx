import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/printful/store";
import { config } from "@/lib/config";

/**
 * The house principles, set as a hairline-ruled triptych rather than boxes —
 * three short columns read as a colophon, not as feature cards.
 */
const PRINCIPLES = [
  {
    title: "Print on demand",
    body: "Every piece is produced after the order is placed. No deadstock, no markdown season, nothing burned at the end of the line.",
  },
  {
    title: "Heavyweight only",
    body: "220gsm cotton and upward. Cloth chosen to hold its shape and its colour long past a single season.",
  },
  {
    title: "Made near you",
    body: "Orders route to the production house closest to the address, so the garment travels a short distance to arrive.",
  },
];

export default async function HomePage() {
  const products = await listProducts();
  const featured = products.slice(0, 3);

  return (
    <div>
      {/* Hero — a full-height title page: rule, statement, rule. */}
      <section className="border-b border-rule">
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-between gap-16 px-5 py-14 sm:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-rule pb-6">
            <p className="label">Printed to order</p>
            <p className="label">Small runs · No deadstock</p>
          </div>

          <h1 className="display text-6xl sm:text-7xl lg:text-8xl">
            Built for
            <br />
            the long
            <br />
            <span className="editorial">haul.</span>
          </h1>

          <div className="grid gap-12 border-t border-rule pt-10 sm:grid-cols-12">
            <p className="prose-editorial text-sm sm:col-span-7 lg:col-span-5">
              {config.brand.name} makes heavyweight staples with considered
              graphics. Nothing is warehoused — each piece is printed at the
              moment it is ordered, so we never make what nobody wanted.
            </p>

            <div className="flex flex-wrap items-start gap-3 sm:col-span-5 lg:col-span-4 lg:col-start-9">
              <Link href="/shop" className="btn btn-primary">
                Shop the collection
              </Link>
              <Link href="/about" className="btn btn-ghost">
                How it&apos;s made
              </Link>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-b border-rule pb-8">
            <div>
              <p className="label">Selected pieces</p>
              <h2 className="display mt-5 text-5xl sm:text-6xl">
                The current line
              </h2>
            </div>
            <Link href="/shop" className="label link-rule shrink-0">
              View the full shop
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:pb-32">
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
          {PRINCIPLES.map((item, index) => (
            <div key={item.title} className="border-t border-rule pt-6">
              <p className="label">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-6 text-base font-normal">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* The single inverted panel: one held note before the footer. */}
      <section className="bg-inverse text-inverse-ink">
        <div className="mx-auto max-w-6xl px-5 py-28 sm:py-36">
          <p className="label text-inverse-ink">On making</p>
          <p className="editorial mt-10 max-w-3xl text-4xl leading-tight sm:text-5xl lg:text-6xl">
            A wardrobe worth keeping begins with making less of it, and making
            none of it before someone has asked.
          </p>
          <Link
            href="/about"
            className="label link-rule mt-14 inline-block text-inverse-ink"
          >
            Read how it&apos;s made
          </Link>
        </div>
      </section>
    </div>
  );
}
