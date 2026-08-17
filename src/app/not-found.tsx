import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-40 text-center sm:px-10">
      <p className="label">Error 404</p>
      <h1 className="display mt-10 text-7xl sm:text-8xl lg:text-9xl">
        Page
        <br />
        not found
      </h1>
      <p className="prose-body mx-auto mt-12 text-sm">
        The piece may have sold out, or the link may be out of date.
      </p>
      <Link href="/shop" className="btn btn-primary mt-16">
        Back to the shop
      </Link>
    </div>
  );
}
