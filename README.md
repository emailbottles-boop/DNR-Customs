# DNR Customs

Storefront for a print-on-demand clothing brand. Products and fulfilment come
from **Printful**; payments run through a provider seam that ships with a manual
(invoice) provider and a working **Stripe Checkout** adapter that switches on
when you add a key.

Built with Next.js 16 (App Router), React 19, Tailwind v4, and TypeScript.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**No credentials are needed to run it.** With no `PRINTFUL_API_KEY`, the shop
serves a built-in demo catalog of three products so the whole flow — browse,
variant picking, cart, shipping quote, checkout — works offline. A banner in the
footer makes clear when you're on demo data.

To connect a real store, copy `.env.example` to `.env.local` and add a Printful
token.

## How it fits together

```
Browser
  └─ cart in localStorage ──────────────┐
                                        │  variant ids + quantities only
                                        ▼
  POST /api/shipping  ──►  checkout/service  ──►  Printful  (rates)
  POST /api/orders    ──►  checkout/service  ──►  Printful  (draft order)
                                     └──────────►  PaymentProvider
                                                     ├─ manual  (default)
                                                     └─ stripe  (when keyed)
```

| Path | Role |
| --- | --- |
| `src/lib/commerce/` | Domain core — money, products, cart. Pure, no I/O, fully unit tested. |
| `src/lib/printful/` | Printful adapter: HTTP client, wire→domain mapping, demo catalog. |
| `src/lib/payments/` | `PaymentProvider` interface + manual and Stripe adapters. |
| `src/lib/checkout/` | Orchestration: re-price, quote shipping, place order, take payment. |
| `src/app/` | Routes, pages, and the two API endpoints. |

### Three decisions worth knowing

**Money is integer minor units, everywhere.** Printful returns prices as decimal
strings (`"29.50"`). They're parsed into cents at the boundary and stay integers
until rendered. Floating-point money is how a storefront ends up charging
`$29.509999`.

**The client never sends prices.** The cart posts variant ids and quantities;
the server re-prices from the catalog. A tampered request can change *what* you
order, never *what it costs*.

**Orders are created unconfirmed.** An unconfirmed Printful order is a draft: it
is never printed and never billed. That makes a bug in checkout free rather than
expensive. Flip `PRINTFUL_AUTO_CONFIRM=true` only once payment capture is live.

## Design

The storefront has an editorial, high-fashion identity: a warm ivory ground,
near-black ink, Cormorant Garamond for statement type and Jost for everything
functional, square corners and hairline rules throughout. There is no chromatic
accent — the garments are the only saturated thing on the page.

**[`DESIGN.md`](./DESIGN.md) is the source of truth.** It lists the tokens, the
component classes (`.display`, `.label`, `.btn`, `.swatch`, `.field-input`), and
the house rules. Read it before adding a page so the system stays coherent.

## Connecting Printful

1. In Printful: **Settings → Developers → Add token**. Grant read access to
   Products and read/write to Orders.
2. Put it in `.env.local` as `PRINTFUL_API_KEY`.
3. If the token is account-level rather than store-level, also set
   `PRINTFUL_STORE_ID`.
4. Check it worked:

   ```bash
   npm run printful:check
   ```

   This makes read-only requests and prints, per product, the URL it will get,
   its price range, and the sizes and colours parsed from each variant. It flags
   anything that won't appear in the shop (usually a product with no retail
   price set) and any variant whose option names it couldn't read.

   That last check matters: Printful reports variant options as unlabelled text
   (`"Black / L"`), so the storefront infers which token is the size. If the
   script reports unparsed variants, add the missing size token to `SIZE_TOKENS`
   in `src/lib/printful/catalog.ts`.

Products appear automatically — anything published in your Printful store shows
up in the shop. The catalog is cached for 5 minutes.

Product URLs are `/shop/<name>-<printful-id>`, so two products sharing a name
stay distinct and a lookup never has to guess.

## Turning on Stripe

Set `STRIPE_SECRET_KEY` and checkout switches from invoicing to Stripe Checkout
on the next boot — no code change. The adapter is implemented against Stripe's
REST API and creates a session with your line items, shipping rate, and the
order reference as `client_reference_id`.

One piece is deliberately left to do, because it needs a real Stripe account to
build against: **a `/api/webhooks/stripe` route that confirms the Printful draft
order once `checkout.session.completed` fires.** Until that exists, a Stripe
payment succeeds and the Printful order stays a draft awaiting manual
confirmation — safe, but manual. `STRIPE_WEBHOOK_SECRET` is reserved for it.

## Commands

```bash
npm run dev             # dev server
npm run build           # production build
npm start               # serve the production build
npm test                # unit tests (vitest)
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run printful:check  # verify the Printful connection and catalog mapping
```

## Tests

65 unit tests cover the parts where a silent bug costs money or trust: money
parsing and arithmetic, cart operations and recovery from corrupt localStorage,
the Printful response mapping, and Stripe's form encoding.

The demo catalog means the full request path can also be exercised without
credentials:

```bash
npm run build && npm start

curl -X POST localhost:3000/api/shipping \
  -H 'Content-Type: application/json' \
  -d '{"recipient":{"name":"Test","email":"t@example.com","address1":"12 Mill Lane","city":"Portland","state_code":"OR","country_code":"US","zip":"97201"},"items":[{"variantId":-101,"quantity":2}]}'
```

## Deploying

Any Node host works. On Vercel, import the repo and add the environment
variables from `.env.example`; no other configuration is needed.

Set `NEXT_PUBLIC_SITE_URL` to the real public origin — payment redirects are
built from it, so a wrong value sends customers to a 404 after paying.
