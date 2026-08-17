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
    <div className="mx-auto max-w-3xl px-6 py-40 text-center sm:px-10">
      <p className="label">Order received</p>
      <h1 className="display mt-10 text-7xl sm:text-8xl lg:text-9xl">
        Thank
        <br />
        you.
      </h1>

      {reference ? (
        <div className="mx-auto mt-16 max-w-xs border-t border-hairline-lit pt-6">
          <p className="label">Reference</p>
          <p className="mt-3 font-mono text-lg tracking-[0.14em] tabular-nums text-bone">
            {reference}
          </p>
        </div>
      ) : null}

      {/*
        The Stripe branch deliberately does not promise a receipt email: Stripe
        only sends one when successful-payment emails are switched on in the
        dashboard, and promising mail that never arrives is how support tickets
        start.
      */}
      {instructions ? (
        <p className="prose-body mx-auto mt-12 text-sm">{instructions}</p>
      ) : stripeSession ? (
        <p className="prose-body mx-auto mt-12 text-sm">
          Payment received. Your order goes into production shortly.
        </p>
      ) : (
        <p className="prose-body mx-auto mt-12 text-sm">
          We&apos;ve recorded your order and will follow up by email.
        </p>
      )}

      {reference ? (
        <p className="label mx-auto mt-6 max-w-sm text-bone-faint">
          Keep the reference handy if you need to get in touch.
        </p>
      ) : null}

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
