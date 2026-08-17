import { NextResponse } from "next/server";
import { CheckoutError, placeOrder } from "@/lib/checkout/service";
import { placeOrderSchema } from "@/lib/checkout/schema";
import type { ApiError, PlaceOrderResponse } from "@/lib/checkout/schema";
import { PaymentError } from "@/lib/payments";
import { fieldErrors, jsonBody } from "../_lib/request";

export async function POST(request: Request) {
  const body = await jsonBody(request);
  if (body === null) {
    return NextResponse.json<ApiError>(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiError>(
      { error: "Please check your details.", fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await placeOrder(parsed.data);

    return NextResponse.json<PlaceOrderResponse>({
      reference: result.reference,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
      totals: result.totals,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json<ApiError>(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof PaymentError) {
      // The Printful draft exists but payment couldn't start. The draft is
      // unconfirmed, so nothing ships — it's safe to ask them to retry.
      console.error("[api/orders] payment failed:", error);
      return NextResponse.json<ApiError>(
        { error: "We couldn't start the payment. No card was charged — please try again." },
        { status: 502 },
      );
    }

    console.error("[api/orders] order failed:", error);
    return NextResponse.json<ApiError>(
      { error: "We couldn't place that order. Please try again in a moment." },
      { status: 502 },
    );
  }
}
