import Link from "next/link";
import { format } from "@/lib/commerce/money";
import { isInStock, startingPrice } from "@/lib/commerce/product";
import type { Product } from "@/lib/commerce/product";
import { ProductImage } from "./product-image";

export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const price = startingPrice(product);
  const inStock = isInStock(product);
  // "from $X" only when variants actually differ in price.
  const varies = new Set(product.variants.map((v) => v.price.amount)).size > 1;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group block focus-visible:outline-none"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-paper-deep">
        <ProductImage
          src={product.thumbnail}
          alt={product.name}
          priority={priority}
          sizes="(min-width: 1024px) 45vw, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
        />
        {!inStock ? (
          <div className="absolute inset-x-0 bottom-0 bg-paper/85 py-3 text-center">
            <span className="label">Sold out</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="label">{product.name}</h3>
        {price ? (
          <p className="label shrink-0">
            {varies ? `From ${format(price)}` : format(price)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
