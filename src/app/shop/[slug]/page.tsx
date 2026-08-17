import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { ProductPurchase } from "@/components/product-purchase";
import { getProductBySlug, listProducts } from "@/lib/printful/store";

/** Pre-render the catalog at build time; new products fall back to on-demand. */
export async function generateStaticParams() {
  const products = await listProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };

  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.thumbnail ? [product.thumbnail] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
      <Link href="/shop" className="label link-rule">
        ← Back to shop
      </Link>

      <div className="mt-14 grid gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-24">
        <div>
          <div className="relative aspect-[3/4] overflow-hidden bg-paper-deep">
            <ProductImage
              src={product.thumbnail}
              alt={product.name}
              sizes="(min-width: 1024px) 55vw, 100vw"
              priority
            />
          </div>

          {product.images.length > 1 ? (
            <div className="mt-6 grid grid-cols-2 gap-6">
              {product.images.slice(1, 5).map((image) => (
                <div
                  key={image}
                  className="relative aspect-[4/5] overflow-hidden bg-paper-deep"
                >
                  <ProductImage
                    src={image}
                    alt=""
                    sizes="(min-width: 1024px) 27vw, 45vw"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <h1 className="display text-5xl sm:text-6xl">{product.name}</h1>

          {product.description ? (
            <p className="prose-editorial mt-8 text-sm">
              {product.description}
            </p>
          ) : null}

          <ProductPurchase product={product} />

          <dl className="mt-20 border-t border-rule text-sm">
            <div className="flex gap-6 border-b border-rule py-5">
              <dt className="label w-32 shrink-0 pt-1">Production</dt>
              <dd className="text-ink-soft">
                Printed to order, 2–5 business days
              </dd>
            </div>
            <div className="flex gap-6 border-b border-rule py-5">
              <dt className="label w-32 shrink-0 pt-1">Shipping</dt>
              <dd className="text-ink-soft">Calculated at checkout, worldwide</dd>
            </div>
            <div className="flex gap-6 border-b border-rule py-5">
              <dt className="label w-32 shrink-0 pt-1">Returns</dt>
              <dd className="text-ink-soft">Misprints and damage replaced free</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
