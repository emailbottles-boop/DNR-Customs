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
      <div className="relative aspect-4/5 overflow-hidden rounded-lg border border-border bg-surface">
        <ProductImage
          src={product.thumbnail}
          alt={product.name}
          priority={priority}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        {!inStock ? (
          <div className="absolute inset-x-0 bottom-0 bg-background/85 py-2 text-center">
            <span className="eyebrow">Sold out</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium transition-colors group-hover:text-accent">
          {product.name}
        </h3>
        {price ? (
          <p className="shrink-0 text-sm text-muted">
            {varies ? `from ${format(price)}` : format(price)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
