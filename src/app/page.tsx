import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { ProductPurchase } from "@/components/product-purchase";
import { PRINT_PLACEMENT } from "@/lib/commerce/copy";
import { format } from "@/lib/commerce/money";
import { isInStock, startingPrice } from "@/lib/commerce/product";
import { listProducts } from "@/lib/printful/store";

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
      </section>
    );
  }

  const price = startingPrice(drop);
  const inStock = isInStock(drop);

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

          <div className="mt-12 grid items-start gap-x-16 gap-y-12 pb-20 sm:mt-16 sm:pb-24 lg:grid-cols-12">
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
                  {format(price)}
                </p>
              ) : null}

              {drop.description ? (
                <p className="prose-body mt-8 text-sm">{drop.description}</p>
              ) : null}

              {/*
                The picker lives here rather than a page away. Buying used to
                cost a click to /shop/[slug] before the shopper could touch a
                size, and this shop sells one thing — the landing page is the
                product page. Placement is stated before the picker for the
                same reason it is there: the mockup is a front view, the print
                is on the back, and nobody should choose a size without
                knowing that.
              */}
              <p className="mt-8 flex gap-3 border-l-2 border-signal py-1 pl-4 text-sm text-bone">
                <span className="label shrink-0 pt-0.5">Print</span>
                <span>{PRINT_PLACEMENT}</span>
              </p>

              <ProductPurchase product={drop} showPrice={false} />

              {/* Sizes and colourways are gone from here: the picker above is
                  a better statement of both than a list repeating them. */}
              <dl className="mt-12 border-t border-hairline text-sm">
                <div className="flex gap-6 border-b border-hairline py-4">
                  <dt className="label w-28 shrink-0 pt-1">Production</dt>
                  <dd className="label text-bone">2–5 working days</dd>
                </div>
                <div className="flex gap-6 border-b border-hairline py-4">
                  <dt className="label w-28 shrink-0 pt-1">Details</dt>
                  <dd className="label text-bone">
                    <Link href={`/shop/${drop.slug}`} className="link-rule">
                      Sizing, shipping, returns
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
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
