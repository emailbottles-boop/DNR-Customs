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
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link
        href="/shop"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← Back to shop
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="relative aspect-4/5 overflow-hidden rounded-lg border border-border bg-surface">
            <ProductImage
              src={product.thumbnail}
              alt={product.name}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
            />
          </div>

          {product.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {product.images.slice(1, 5).map((image) => (
                <div
                  key={image}
                  className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface"
                >
                  <ProductImage
                    src={image}
                    alt=""
                    sizes="(min-width: 1024px) 12vw, 25vw"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:pt-2">
          <h1 className="display text-3xl sm:text-4xl">{product.name}</h1>

          {product.description ? (
            <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">
              {product.description}
            </p>
          ) : null}

          <ProductPurchase product={product} />

          <dl className="mt-10 space-y-3 border-t border-border pt-7 text-sm">
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Production</dt>
              <dd>Printed to order, 2–5 business days</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Shipping</dt>
              <dd>Calculated at checkout, worldwide</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Returns</dt>
              <dd>Misprints and damage replaced free</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
