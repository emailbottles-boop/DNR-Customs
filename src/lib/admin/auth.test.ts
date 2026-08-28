import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The admin cookie is the only thing between the internet and a button that
 * spends the owner's money, so its failure modes get spelled out here.
 */

async function boot(password?: string) {
  vi.resetModules();
  if (password !== undefined) vi.stubEnv("ADMIN_PASSWORD", password);
  return import("./auth");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin sessions", () => {
  it("round-trips a token it issued", async () => {
    const auth = await boot("hunter2-but-long");
    expect(auth.verifySessionToken(auth.createSessionToken())).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const auth = await boot("hunter2-but-long");
    const token = auth.createSessionToken();
    const [expiry, sig] = token.split(".");
    expect(auth.verifySessionToken(`${Number(expiry) + 9999999}.${sig}`)).toBe(false);
    expect(auth.verifySessionToken(`${expiry}.${"0".repeat(sig.length)}`)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const auth = await boot("hunter2-but-long");
    const past = Date.now() - 8 * 24 * 60 * 60 * 1000;
    expect(auth.verifySessionToken(auth.createSessionToken(past))).toBe(false);
  });

  it("rejects everything when no password is configured", async () => {
    const auth = await boot();
    expect(auth.adminEnabled()).toBe(false);
    expect(auth.passwordMatches("")).toBe(false);
    expect(auth.passwordMatches("anything")).toBe(false);
    expect(auth.verifySessionToken(auth.createSessionToken())).toBe(false);
  });

  it("a password change invalidates existing sessions", async () => {
    const first = await boot("old-password-here");
    const token = first.createSessionToken();
    const second = await boot("new-password-here");
    expect(second.verifySessionToken(token)).toBe(false);
  });

  it("matches only the exact password", async () => {
    const auth = await boot("correct horse battery");
    expect(auth.passwordMatches("correct horse battery")).toBe(true);
    expect(auth.passwordMatches("correct horse batter")).toBe(false);
    expect(auth.passwordMatches("")).toBe(false);
  });

  it("reads its cookie out of a header with other cookies present", async () => {
    const auth = await boot("hunter2-but-long");
    const token = auth.createSessionToken();
    const header = `other=1; dnr_admin=${encodeURIComponent(token)}; more=2`;
    expect(auth.verifySessionToken(auth.tokenFromCookieHeader(header))).toBe(true);
    expect(auth.tokenFromCookieHeader(null)).toBeUndefined();
    expect(auth.tokenFromCookieHeader("other=1")).toBeUndefined();
  });
});
