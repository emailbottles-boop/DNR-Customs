import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { format } from "@/lib/commerce/money";
import { isInStock, startingPrice } from "@/lib/commerce/product";
import { listProducts } from "@/lib/printful/store";
import { config } from "@/lib/config";

/**
 * The house notes, set as hairline-ruled columns rather than cards — a spec
 * sheet under the drop, not a row of feature boxes.
 */
const NOTES = [
  {
    title: "Yours specifically",
    body: "Nothing is made in advance. The piece that arrives was started because you asked for it, in the size and colourway you chose.",
  },
  {
    title: "Heavyweight blanks",
    body: "220gsm and up. Cloth picked to hold its shape and its colour through a hard rotation, not one summer.",
  },
  {
    title: "Worth the wait",
    body: "A few days on the press, then the shortest route we can find to your door. Made properly takes longer than pulled off a shelf.",
  },
];

export default async function HomePage() {
  const products = await listProducts();
  const drop = products[0];
  const rest = products.slice(1);

  // Nothing published yet: hold the drop framing, drop the noise.
  if (!drop) {
    return (
      <section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-6 py-24 sm:px-10">
        <p className="label">Drop 01 — pending</p>
        <h1 className="display mt-8 text-6xl sm:text-8xl">
          Nothing
          <br />
          live yet.
        </h1>
        <p className="prose-body mt-10 text-sm">
          {config.brand.name} runs one drop at a time and prints it to order.
          When the next one lands it will be here, in full, until it is done.
        </p>
      </section>
    );
  }

  const price = startingPrice(drop);
  const inStock = isInStock(drop);
  // "From $X" only when the variants actually disagree on price.
  const varies = new Set(drop.variants.map((variant) => variant.price.amount)).size > 1;
  const sizes = Array.from(
    new Set(
      drop.variants
        .map((variant) => variant.size)
        .filter((size): size is string => Boolean(size)),
    ),
  );
  const colours = Array.from(
    new Set(
      drop.variants
        .map((variant) => variant.color)
        .filter((colour): colour is string => Boolean(colour)),
    ),
  );

  return (
    <div>
      {/* The drop. Name set as the graphic, garment underneath it. */}
      <section className="border-b border-hairline">
        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-hairline py-5">
            <p className="label text-bone">Drop 01</p>
            <p className="label">
              {inStock ? "Live — printed to order" : "Sold out"}
            </p>
          </div>

          <h1 className="display mt-14 text-6xl sm:mt-20 sm:text-8xl lg:text-9xl">
            {drop.name}
          </h1>

          <div className="mt-12 grid items-start gap-x-16 gap-y-12 pb-20 sm:mt-16 sm:pb-24 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                <ProductImage
                  src={drop.thumbnail}
                  alt={drop.name}
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  priority
                  className="transition-transform duration-500 ease-out hover:scale-[1.03]"
                />
              </div>
            </div>

            <div className="lg:col-span-5">
              {price ? (
                <p className="display-sub text-4xl sm:text-5xl">
                  {varies ? `From ${format(price)}` : format(price)}
                </p>
              ) : null}

              {drop.description ? (
                <p className="prose-body mt-8 text-sm">{drop.description}</p>
              ) : null}

              <dl className="mt-12 border-t border-hairline text-sm">
                {sizes.length > 0 ? (
                  <div className="flex gap-6 border-b border-hairline py-4">
                    <dt className="label w-28 shrink-0 pt-1">Sizes</dt>
                    <dd className="label text-bone">{sizes.join(" · ")}</dd>
                  </div>
                ) : null}
                {colours.length > 0 ? (
                  <div className="flex gap-6 border-b border-hairline py-4">
                    <dt className="label w-28 shrink-0 pt-1">Colourways</dt>
                    <dd className="label text-bone">{colours.join(" · ")}</dd>
                  </div>
                ) : null}
                <div className="flex gap-6 border-b border-hairline py-4">
                  <dt className="label w-28 shrink-0 pt-1">Production</dt>
                  <dd className="label text-bone">2–5 working days</dd>
                </div>
              </dl>

              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link href={`/shop/${drop.slug}`} className="btn btn-primary">
                  {inStock ? "Get it" : "View the piece"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spec sheet. Hairlines, mono, no boxes. */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="grid gap-x-12 gap-y-12 sm:grid-cols-3">
          {NOTES.map((note, index) => (
            <div key={note.title} className="border-t border-hairline pt-6">
              <p className="label">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="display-sub mt-6 text-xl">{note.title}</h2>
              <p className="prose-body mt-4 text-sm">{note.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Anything beyond the drop hero. Absent while the shop carries one piece. */}
      {rest.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-20 sm:px-10 sm:pb-28">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-t border-hairline pt-8">
            <h2 className="display text-5xl sm:text-6xl">Still in stock</h2>
            <Link href="/shop" className="label link-rule shrink-0 text-bone">
              Everything
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
}
