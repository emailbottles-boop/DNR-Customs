import type { Money } from "@/lib/commerce/money";

/**
 * The seam between checkout and however money is actually collected.
 *
 * Checkout depends only on this interface, so turning Stripe on is a config
 * change plus one adapter — not a rewrite of the order flow.
 */

export type PaymentLine = {
  name: string;
  description?: string;
  unitPrice: Money;
  quantity: number;
};

export type PaymentRequest = {
  /** Our order reference, carried through to the provider for reconciliation. */
  reference: string;
  email: string;
  lines: PaymentLine[];
  shipping: Money;
  total: Money;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Either the customer must be sent somewhere to pay, or the order is recorded
 * and settled out of band. Checkout handles both without knowing the provider.
 */
export type PaymentResult =
  | { kind: "redirect"; url: string; reference: string }
  | { kind: "recorded"; reference: string; instructions: string };

export interface PaymentProvider {
  readonly id: "manual" | "stripe";
  readonly label: string;
  /** Shown on the checkout page so the customer knows what happens next. */
  readonly customerNotice: string;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
