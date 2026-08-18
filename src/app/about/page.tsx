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
    body: "Size, colourway and graphic are settled the moment you check out. Nobody guessed on your behalf six months earlier.",
  },
  {
    title: "We print",
    body: "The order routes to the press nearest you. Artwork goes onto heavyweight blank stock, gets finished by hand, and gets checked before it is boxed.",
  },
  {
    title: "It ships",
    body: "A few days on the press, then out the door and usually domestic from there. Short run, short trip.",
  },
];

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
      <header className="border-b border-hairline pb-14">
        <p className="label">About</p>
        <h1 className="display mt-8 text-6xl sm:text-8xl lg:text-9xl">
          Made when
          <br />
          you order it.
        </h1>
      </header>

      <div className="grid gap-x-16 gap-y-12 pt-14 sm:grid-cols-12">
        <div className="sm:col-span-4 lg:col-span-3">
          <p className="label">Method</p>
          <p className="label mt-3 text-bone">Made to order</p>
          <p className="label mt-8">Production</p>
          <p className="label mt-3 text-bone">2–5 working days</p>
          <p className="label mt-8">Runs</p>
          <p className="label mt-3 text-bone">One drop at a time</p>
        </div>

        <div className="sm:col-span-8 lg:col-span-9">
          <p className="display-sub max-w-2xl text-2xl sm:text-3xl">
            Nothing here exists until someone asks for it.
          </p>

          <div className="prose-body mt-10 space-y-6 text-sm">
            <p>
              {config.brand.name} works in drops, and a drop is finite. Nothing
              is made ahead of time and nothing is made twice over — your piece
              is cut, printed and finished for you, in the size and colourway
              you chose, and then it goes to you.
            </p>
            <p>
              The trade is plain: a few days longer than something pulled off a
              shelf. What you get back is a full size range in every colourway,
              nothing made that nobody wanted, and no incentive for us to shift
              leftovers at half price six weeks later.
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
              className="grid gap-x-16 gap-y-4 border-t border-hairline py-10 sm:grid-cols-12"
            >
              <p className="label sm:col-span-4 lg:col-span-3">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="sm:col-span-8 lg:col-span-9">
                <h3 className="display text-5xl sm:text-6xl">{step.title}</h3>
                <p className="prose-body mt-6 text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 grid gap-x-16 gap-y-6 border-t border-hairline pt-12 sm:mt-32 sm:grid-cols-12">
        <h2 className="label sm:col-span-4 lg:col-span-3">Sizing and returns</h2>
        <div className="prose-body sm:col-span-8 lg:col-span-9">
          <p className="text-sm">
            Each piece is printed for one person, so a change of mind is not a
            return — there is no shelf for it to go back to. Measurements sit on
            the product page. Ask us before it goes on the press and we&apos;ll
            answer; ask after and we can&apos;t undo it.
          </p>
          <p className="mt-5 text-sm">
            Misprints, defects and shipping damage get remade free. Mail{" "}
            <a
              href={`mailto:${config.brand.email}`}
              className="link-rule text-bone"
            >
              {config.brand.email}
            </a>{" "}
            with your order reference and a photo and we&apos;ll run it again.
          </p>
        </div>
      </section>

      <div className="mt-20 border-t border-hairline pt-12">
        <Link href="/shop" className="btn btn-primary">
          See Drop 01
        </Link>
      </div>
    </article>
  );
}
