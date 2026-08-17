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
    <div className="mx-auto max-w-6xl px-6 sm:px-10">
      <header className="border-b border-rule py-24 sm:py-32">
        <p className="label">The line</p>
        <h1 className="display mt-6 text-6xl sm:text-7xl lg:text-8xl">Shop</h1>
        <p className="prose-editorial mt-10 text-sm">
          {products.length} {products.length === 1 ? "piece" : "pieces"}{" "}
          available. Everything is printed to order and ships in 2–7 business
          days.
        </p>
      </header>

      {products.length === 0 ? (
        <div className="border-b border-rule py-32 text-center">
          <p className="label">Nothing in the shop yet</p>
          <p className="prose-editorial mx-auto mt-6 text-sm">
            Products sync automatically from Printful. Add and publish a product
            there and it will appear here within a few minutes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-x-12 gap-y-24 py-20 sm:grid-cols-2 sm:gap-x-16 sm:py-28 lg:gap-x-24 lg:gap-y-32">
          {products.map((product, index) => (
            // The second column is dropped a beat so the grid reads as a
            // spread rather than a table of thumbnails.
            <div key={product.id} className={index % 2 === 1 ? "sm:mt-28" : ""}>
              <ProductCard product={product} priority={index < 2} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
