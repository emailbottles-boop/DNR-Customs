import { NextResponse } from "next/server";
import { adminEnabled, isAdminRequest } from "@/lib/admin/auth";
import { redactUpstream, repairWebhook } from "@/lib/admin/health";

/** Points Stripe's endpoint at this shop with every event it needs. */
export async function POST(request: Request) {
  if (!adminEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    return NextResponse.json(await repairWebhook(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: redactUpstream(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
