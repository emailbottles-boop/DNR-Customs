import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminEnabled,
  createSessionToken,
  passwordMatches,
} from "@/lib/admin/auth";

export async function POST(request: Request) {
  // No password configured: the admin surface does not exist.
  if (!adminEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    // Falls through to the mismatch below.
  }

  if (!password || !passwordMatches(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
