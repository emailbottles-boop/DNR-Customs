import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRINT_PLACEMENT } from "@/lib/commerce/copy";
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

  const gallery = product.images.slice(1, 5);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-hairline py-6">
        <Link href="/shop" className="label link-rule">
          ← Back to shop
        </Link>
        <p className="label">Drop 01</p>
      </div>

      {/* The name is the graphic: set large across the full measure, cropped
          close, before the buying furniture starts. */}
      <h1 className="display mt-14 text-6xl sm:mt-20 sm:text-8xl lg:text-9xl">
        {product.name}
      </h1>

      <div className="mt-16 grid gap-14 sm:mt-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-20">
        <div>
          <div className="relative aspect-[3/4] overflow-hidden bg-surface">
            <ProductImage
              src={product.thumbnail}
              alt={product.name}
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
            />
          </div>

          {gallery.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {gallery.map((image) => (
                <div
                  key={image}
                  className="relative aspect-[4/5] overflow-hidden bg-surface"
                >
                  <ProductImage
                    src={image}
                    alt=""
                    sizes="(min-width: 1024px) 30vw, 45vw"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-28 lg:h-fit">
          {product.description ? (
            <p className="prose-body text-sm">{product.description}</p>
          ) : null}

          {/*
            Placement sits above the picker, not in the spec list below it.
            The mockup is a front view and the print is on the back, so a buyer
            who reads only the image walks away with the wrong idea. Stating it
            before they choose a size is the point.
          */}
          <p className="mt-8 flex gap-3 border-l-2 border-signal py-1 pl-4 text-sm text-bone">
            <span className="label shrink-0 pt-0.5">Print</span>
            <span>{PRINT_PLACEMENT}</span>
          </p>

          <ProductPurchase product={product} />

          <dl className="mt-16 border-t border-hairline text-sm">
            <div className="flex gap-6 border-b border-hairline py-4">
              <dt className="label w-28 shrink-0 pt-0.5">Placement</dt>
              <dd className="text-bone-soft">{PRINT_PLACEMENT}</dd>
            </div>
            <div className="flex gap-6 border-b border-hairline py-4">
              <dt className="label w-28 shrink-0 pt-0.5">Sizing</dt>
              <dd className="text-bone-soft">
                Unisex, true to size. Size up for a boxier fit.
              </dd>
            </div>
            <div className="flex gap-6 border-b border-hairline py-4">
              <dt className="label w-28 shrink-0 pt-0.5">Production</dt>
              <dd className="text-bone-soft">
                Printed to order, 2–5 business days
              </dd>
            </div>
            <div className="flex gap-6 border-b border-hairline py-4">
              <dt className="label w-28 shrink-0 pt-0.5">Shipping</dt>
              <dd className="text-bone-soft">
                Calculated at checkout, worldwide
              </dd>
            </div>
            <div className="flex gap-6 border-b border-hairline py-4">
              <dt className="label w-28 shrink-0 pt-0.5">Returns</dt>
              <dd className="text-bone-soft">
                Misprints and damage replaced free
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
