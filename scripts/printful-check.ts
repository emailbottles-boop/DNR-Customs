/**
 * Connection and catalog diagnostic: `npm run printful:check`
 *
 * Answers three questions that can only be answered against a real store:
 *   1. Does the token work, and can it see the store?
 *   2. Which products will actually appear in the shop?
 *   3. Does the colour/size parser read this store's variant names correctly?
 *
 * (3) is the one that matters. Printful reports variant options as unlabelled
 * text ("Black / L"), so the storefront has to infer which token is the size.
 * That inference is tested against known shapes, but only a real catalog proves
 * it. Anything this script flags as unparsed is a product whose picker will
 * look wrong — and the fix is a size token added to SIZE_TOKENS in
 * src/lib/printful/catalog.ts.
 *
 * Reads PRINTFUL_API_KEY from .env.local. Makes read-only GET requests; it can
 * neither place nor modify an order.
 */

import { z } from "zod";
import { toProduct } from "../src/lib/printful/catalog";
import { syncProductDetail, syncProductSummary } from "../src/lib/printful/types";
import { format } from "../src/lib/commerce/money";
import type { Product } from "../src/lib/commerce/product";

const envelope = z.object({ code: z.number(), result: z.unknown() });

// Node reads .env.local natively; absence is fine if the vars are already set.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — fall through to the ambient environment.
}

const TOKEN = process.env.PRINTFUL_API_KEY?.trim();
const STORE_ID = process.env.PRINTFUL_STORE_ID?.trim();
const BASE = process.env.PRINTFUL_API_URL?.trim() || "https://api.printful.com";

const bold = (s: string) => `\u001b[1m${s}\u001b[0m`;
const dim = (s: string) => `\u001b[2m${s}\u001b[0m`;
const green = (s: string) => `\u001b[32m${s}\u001b[0m`;
const yellow = (s: string) => `\u001b[33m${s}\u001b[0m`;
const red = (s: string) => `\u001b[31m${s}\u001b[0m`;

async function api<T extends z.ZodTypeAny>(path: string, schema: T): Promise<z.infer<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
  if (STORE_ID) headers["X-PF-Store-Id"] = STORE_ID;

  const response = await fetch(`${BASE}${path}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `${response.status} ${response.statusText} on ${path}${detail ? `\n${dim(detail.slice(0, 400))}` : ""}`,
    );
  }

  const wrapper = envelope.parse(await response.json());
  return schema.parse(wrapper.result);
}

function reportProduct(product: Product): { unparsed: number; total: number } {
  const prices = product.variants.map((variant) => variant.price.amount);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const priceRange =
    low === high
      ? format(product.variants[0].price)
      : `${format({ amount: low, currency: product.variants[0].price.currency })} – ${format({ amount: high, currency: product.variants[0].price.currency })}`;

  const sizes = [...new Set(product.variants.map((v) => v.size).filter(Boolean))];
  const colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))];
  const soldOut = product.variants.filter((v) => !v.available).length;

  // A variant with neither option parsed is the failure case worth surfacing.
  const unparsed = product.variants.filter((v) => !v.size && !v.color);

  console.log(`\n  ${bold(product.name)}  ${dim(`#${product.id}`)}`);
  console.log(`    url        /shop/${product.slug}`);
  console.log(`    price      ${priceRange}`);
  console.log(`    variants   ${product.variants.length}${soldOut ? dim(` (${soldOut} unavailable)`) : ""}`);
  console.log(`    sizes      ${sizes.length ? sizes.join(", ") : dim("none parsed")}`);
  console.log(`    colours    ${colors.length ? colors.join(", ") : dim("none parsed")}`);

  if (unparsed.length > 0) {
    console.log(
      `    ${yellow("⚠ unparsed")} ${unparsed.length} variant(s) — the picker will show raw names:`,
    );
    for (const variant of unparsed.slice(0, 5)) {
      console.log(`               ${dim(variant.name)}`);
    }
  }

  return { unparsed: unparsed.length, total: product.variants.length };
}

async function main() {
  console.log(bold("\nPrintful catalog check\n"));

  if (!TOKEN) {
    console.log(red("No PRINTFUL_API_KEY found."));
    console.log(`
  The storefront is running on its built-in demo catalog. To connect the real
  store:

    1. Printful dashboard → Settings → Developers → Add token
       Grant read access to Products, read/write to Orders.
    2. cp .env.example .env.local
    3. Put the token in .env.local as PRINTFUL_API_KEY
    4. npm run printful:check
`);
    process.exitCode = 1;
    return;
  }

  console.log(dim(`  endpoint  ${BASE}`));
  console.log(dim(`  store id  ${STORE_ID || "(store-level token)"}`));

  let summaries;
  try {
    summaries = await api("/store/products?limit=100", z.array(syncProductSummary));
  } catch (error) {
    console.log(`\n${red("Could not reach Printful.")}`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
    console.log(`
  Common causes:
    401/403  the token is wrong, revoked, or lacks Products read access
    404      an account-level token without PRINTFUL_STORE_ID set
`);
    process.exitCode = 1;
    return;
  }

  const visible = summaries.filter((s) => !s.is_ignored);
  const ignored = summaries.length - visible.length;

  console.log(green(`\n  ✓ connected — ${summaries.length} product(s) in the store`));
  if (ignored > 0) console.log(dim(`    ${ignored} ignored in Printful, skipped`));

  let unparsedTotal = 0;
  let variantTotal = 0;
  let dropped = 0;

  for (const summary of visible) {
    let product: Product | null;
    try {
      const detail = await api(`/store/products/${summary.id}`, syncProductDetail);
      product = toProduct(detail);
    } catch (error) {
      console.log(`\n  ${red("✗")} ${summary.name} ${dim(`#${summary.id}`)}`);
      console.log(`      ${error instanceof Error ? error.message : String(error)}`);
      dropped += 1;
      continue;
    }

    if (!product) {
      // toProduct returns null when no variant has a usable retail price.
      console.log(`\n  ${yellow("⊘")} ${summary.name} ${dim(`#${summary.id}`)}`);
      console.log(
        `      ${yellow("will not appear in the shop")} — no variant has a retail price set.`,
      );
      console.log(dim(`      Set prices on this product in Printful.`));
      dropped += 1;
      continue;
    }

    const stats = reportProduct(product);
    unparsedTotal += stats.unparsed;
    variantTotal += stats.total;
  }

  console.log(bold("\n\nSummary"));
  console.log(`  ${visible.length - dropped} of ${visible.length} product(s) will appear in the shop`);
  console.log(`  ${variantTotal} variant(s) mapped`);

  if (dropped > 0) {
    console.log(yellow(`  ${dropped} product(s) hidden — see the notes above`));
  }

  if (unparsedTotal > 0) {
    console.log(
      yellow(`  ${unparsedTotal} variant(s) had unrecognised option names`),
    );
    console.log(
      dim(
        "  Add the missing size tokens to SIZE_TOKENS in src/lib/printful/catalog.ts",
      ),
    );
  } else if (variantTotal > 0) {
    console.log(green("  ✓ every variant's colour/size parsed cleanly"));
  }

  console.log();
}

main().catch((error) => {
  console.error(red("\nUnexpected failure:"), error);
  process.exitCode = 1;
});
