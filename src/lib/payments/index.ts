import "server-only";
import { config } from "@/lib/config";
import { manualProvider } from "./manual";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/**
 * Resolves the active provider from configuration. Stripe takes over the moment
 * STRIPE_SECRET_KEY exists; until then everything runs through `manual`.
 */
export function paymentProvider(): PaymentProvider {
  return config.payments.provider === "stripe" ? stripeProvider : manualProvider;
}

export { PaymentError } from "./types";
export type {
  PaymentLine,
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from "./types";
