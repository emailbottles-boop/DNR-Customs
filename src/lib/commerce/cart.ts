import { add, isCurrency, money, multiply, zero } from "./money";
import type { Currency, Money } from "./money";
import type { Product, ProductVariant } from "./product";

/**
 * Cart state and every operation on it, as pure functions over a plain object.
 *
 * The cart is persisted to localStorage and re-read on load, which means the
 * shape here is also an on-disk format: anything stored must survive a JSON
 * round trip, and anything read back must be re-validated (see `parseCart`)
 * because a stale or hand-edited entry is entirely possible.
 */

/**
 * The whole order is capped, not just each line. This is a one-drop shop
 * printed to order: a single buyer clearing out a drop would drain the float
 * (Printful bills immediately, Stripe pays out days later), so nobody gets
 * more than two garments in one order. Enforced again server-side in the
 * checkout schema — this constant is the UI's copy of that rule.
 */
export const MAX_UNITS_PER_ORDER = 2;

export type CartLine = {
  variantId: number;
  productId: number;
  slug: string;
  productName: string;
  variantName: string;
  /** Unit price snapshot. Re-priced server-side at checkout; never trusted. */
  unitPrice: Money;
  image: string | null;
  quantity: number;
};

export type Cart = {
  lines: CartLine[];
  currency: Currency;
};

export function emptyCart(currency: Currency = "USD"): Cart {
  return { lines: [], currency };
}

export function isEmpty(cart: Cart): boolean {
  return cart.lines.length === 0;
}

export function itemCount(cart: Cart): number {
  return cart.lines.reduce((total, line) => total + line.quantity, 0);
}

export function subtotal(cart: Cart): Money {
  if (cart.lines.length === 0) return zero(cart.currency);
  return add(
    ...cart.lines.map((line) => multiply(line.unitPrice, line.quantity)),
  );
}

/** Units across every line except the one being changed. */
function unitsInOtherLines(cart: Cart, variantId: number): number {
  return cart.lines.reduce(
    (total, line) =>
      line.variantId === variantId ? total : total + line.quantity,
    0,
  );
}

function clampQuantity(quantity: number, allowance: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(allowance, Math.max(1, Math.floor(quantity)));
}

/**
 * Adds a variant, merging into an existing line when the variant is already
 * present. Adding past the per-line cap clamps rather than erroring — the UI
 * surfaces the cap, and a silent clamp beats a checkout that rejects later.
 */
export function addLine(
  cart: Cart,
  product: Product,
  variant: ProductVariant,
  quantity = 1,
): Cart {
  // What this line may hold is whatever the rest of the cart hasn't used.
  const allowance = MAX_UNITS_PER_ORDER - unitsInOtherLines(cart, variant.id);
  if (allowance <= 0) return cart;

  const existing = cart.lines.find((line) => line.variantId === variant.id);
  const requested = clampQuantity(quantity, allowance);

  if (existing) {
    return {
      ...cart,
      lines: cart.lines.map((line) =>
        line.variantId === variant.id
          ? { ...line, quantity: clampQuantity(line.quantity + requested, allowance) }
          : line,
      ),
    };
  }

  const line: CartLine = {
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    productName: product.name,
    variantName: variant.name,
    unitPrice: variant.price,
    image: variant.image ?? product.thumbnail,
    quantity: requested,
  };

  return {
    // The first line establishes the cart currency; mixed-currency carts are
    // not representable, which is deliberate.
    currency: cart.lines.length === 0 ? variant.price.currency : cart.currency,
    lines: [...cart.lines, line],
  };
}

export function removeLine(cart: Cart, variantId: number): Cart {
  return {
    ...cart,
    lines: cart.lines.filter((line) => line.variantId !== variantId),
  };
}

/** Setting a quantity of 0 or less removes the line. */
export function setQuantity(
  cart: Cart,
  variantId: number,
  quantity: number,
): Cart {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return removeLine(cart, variantId);
  }
  const allowance = MAX_UNITS_PER_ORDER - unitsInOtherLines(cart, variantId);
  if (allowance <= 0) return removeLine(cart, variantId);
  return {
    ...cart,
    lines: cart.lines.map((line) =>
      line.variantId === variantId
        ? { ...line, quantity: clampQuantity(quantity, allowance) }
        : line,
    ),
  };
}

export function clear(cart: Cart): Cart {
  return emptyCart(cart.currency);
}

/** The minimal payload the order API needs; prices are recomputed server-side. */
export function toOrderItems(
  cart: Cart,
): Array<{ variantId: number; quantity: number }> {
  return cart.lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
  }));
}

/**
 * Rebuilds a Cart from untrusted JSON (localStorage, a request body). Bad lines
 * are dropped individually so one corrupt entry doesn't empty a real cart.
 */
export function parseCart(input: unknown): Cart {
  if (typeof input !== "object" || input === null) return emptyCart();

  const record = input as Record<string, unknown>;
  const currency =
    typeof record.currency === "string" && isCurrency(record.currency)
      ? record.currency
      : "USD";

  if (!Array.isArray(record.lines)) return emptyCart(currency);

  const lines: CartLine[] = [];
  let budget = MAX_UNITS_PER_ORDER;
  for (const candidate of record.lines) {
    const line = parseLine(candidate, currency);
    // Reject lines in a different currency than the cart; they can't be summed.
    if (!line || line.unitPrice.currency !== currency) continue;
    // A stored cart predating the order cap must not resurrect more units
    // than an order may hold now.
    if (budget <= 0) break;
    const quantity = Math.min(line.quantity, budget);
    budget -= quantity;
    lines.push({ ...line, quantity });
  }

  return { currency, lines };
}

function parseLine(input: unknown, currency: Currency): CartLine | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;

  const variantId = Number(record.variantId);
  const productId = Number(record.productId);
  const quantity = Number(record.quantity);
  if (!Number.isInteger(variantId) || variantId <= 0) return null;
  if (!Number.isInteger(productId) || productId <= 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const price = record.unitPrice as Record<string, unknown> | undefined;
  const amount = Number(price?.amount);
  if (!Number.isInteger(amount) || amount < 0) return null;

  const priceCurrency =
    typeof price?.currency === "string" && isCurrency(price.currency)
      ? price.currency
      : currency;

  return {
    variantId,
    productId,
    slug: typeof record.slug === "string" ? record.slug : "",
    productName:
      typeof record.productName === "string" ? record.productName : "Item",
    variantName: typeof record.variantName === "string" ? record.variantName : "",
    unitPrice: money(amount, priceCurrency),
    image: typeof record.image === "string" ? record.image : null,
    quantity: clampQuantity(quantity, MAX_UNITS_PER_ORDER),
  };
}
