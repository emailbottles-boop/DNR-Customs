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

## How the money actually moves

Worth being explicit, because it surprises people: **Printful never takes your
customer's money.** Printful is the fulfiller. When an order is confirmed, they
charge *you* for the blank, the printing, and the shipping.

So there are two separate flows:

| | From | To | Handled by |
| --- | --- | --- | --- |
| Revenue | Customer | You | Stripe, on this site |
| Cost | You | Printful | Printful bills your card on file |

Your margin is the gap. (Printful's own hosted `*.printful.me` store *does*
collect from customers and pay out — but that is a Printful product, not
something the API offers a custom storefront.)

The order of operations is deliberate:

1. Checkout creates the Printful order as an **unconfirmed draft**. Nothing
   prints, nothing is billed.
2. The customer pays through Stripe Checkout.
3. Stripe calls the webhook; the signature is verified; the draft is
   **confirmed** and goes into production.

A failure anywhere before step 3 leaves an inert draft rather than an unpaid
garment in production.

## Turning on Stripe

1. Set `STRIPE_SECRET_KEY`. Checkout switches from invoicing to Stripe Checkout
   on the next boot — no code change.
2. Add a webhook endpoint in the Stripe dashboard pointing at
   `https://your-domain/api/webhooks/stripe`, subscribed to
   **`checkout.session.completed`**.
3. Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

Test it locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

The webhook verifies Stripe's signature over the raw request body, rejects
replays older than five minutes, and is idempotent — Stripe retries, and
confirming an already-confirmed order is a no-op. Without
`STRIPE_WEBHOOK_SECRET` set, the route refuses every request rather than
confirming orders it cannot authenticate.

`PRINTFUL_AUTO_CONFIRM` is ignored while Stripe is enabled: confirmation is the
webhook's job, and auto-confirming would put unpaid orders into production.

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

## Deploying to Netlify

The simplest option, and free: Netlify's free tier permits commercial use and
needs no card. It detects Next.js automatically and turns the App Router pages
and every route under `src/app/api` — the Stripe webhook included — into
serverless functions. `netlify.toml` only pins the Node version and caching.

1. Sign up at netlify.com with your GitHub account.
2. **Add new site → Import an existing project**, pick this repo, branch `main`.
   Leave the build settings alone; the detected values are right.
3. Before the first deploy finishes, add the environment variables under
   **Site configuration → Environment variables**:

   | Variable | Value |
   | --- | --- |
   | `PRINTFUL_API_KEY` | your Printful token |
   | `PRINTFUL_STORE_ID` | only if the token is account-level |
   | `STRIPE_SECRET_KEY` | `sk_test_…` first, `sk_live_…` when going live |
   | `STRIPE_WEBHOOK_SECRET` | from the Stripe dashboard endpoint, not `stripe listen` |
   | `NEXT_PUBLIC_SITE_URL` | the real site URL, e.g. `https://dnrcustoms.netlify.app` |
   | `CONTACT_EMAIL` | your address |

   Netlify exposes these at build time as well as runtime, which matters:
   the shop prerenders its product pages, so a build without
   `PRINTFUL_API_KEY` silently ships the demo catalog.

4. Trigger a redeploy so the build picks up the variables.
5. In Stripe, add a webhook endpoint at
   `https://your-site/api/webhooks/stripe` for `checkout.session.completed`,
   and put its signing secret into `STRIPE_WEBHOOK_SECRET`.

Free tier limits are 100 GB bandwidth and 300 build minutes a month — far
beyond a new shop. Every push to `main` redeploys.

## Deploying to Firebase

Use **Firebase App Hosting**, not plain Firebase Hosting. Hosting serves static
files only; this app needs a server for its API routes and the Stripe webhook,
and needs somewhere to keep the Printful and Stripe keys that must never reach
a browser. App Hosting builds the repo with Cloud Build and serves it on Cloud
Run, so all of that works.

Requires the **Blaze** (pay-as-you-go) billing plan. Resource limits are capped
in `apphosting.yaml` (`maxInstances: 4`, scale to zero when idle) so a traffic
spike can't run up an unbounded bill.

**1. Create the backend.**

```bash
npm install -g firebase-tools
firebase login
firebase init apphosting     # connect this GitHub repo, pick a region, branch: main
```

**2. Store the secrets.** Values go into Cloud Secret Manager, never into the
repo. The names must match the `secret:` entries in `apphosting.yaml`.

```bash
firebase apphosting:secrets:set printfulApiKey
firebase apphosting:secrets:set printfulStoreId      # skip if store-level token
firebase apphosting:secrets:set stripeSecretKey
firebase apphosting:secrets:set stripeWebhookSecret
```

The CLI offers to grant the backend access to each secret as it is created; say
yes. If you skip it, grant access after the fact:

```bash
firebase apphosting:secrets:grantaccess printfulApiKey --backend <backend-id>
```

**3. Set your real domain.** Edit `NEXT_PUBLIC_SITE_URL` in `apphosting.yaml`
to the origin the site is actually served from. Payment redirects are built
from it, so a wrong value sends paying customers to a 404.

**4. Deploy** by pushing to `main`. App Hosting builds every push to the branch
you connected.

**5. Point Stripe at the deployed URL.** In the Stripe dashboard add a webhook
endpoint at `https://your-domain/api/webhooks/stripe` for
`checkout.session.completed`, then put *that* endpoint's signing secret into
the `stripeWebhookSecret` secret. It differs from the one `stripe listen` gives
you locally.

### Why PRINTFUL_API_KEY is a build-time secret

Note its `availability` in `apphosting.yaml`: `BUILD` **and** `RUNTIME`.

The shop prerenders its product pages through `generateStaticParams`, which
reads the catalog at build time. Without the token during the build, the app
falls back to its demo catalog and bakes four fake products into the live site.
It won't error — it will just quietly ship the wrong shop.

The Stripe secrets are `RUNTIME` only, since nothing renders payment config at
build time and there's no reason to expose payment credentials to the builder.

### Other hosts

Any Node host works — `npm run build && npm start`. Vercel, Railway, Render,
and Cloudflare Workers all run this. Whatever you choose, set the same
environment variables listed in `.env.example`.
