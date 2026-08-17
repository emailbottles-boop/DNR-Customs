import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/printful/store";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every piece in the current DNR Customs line.",
};

export default async function ShopPage() {
  const products = await listProducts();

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <p className="eyebrow">The line</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">Shop</h1>
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted">
        {products.length} {products.length === 1 ? "piece" : "pieces"} available.
        Everything is printed to order and ships in 2–7 business days.
      </p>

      {products.length === 0 ? (
        <div className="mt-14 rounded-lg border border-border bg-surface p-10 text-center">
          <p className="text-sm font-medium">Nothing in the shop yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Products sync automatically from Printful. Add and publish a product
            there and it will appear here within a few minutes.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
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
