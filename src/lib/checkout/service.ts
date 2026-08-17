import "server-only";
import { add, format, multiply, zero } from "@/lib/commerce/money";
import type { Money } from "@/lib/commerce/money";
import { createOrder, getShippingOptions, priceItems } from "@/lib/printful/store";
import type { ShippingOption } from "@/lib/printful/store";
import { paymentProvider } from "@/lib/payments";
import type { MoneyJson } from "./schema";
import type { PlaceOrderInput, RecipientInput } from "./schema";
import { config } from "@/lib/config";

/**
 * Checkout orchestration: price the cart, quote shipping, create the order,
 * hand off to the payment provider. Route handlers stay thin over this.
 */

export function toMoneyJson(value: Money): MoneyJson {
  return {
    amount: value.amount,
    currency: value.currency,
    formatted: format(value),
  };
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

function toRecipient(input: RecipientInput) {
  return {
    name: input.name,
    address1: input.address1,
    address2: input.address2 || undefined,
    city: input.city,
    state_code: input.state_code || undefined,
    country_code: input.country_code,
    zip: input.zip,
    email: input.email,
    phone: input.phone || undefined,
  };
}

export async function quoteShipping(
  recipient: RecipientInput,
  items: Array<{ variantId: number; quantity: number }>,
): Promise<ShippingOption[]> {
  const { missing } = await priceItems(items);
  if (missing.length > 0) {
    throw new CheckoutError(
      "Some items in your cart are no longer available. Please review your cart.",
      409,
    );
  }
  return getShippingOptions(toRecipient(recipient), items);
}

/**
 * Places the order.
 *
 * Order of operations matters: the cart is re-priced first (so we know what to
 * charge), the Printful order is created as a draft, and only then is payment
 * started. A payment failure therefore leaves an unconfirmed draft — which is
 * inert and costs nothing — rather than a charge with no order behind it.
 */
export async function placeOrder(input: PlaceOrderInput) {
  const { lines, missing } = await priceItems(input.items);

  if (missing.length > 0) {
    throw new CheckoutError(
      "Some items in your cart are no longer available. Please review your cart.",
      409,
    );
  }
  if (lines.length === 0) throw new CheckoutError("Your cart is empty.");

  const subtotal = add(
    ...lines.map((line) => multiply(line.unitPrice, line.quantity)),
  );

  const shippingOptions = await getShippingOptions(
    toRecipient(input.recipient),
    input.items,
  );

  // Fall back to the cheapest option if the client sent one we don't recognise,
  // rather than failing the order over a stale shipping id.
  const chosen =
    shippingOptions.find((option) => option.id === input.shippingOptionId) ??
    cheapest(shippingOptions);

  const shipping = chosen?.rate ?? zero(subtotal.currency);
  const total = add(subtotal, shipping);
  const reference = orderReference();

  const order = await createOrder({
    recipient: toRecipient(input.recipient),
    items: input.items,
    shippingOptionId: chosen?.id,
    externalId: reference,
  });

  const provider = paymentProvider();
  const payment = await provider.createPayment({
    reference,
    email: input.recipient.email,
    lines: lines.map((line) => ({
      name: line.productName,
      description: line.variantName,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    })),
    shipping,
    total,
    successUrl: `${config.siteUrl}/checkout/confirmed`,
    cancelUrl: `${config.siteUrl}/cart`,
  });

  return {
    reference,
    printfulOrderId: order.id,
    redirectUrl: payment.kind === "redirect" ? payment.url : null,
    instructions: payment.kind === "recorded" ? payment.instructions : null,
    totals: {
      subtotal: toMoneyJson(subtotal),
      shipping: toMoneyJson(shipping),
      total: toMoneyJson(total),
    },
  };
}

function cheapest(options: ShippingOption[]): ShippingOption | undefined {
  if (options.length === 0) return undefined;
  return options.reduce((low, next) =>
    next.rate.amount < low.rate.amount ? next : low,
  );
}

/**
 * Human-legible, sortable, and unique enough for a storefront of this size.
 * Printful stores it as `external_id`, so it's the key for reconciliation.
 */
function orderReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DNR-${stamp}-${random}`;
}
