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
    <div className="mx-auto max-w-2xl px-5 py-28 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="display mt-3 text-4xl">We couldn&apos;t load that</h1>
      <p className="mt-3 text-sm text-muted">
        This is usually temporary. Try again, and if it keeps happening the shop
        may be between catalog syncs.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-muted"
        >
          Go home
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-xs text-muted">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
