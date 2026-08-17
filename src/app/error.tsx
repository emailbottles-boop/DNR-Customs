"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catches render-time failures — most likely Printful being unreachable while
 * a catalog page renders. The customer gets a retry rather than a stack trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront] render failed:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-40 text-center sm:px-10">
      <p className="label">Something broke</p>
      <h1 className="display mt-10 text-7xl sm:text-8xl lg:text-9xl">
        We couldn&apos;t
        <br />
        load that
      </h1>
      <p className="prose-body mx-auto mt-12 text-sm">
        This is usually temporary. Try again, and if it keeps happening the shop
        may be between catalog syncs.
      </p>

      <div className="mt-16 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Go home
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-20 border-t border-hairline pt-8 font-mono text-xs tracking-[0.2em] text-bone-faint uppercase">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
