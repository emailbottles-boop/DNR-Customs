import { z } from "zod";

/**
 * Schemas for the Printful v1 REST API (https://developers.printful.com/docs/).
 *
 * These describe the *wire* format only. Everything is mapped into the domain
 * types in `src/lib/commerce` before it reaches a component, and every schema
 * here is deliberately loose about fields we don't consume — Printful adds keys
 * over time, and an unrecognised key should never break the shop.
 */

/**
 * Every v1 response is wrapped in `{ code, result }`. The envelope is validated
 * on its own and `result` is checked separately against the caller's schema —
 * a generic wrapper schema infers poorly and buries the real type error.
 */
export const envelope = z.object({
  code: z.number(),
  result: z.unknown(),
  paging: z
    .object({
      total: z.number(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    })
    .optional(),
});

/**
 * A decimal money value from Printful, which is inconsistent about the type.
 *
 * Retail prices on products come back as strings ("29.50"); costs on an order
 * come back as JSON numbers (29.5). Both are accepted here and normalised by
 * `parseDecimal`, which takes either. Insisting on one shape made order
 * creation fail *after* Printful had already accepted the order — the worst
 * place to be strict, since the write had succeeded and only the reply was
 * rejected.
 */
export const decimalValue = z.union([z.string(), z.number()]);

/** Error responses use the same envelope with a string/object result. */
export const errorEnvelope = z.object({
  code: z.number(),
  result: z.unknown(),
  error: z
    .object({ reason: z.string().optional(), message: z.string().optional() })
    .optional(),
});

/**
 * A store on the account. Account-level tokens can see several, and every
 * catalog call then has to say which one via the X-PF-Store-Id header.
 */
export const store = z.object({
  id: z.number(),
  name: z.string().nullish(),
  type: z.string().nullish(),
  website: z.string().nullish(),
});

export const syncProductSummary = z.object({
  id: z.number(),
  external_id: z.string().nullish(),
  name: z.string(),
  variants: z.number().optional(),
  synced: z.number().optional(),
  thumbnail_url: z.string().nullish(),
  is_ignored: z.boolean().optional(),
});

export const syncVariant = z.object({
  id: z.number(),
  external_id: z.string().nullish(),
  sync_product_id: z.number().optional(),
  name: z.string(),
  synced: z.boolean().optional(),
  variant_id: z.number().optional(),
  /** Decimal, e.g. "29.50" or 29.5. Parsed via `parseDecimal`. */
  retail_price: decimalValue.nullish(),
  currency: z.string().nullish(),
  availability_status: z.string().nullish(),
  files: z
    .array(
      z.object({
        id: z.number().optional(),
        type: z.string().nullish(),
        preview_url: z.string().nullish(),
        thumbnail_url: z.string().nullish(),
      }),
    )
    .optional(),
  options: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .optional(),
  product: z
    .object({
      variant_id: z.number().optional(),
      product_id: z.number().optional(),
      image: z.string().nullish(),
      name: z.string().nullish(),
    })
    .nullish(),
});

export const syncProductDetail = z.object({
  sync_product: syncProductSummary.extend({
    description: z.string().nullish(),
  }),
  sync_variants: z.array(syncVariant),
});

export const shippingRate = z.object({
  id: z.string(),
  name: z.string(),
  rate: decimalValue,
  currency: z.string(),
  minDeliveryDays: z.number().nullish(),
  maxDeliveryDays: z.number().nullish(),
});

/**
 * Order cost breakdown. Deliberately unvalidated: nothing in the storefront
 * reads it, and every field we describe here is another way for a *successful*
 * order to be reported as a failure. Validate what you consume.
 */
export const orderCosts = z.unknown();

export const order = z.object({
  id: z.number(),
  external_id: z.string().nullish(),
  status: z.string(),
  shipping: z.string().nullish(),
  created: z.number().nullish(),
  costs: orderCosts.nullish(),
  retail_costs: orderCosts.nullish(),
  /** Read only to count units sold against the drop cap. */
  items: z.array(z.object({ quantity: z.number() })).optional(),
  // Anything else Printful sends is ignored rather than rejected.
});

export type SyncProductSummary = z.infer<typeof syncProductSummary>;
export type SyncProductDetail = z.infer<typeof syncProductDetail>;
export type SyncVariant = z.infer<typeof syncVariant>;
export type ShippingRate = z.infer<typeof shippingRate>;
export type PrintfulOrder = z.infer<typeof order>;

/** Address shape accepted by both /shipping/rates and /orders. */
export type Recipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip: string;
  email?: string;
  phone?: string;
};
