import { NextResponse } from "next/server";
import { adminEnabled, isAdminRequest } from "@/lib/admin/auth";
import { redactUpstream, settlePayouts } from "@/lib/admin/health";

/** Confirms every draft whose money Stripe has already paid out: the safety
 *  net for a payout.paid message that never arrived. */
export async function POST(request: Request) {
  if (!adminEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    return NextResponse.json(await settlePayouts(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: redactUpstream(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
