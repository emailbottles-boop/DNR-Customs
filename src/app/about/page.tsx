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
    body: "Nothing exists in advance. The size, the colourway and the graphic are settled at the moment you check out — not months earlier by someone guessing at demand.",
  },
  {
    title: "We print",
    body: "The order routes to the production house nearest you, where the artwork is printed or embroidered onto blank stock and finished by hand.",
  },
  {
    title: "It ships",
    body: "Most pieces leave production within two to five working days and travel domestically from there, so the journey to you is a short one.",
  },
];

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
      <header className="border-b border-rule pb-12">
        <p className="label">About</p>
        <h1 className="display mt-6 text-6xl sm:text-7xl">
          Made when you
          <br />
          <span className="editorial">order it.</span>
        </h1>
      </header>

      <div className="grid gap-x-16 gap-y-12 pt-12 sm:grid-cols-12">
        <div className="sm:col-span-4 lg:col-span-3">
          <p className="label">Method</p>
          <p className="mt-4 text-sm text-ink-soft">Print on demand</p>
          <p className="label mt-8">Production</p>
          <p className="mt-4 text-sm text-ink-soft">Two to five working days</p>
        </div>

        <div className="sm:col-span-8 lg:col-span-9">
          <p className="editorial max-w-2xl text-3xl leading-snug sm:text-4xl">
            The house keeps no warehouse. There is no unsold stock, no
            end-of-season markdown, and no incinerator at the end of the line —
            the industry&apos;s least discussed habit.
          </p>

          <div className="prose-editorial mt-12 space-y-6 text-sm">
            <p>
              {config.brand.name} is made to order. Each garment begins as blank
              heavyweight stock and is printed only once a customer has asked
              for it, in the size and colourway they chose, at a production
              house near the address it will travel to.
            </p>
            <p>
              The trade-off is stated plainly: your order takes a few days
              longer than something pulled from a shelf. In exchange, nothing is
              produced that nobody wanted, and we can carry a full size range in
              every colourway without gambling on which ones sell.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-24 sm:mt-32">
        <h2 className="label">The sequence</h2>
        <ol className="mt-8">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-x-16 gap-y-4 border-t border-rule py-10 sm:grid-cols-12"
            >
              <p className="label sm:col-span-4 lg:col-span-3">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="sm:col-span-8 lg:col-span-9">
                <h3 className="display text-5xl">{step.title}</h3>
                <p className="prose-editorial mt-5 text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 grid gap-x-16 gap-y-6 border-t border-rule pt-12 sm:mt-32 sm:grid-cols-12">
        <h2 className="label sm:col-span-4 lg:col-span-3">Sizing and returns</h2>
        <div className="prose-editorial sm:col-span-8 lg:col-span-9">
          <p className="text-sm">
            Because each piece is made for one person, we cannot accept returns
            on a change of mind — the garment has nowhere to go back to.
            Measurements are listed on every product page, and we would rather
            answer a sizing question before printing than after.
          </p>
          <p className="mt-5 text-sm">
            Misprints, defects and shipping damage are replaced free. Write to{" "}
            <a
              href={`mailto:${config.brand.email}`}
              className="link-rule text-ink"
            >
              {config.brand.email}
            </a>{" "}
            with your order reference and a photograph, and we will remake it.
          </p>
        </div>
      </section>

      <div className="mt-20 border-t border-rule pt-12">
        <Link href="/shop" className="btn btn-primary">
          Shop the collection
        </Link>
      </div>
    </article>
  );
}
