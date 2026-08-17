import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

/**
 * Landing page after checkout, for both providers: the manual flow arrives with
 * a reference in the query string, and Stripe returns here with its session id.
 */
export default async function ConfirmedPage({
  searchParams,
}: PageProps<"/checkout/confirmed">) {
  const params = await searchParams;
  const reference = firstValue(params.reference);
  const instructions = firstValue(params.instructions);
  const stripeSession = firstValue(params.session_id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <p className="eyebrow">Order received</p>
      <h1 className="display mt-3 text-4xl">Thank you.</h1>

      {reference ? (
        <p className="mt-6 text-sm text-muted">
          Your reference is{" "}
          <span className="font-mono text-foreground">{reference}</span>. Keep it
          handy if you need to get in touch.
        </p>
      ) : null}

      {instructions ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">{instructions}</p>
      ) : stripeSession ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Payment received. We&apos;ve emailed your receipt, and your order goes into
          production shortly.
        </p>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          We&apos;ve recorded your order and will follow up by email.
        </p>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-md bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          Keep shopping
        </Link>
        <a
          href={`mailto:${config.brand.email}${
            reference ? `?subject=Order ${encodeURIComponent(reference)}` : ""
          }`}
          className="rounded-md border border-border px-7 py-3.5 text-sm font-semibold transition-colors hover:border-muted"
        >
          Contact us
        </a>
      </div>
    </div>
  );
}

/** Query params can repeat; take the first occurrence. */
function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
