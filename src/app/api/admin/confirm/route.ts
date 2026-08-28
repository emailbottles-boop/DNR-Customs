import { NextResponse } from "next/server";
import { adminEnabled, isAdminRequest } from "@/lib/admin/auth";
import { referenceIsPaid } from "@/lib/admin/orders";
import { config } from "@/lib/config";
import { confirmOrderByReference } from "@/lib/printful/store";

/**
 * Confirms one pre-order draft for production, from the admin UI.
 *
 * This is the admin's money-moving endpoint, so it re-checks everything
 * rather than trusting the page that rendered the button: the session, that
 * Stripe actually recorded payment for the reference, and that the keys are
 * not test keys. The same rules the webhook lives by.
 */
export async function POST(request: Request) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let reference = "";
  try {
    const body = (await request.json()) as { reference?: unknown };
    if (typeof body.reference === "string") reference = body.reference.trim();
  } catch {
    // Handled below.
  }
  if (!reference || reference.length > 64) {
    return NextResponse.json({ error: "Missing order reference." }, { status: 400 });
  }

  if (config.payments.stripeTestMode) {
    return NextResponse.json(
      { error: "Stripe is on test keys; confirming would print a garment nobody paid for." },
      { status: 409 },
    );
  }

  // The payment check is server-side and fresh — a stale admin page cannot
  // confirm an order whose payment never actually happened.
  if (!(await referenceIsPaid(reference))) {
    return NextResponse.json(
      { error: `No paid Stripe payment found for ${reference}. Not confirming.` },
      { status: 409 },
    );
  }

  const outcome = await confirmOrderByReference(reference);
  switch (outcome.status) {
    case "confirmed":
      return NextResponse.json({ ok: true, orderId: outcome.orderId });
    case "already-confirmed":
      return NextResponse.json({
        ok: true,
        orderId: outcome.orderId,
        note: `Already ${outcome.printfulStatus}.`,
      });
    case "not-found":
      return NextResponse.json(
        { error: `No Printful order found for ${reference}.` },
        { status: 404 },
      );
  }
}
