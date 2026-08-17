import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "About",
  description: `How ${config.brand.name} makes and ships its garments.`,
};

const STEPS = [
  {
    title: "You order",
    body: "Nothing is made in advance. Your size and colourway are chosen at the moment you check out.",
  },
  {
    title: "We print",
    body: "The order routes to the production facility nearest you, where the graphic is printed or embroidered onto blank stock.",
  },
  {
    title: "It ships",
    body: "Most pieces leave production in two to five business days and travel domestically from there.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow">About</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">
        Made when you
        <br />
        <span className="text-accent">order it.</span>
      </h1>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          {config.brand.name} runs on print-on-demand. There is no warehouse of
          unsold stock, no end-of-season markdown, and no incinerator at the end
          of the line — the industry&apos;s least discussed habit.
        </p>
        <p>
          The trade-off is honest: your order takes a few days longer than
          something pulled off a shelf. In exchange, nothing gets made that
          nobody wanted, and we can carry a full size range in every colourway
          without gambling on which ones sell.
        </p>
      </div>

      <ol className="mt-14 space-y-px overflow-hidden rounded-lg border border-border bg-border">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-5 bg-surface p-7">
            <span className="eyebrow shrink-0 pt-1">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="text-sm font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 rounded-lg border border-border p-7">
        <h2 className="text-sm font-semibold">Sizing and returns</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Because each piece is made to order, we can&apos;t take returns on a change
          of mind. Misprints, defects, and shipping damage are replaced free —
          email {config.brand.email} with your order reference and a photo.
        </p>
      </div>

      <Link
        href="/shop"
        className="mt-12 inline-block rounded-md bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        Shop the line
      </Link>
    </div>
  );
}
