import { describe, expect, it } from "vitest";
import {
  add,
  format,
  isCurrency,
  money,
  multiply,
  parseDecimal,
  subtract,
  toDecimalString,
  zero,
} from "./money";

describe("money", () => {
  it("rejects non-integer minor units", () => {
    expect(() => money(29.5)).toThrow(TypeError);
  });

  it("refuses to combine mismatched currencies", () => {
    expect(() => add(money(100, "USD"), money(100, "EUR"))).toThrow(TypeError);
    expect(() => subtract(money(100, "USD"), money(100, "GBP"))).toThrow(
      TypeError,
    );
  });

  it("recognises supported currencies", () => {
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("XYZ")).toBe(false);
  });
});

describe("parseDecimal", () => {
  it("parses Printful-style decimal strings", () => {
    expect(parseDecimal("29.50")).toEqual({ amount: 2950, currency: "USD" });
    expect(parseDecimal("0.99")).toEqual({ amount: 99, currency: "USD" });
    expect(parseDecimal("100")).toEqual({ amount: 10000, currency: "USD" });
    expect(parseDecimal("1,299.00")).toEqual({
      amount: 129900,
      currency: "USD",
    });
  });

  it("handles a single decimal place", () => {
    expect(parseDecimal("29.5")).toEqual({ amount: 2950, currency: "USD" });
  });

  it("rounds beyond two decimal places", () => {
    expect(parseDecimal("29.505")?.amount).toBe(2951);
    expect(parseDecimal("29.504")?.amount).toBe(2950);
  });

  it("parses negatives", () => {
    expect(parseDecimal("-5.25")).toEqual({ amount: -525, currency: "USD" });
  });

  it("returns null for junk rather than throwing", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("$29.50")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });

  it("carries the requested currency", () => {
    expect(parseDecimal("10.00", "GBP")).toEqual({
      amount: 1000,
      currency: "GBP",
    });
  });
});

describe("arithmetic", () => {
  it("adds without float drift", () => {
    // The float-math version of this sums to 89.99999999999999.
    const total = add(
      parseDecimal("29.99")!,
      parseDecimal("29.99")!,
      parseDecimal("30.01")!,
    );
    expect(total.amount).toBe(8999);
    expect(format(total)).toBe("$89.99");
  });

  it("multiplies by quantity", () => {
    expect(multiply(money(2950), 3).amount).toBe(8850);
  });

  it("sums to zero for an empty list", () => {
    expect(add()).toEqual(zero());
  });
});

describe("formatting", () => {
  it("formats for display", () => {
    expect(format(money(2950))).toBe("$29.50");
    expect(format(money(0))).toBe("$0.00");
    expect(format(money(129900))).toBe("$1,299.00");
  });

  it("round-trips through the Printful decimal format", () => {
    expect(toDecimalString(money(2950))).toBe("29.50");
    expect(toDecimalString(money(5))).toBe("0.05");
    expect(toDecimalString(money(10000))).toBe("100.00");
    expect(parseDecimal(toDecimalString(money(12345)))?.amount).toBe(12345);
  });
});
