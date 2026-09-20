import { NextResponse } from "next/server";
import { adminEnabled, isAdminRequest } from "@/lib/admin/auth";
import { redactUpstream, shopHealth } from "@/lib/admin/health";

/** The owner's checks: key shapes, whether each upstream accepts its key, and
 *  the Stripe endpoint. Never a secret's value. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!adminEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  try {
    return NextResponse.json(await shopHealth(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: redactUpstream(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
