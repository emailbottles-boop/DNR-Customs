import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";

/**
 * Session auth for the admin surface: one password, one signed cookie.
 *
 * No accounts and no database — the store has a single owner. The cookie is
 * `expiry.signature`, signed with a key derived from the admin password, so
 * rotating the password invalidates every outstanding session at once.
 */

export const ADMIN_COOKIE = "dnr_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function adminEnabled(): boolean {
  return Boolean(config.adminPassword);
}

/** Signing key derived from the password; never the password itself. */
function signingKey(): Buffer {
  return createHash("sha256")
    .update(`dnr-admin-session:${config.adminPassword ?? ""}`)
    .digest();
}

function signature(expiry: number): string {
  return createHmac("sha256", signingKey())
    .update(`admin.${expiry}`)
    .digest("hex");
}

/** Constant-time comparison over digests, so length never leaks. */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function passwordMatches(candidate: string): boolean {
  if (!config.adminPassword) return false;
  return safeEqual(candidate, config.adminPassword);
}

export function createSessionToken(now = Date.now()): string {
  const expiry = now + SESSION_TTL_MS;
  return `${expiry}.${signature(expiry)}`;
}

export function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!adminEnabled() || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiry = Number(token.slice(0, dot));
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  return safeEqual(token.slice(dot + 1), signature(expiry));
}

/** Reads the session token out of a raw Cookie header. */
export function tokenFromCookieHeader(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** True when the request carries a valid admin session. */
export function isAdminRequest(request: Request): boolean {
  return verifySessionToken(tokenFromCookieHeader(request.headers.get("cookie")));
}
