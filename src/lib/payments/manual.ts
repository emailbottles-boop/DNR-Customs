import "server-only";
import { config } from "@/lib/config";
import { format } from "@/lib/commerce/money";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "./types";

/**
 * The default provider: no card is taken online.
 *
 * The order lands in Printful as an unconfirmed draft and the customer is told
 * an invoice follows. Nothing prints and nothing ships until someone confirms
 * the order in Printful, which makes this safe to run in production while
 * payments are still being set up.
 */
export const manualProvider: PaymentProvider = {
  id: "manual",
  label: "Invoice on confirmation",

  customerNotice:
    "No card is charged now. We'll email an invoice to confirm your order before anything goes into production.",

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Nothing to call out to — the order record itself is the artifact.
    console.info(
      `[payments:manual] recorded ${request.reference} for ${request.email} — ${format(request.total)}`,
    );

    return {
      kind: "recorded",
      reference: request.reference,
      instructions: `We've received your order and emailed a confirmation to ${request.email}. An invoice will follow from ${config.brand.email}; your pieces go into production once it's settled.`,
    };
  },
};
