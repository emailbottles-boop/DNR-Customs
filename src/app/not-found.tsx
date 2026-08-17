import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <p className="label">404</p>
      <h1 className="display mt-8 text-6xl sm:text-7xl">
        This page doesn&apos;t exist
      </h1>
      <p className="mx-auto mt-10 max-w-sm text-sm leading-relaxed text-ink-soft">
        The piece may have sold out, or the link may be out of date.
      </p>
      <Link href="/shop" className="btn btn-primary mt-14">
        Back to the shop
      </Link>
    </div>
  );
}
