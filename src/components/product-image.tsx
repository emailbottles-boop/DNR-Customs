import Image from "next/image";

/**
 * Product imagery comes from two very different places: Printful's CDN in live
 * mode, and inline `data:` SVGs in the demo catalog. Next's optimizer can't
 * process a data URI, so those render unoptimized while real CDN images go
 * through the pipeline as normal.
 */
export function ProductImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
  className = "",
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-surface-raised ${className}`}
        // Decorative placeholder; the product name is already in the DOM.
        aria-hidden="true"
      >
        <span className="eyebrow">No image</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={src.startsWith("data:")}
      className={`object-cover ${className}`}
    />
  );
}
