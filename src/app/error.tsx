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
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <p className="label">Something broke</p>
      <h1 className="display mt-8 text-6xl sm:text-7xl">
        We couldn&apos;t load that
      </h1>
      <p className="mx-auto mt-10 max-w-md text-sm leading-relaxed text-ink-soft">
        This is usually temporary. Try again, and if it keeps happening the shop
        may be between catalog syncs.
      </p>

      <div className="mt-14 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Go home
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-16 font-mono text-xs text-ink-faint">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
