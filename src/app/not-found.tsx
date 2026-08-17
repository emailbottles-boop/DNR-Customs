import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-4xl">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-sm text-muted">
        The piece may have sold out or the link may be out of date.
      </p>
      <Link
        href="/shop"
        className="mt-8 inline-block rounded-md bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        Back to the shop
      </Link>
    </div>
  );
}
