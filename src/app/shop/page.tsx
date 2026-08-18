import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { format } from "@/lib/commerce/money";
import { isInStock, optionValues, startingPrice } from "@/lib/commerce/product";
import type { Product } from "@/lib/commerce/product";
import { listProducts } from "@/lib/printful/store";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every piece in the current DNR Customs line.",
};

/**
 * A single product is presented as the drop it is — one full-width slab, image
 * against type — rather than as a lonely card in a grid built for six. The
 * grid only appears once there is genuinely a line to lay out.
 */
function DropFeature({ product }: { product: Product }) {
  const price = startingPrice(product);
  const colors = optionValues(product, "color");
  const sizes = optionValues(product, "size");
  const inStock = isInStock(product);

  return (
    <section className="border-t border-hairline">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Link
          href={`/shop/${product.slug}`}
          className="group relative block aspect-[4/5] overflow-hidden bg-surface focus-visible:outline-none sm:aspect-[3/4] lg:aspect-auto lg:min-h-[38rem]"
        >
          <ProductImage
            src={product.thumbnail}
            alt={product.name}
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
          {!inStock ? (
            <div className="absolute inset-x-0 bottom-0 bg-void/85 py-4 text-center">
              <span className="label">Sold out</span>
            </div>
          ) : null}
        </Link>

        <div className="flex flex-col justify-between gap-16 border-t border-hairline px-0 py-12 lg:border-t-0 lg:border-l lg:py-16 lg:pl-16">
          <div>
            <p className="label">Drop 01 — the piece</p>
            <h2 className="display mt-8 text-6xl sm:text-7xl">
              {product.name}
            </h2>
            {product.description ? (
              <p className="prose-body mt-8 text-sm">{product.description}</p>
            ) : null}
          </div>

          <div>
            <dl className="border-t border-hairline text-sm">
              {price ? (
                <div className="flex gap-6 border-b border-hairline py-4">
                  <dt className="label w-28 shrink-0 pt-0.5">Price</dt>
                  <dd className="label text-bone">{format(price)}</dd>
                </div>
              ) : null}
              {colors.length > 0 ? (
                <div className="flex gap-6 border-b border-hairline py-4">
                  <dt className="label w-28 shrink-0 pt-0.5">Colourways</dt>
                  <dd className="label text-bone">{colors.join(" / ")}</dd>
                </div>
              ) : null}
              {sizes.length > 0 ? (
                <div className="flex gap-6 border-b border-hairline py-4">
                  <dt className="label w-28 shrink-0 pt-0.5">Sizing</dt>
                  <dd className="label text-bone">{sizes.join(" / ")}</dd>
                </div>
              ) : null}
            </dl>

            <Link
              href={`/shop/${product.slug}`}
              className="btn btn-primary mt-10 w-full sm:w-auto"
            >
              View the piece
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function ShopPage() {
  const products = await listProducts();
  const single = products.length === 1;

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="py-20 sm:py-28">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-hairline pb-6">
          <p className="label">{single ? "Drop 01" : "The line"}</p>
          <p className="label">
            {products.length} {products.length === 1 ? "piece" : "pieces"} ·
            Made to order
          </p>
        </div>

        <h1 className="display mt-12 text-7xl sm:text-8xl lg:text-9xl">Shop</h1>

      </header>

      {products.length === 0 ? (
        <div className="border-t border-hairline py-28 sm:py-36">
          <p className="label">Nothing in the shop yet</p>
          <h2 className="display mt-8 text-5xl sm:text-6xl">
            Between
            <br />
            drops
          </h2>
          <p className="prose-body mt-8 text-sm">
            Products sync automatically from Printful. Add and publish a product
            there and it will appear here within a few minutes.
          </p>
        </div>
      ) : single ? (
        <div className="pb-24 sm:pb-32">
          <DropFeature product={products[0]} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 border-t border-hairline pt-16 pb-24 sm:grid-cols-2 sm:pb-32 lg:grid-cols-3">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
