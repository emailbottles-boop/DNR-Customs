import { NextResponse } from "next/server";
import { CheckoutError, quoteShipping, toMoneyJson } from "@/lib/checkout/service";
import { shippingQuoteSchema } from "@/lib/checkout/schema";
import type { ApiError, ShippingQuoteResponse } from "@/lib/checkout/schema";
import { fieldErrors, jsonBody } from "../_lib/request";

/** Quotes live shipping rates for an address. Never cached — rates vary. */
export async function POST(request: Request) {
  const body = await jsonBody(request);
  if (body === null) {
    return NextResponse.json<ApiError>(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = shippingQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiError>(
      { error: "Please check the delivery address.", fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const options = await quoteShipping(parsed.data.recipient, parsed.data.items);

    return NextResponse.json<ShippingQuoteResponse>({
      options: options.map((option) => ({
        id: option.id,
        name: option.name,
        rate: toMoneyJson(option.rate),
        minDeliveryDays: option.minDeliveryDays,
        maxDeliveryDays: option.maxDeliveryDays,
      })),
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json<ApiError>(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("[api/shipping] quote failed:", error);
    return NextResponse.json<ApiError>(
      {
        error:
          "We couldn't get shipping rates for that address. Check the country and postal code, then try again.",
      },
      { status: 502 },
    );
  }
}
