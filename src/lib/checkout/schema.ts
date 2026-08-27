import { z } from "zod";
import { MAX_UNITS_PER_ORDER } from "@/lib/commerce/cart";

/**
 * Request shapes for the checkout API, shared by the route handlers and the
 * client form so the two can't drift.
 *
 * Note what is *absent*: prices. The client sends variant ids and quantities
 * only, and the server re-prices from the catalog. A tampered request can
 * change what you order, never what it costs.
 */

export const recipientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address").max(200),
  address1: z.string().trim().min(1, "Address is required").max(200),
  address2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(120),
  // Required by Printful for US/CA/AU addresses, meaningless for many others.
  state_code: z.string().trim().max(20).optional().or(z.literal("")),
  country_code: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code")
    .transform((value) => value.toUpperCase()),
  zip: z.string().trim().min(1, "Postal code is required").max(20),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const orderItemSchema = z.object({
  variantId: z.number().int(),
  quantity: z.number().int().min(1).max(MAX_UNITS_PER_ORDER),
});

export const shippingQuoteSchema = z.object({
  recipient: recipientSchema,
  items: z
    .array(orderItemSchema)
    .min(1, "Your cart is empty")
    // The cap is per order, so it has to hold across lines, not just within
    // one. The cart UI enforces the same rule; this is the copy that matters,
    // because only this one binds a hand-crafted request.
    .refine(
      (items) =>
        items.reduce((total, item) => total + item.quantity, 0) <=
        MAX_UNITS_PER_ORDER,
      { message: `Orders are limited to ${MAX_UNITS_PER_ORDER} items` },
    ),
});

export const placeOrderSchema = shippingQuoteSchema.extend({
  shippingOptionId: z.string().trim().min(1).max(64).optional(),
});

export type RecipientInput = z.infer<typeof recipientSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

/** Serialisable money, for crossing the API boundary as JSON. */
export type MoneyJson = { amount: number; currency: string; formatted: string };

export type ShippingOptionJson = {
  id: string;
  name: string;
  rate: MoneyJson;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
};

export type ShippingQuoteResponse = {
  options: ShippingOptionJson[];
};

export type PlaceOrderResponse = {
  reference: string;
  /** Present when the provider needs the customer sent elsewhere to pay. */
  redirectUrl: string | null;
  instructions: string | null;
  totals: { subtotal: MoneyJson; shipping: MoneyJson; total: MoneyJson };
};

export type ApiError = {
  error: string;
  /** Field-level messages, keyed by form field name. */
  fields?: Record<string, string>;
};
