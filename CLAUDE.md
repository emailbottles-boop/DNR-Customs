@AGENTS.md

# Working on D&R Customs

This repo is a live store. Real cards are charged through Stripe and real
garments are printed and billed by Printful. Read this before changing anything.

## Layout
- `src/lib/commerce/` money, products, cart (pure, unit tested).
- `src/lib/printful/` the Printful adapter. `src/lib/payments/` Stripe and the
  manual provider. `src/lib/checkout/` places the order. `src/lib/admin/` the
  owner's back office, including the checks (`health.ts`).
- `src/app/api/webhooks/stripe/route.ts` is the money path's other half: it
  turns a verified Stripe event into a confirmed Printful order.
- Hosting: Netlify (`netlify.toml`) or Firebase App Hosting (`apphosting.yaml`).
  Both deploy from `main` on push. Secrets live in the host's environment
  variables, never in the repo.

## Rules for any Claude Code session in this repo
1. **Never deploy, never touch secrets, never push to `main`.**
   `.claude/settings.json` denies deploy commands, host environment commands,
   pushes to `main`, force pushes and `gh pr merge`. Do not work around it.
   The host deploys from `main`; the owner merges.
2. Work on a branch, open a pull request, and let CI (`.github/workflows/ci.yml`)
   pass: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
3. One concern per PR. A UI tidy and a money-path change never travel together.
4. Anything touching prices, totals, currencies, shipping, Stripe sessions,
   the webhook, payouts or confirmation needs a test that fails on the old
   code before the change is proposed.
5. Keep what already works. Removing a button, a route, a field or a setting
   is a change to the site's contract: search for every use first.
6. Do not report done until every CI check passes on the exact commit proposed.
7. Never print a secret's value: not from env, not from a Stripe or Printful
   error. The admin's Check keys shows shape only.

## Money-path invariants (must hold after every change)
- The client never sends prices; the server re-prices from the catalog.
- A Printful order is created as an unconfirmed draft and confirmed only by a
  verified Stripe event (or the owner, from /admin, after a fresh Stripe check).
  With `CONFIRM_ON_PAYOUT` the draft waits for `payout.paid`. Refunded and
  disputed charges are never confirmed. Test keys never confirm.
- Integer minor units everywhere.

## Rollback
- `git revert <sha>` on `main`; the host redeploys in a few minutes.
