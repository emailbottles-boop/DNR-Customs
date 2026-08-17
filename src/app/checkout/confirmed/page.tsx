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
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <p className="label">Order received</p>
      <h1 className="display mt-8 text-6xl sm:text-7xl">Thank you.</h1>

      {reference ? (
        <p className="mx-auto mt-12 max-w-md text-sm leading-relaxed text-ink-soft">
          Your reference is{" "}
          <span className="font-mono text-ink">{reference}</span>. Keep it handy
          if you need to get in touch.
        </p>
      ) : null}

      {/*
        The Stripe branch deliberately does not promise a receipt email: Stripe
        only sends one when successful-payment emails are switched on in the
        dashboard, and promising mail that never arrives is how support tickets
        start.
      */}
      {instructions ? (
        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
          {instructions}
        </p>
      ) : stripeSession ? (
        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
          Payment received. Your order goes into production shortly.
        </p>
      ) : (
        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
          We&apos;ve recorded your order and will follow up by email.
        </p>
      )}

      <div className="mt-16 flex flex-wrap justify-center gap-4">
        <Link href="/shop" className="btn btn-primary">
          Keep shopping
        </Link>
        <a
          href={`mailto:${config.brand.email}${
            reference ? `?subject=Order ${encodeURIComponent(reference)}` : ""
          }`}
          className="btn btn-ghost"
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
