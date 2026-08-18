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

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group block focus-visible:outline-none"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        <ProductImage
          src={product.thumbnail}
          alt={product.name}
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
        {!inStock ? (
          <div className="absolute inset-x-0 bottom-0 bg-void/85 py-3 text-center">
            <span className="label">Sold out</span>
          </div>
        ) : null}
      </div>

      {/* Hairline under the image, not a box around it. */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-hairline pt-4 transition-colors duration-200 group-hover:border-hairline-lit">
        <h3 className="display-sub text-base text-bone">{product.name}</h3>
        {price ? (
          <p className="label shrink-0">
            {format(price)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
