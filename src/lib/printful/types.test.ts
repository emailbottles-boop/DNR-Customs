import { describe, expect, it } from "vitest";
import { order, shippingRate, syncVariant } from "./types";
import { parseDecimal } from "@/lib/commerce/money";

/**
 * Printful is inconsistent about whether a decimal arrives as a string or a
 * JSON number. Being strict about it broke order creation *after* Printful had
 * already accepted the order — a 200 response parsed as a failure, which is the
 * worst possible place to be picky, because the write had already happened and
 * the customer was told it failed.
 *
 * These pin the shapes a real store actually returns.
 */

describe("order response", () => {
  it("accepts numeric costs, which is what a live store returns", () => {
    // Reproduces the exact failure: Printful replied 200 with numbers here.
    const parsed = order.safeParse({
      id: 123456,
      external_id: "DNR-ABC-123",
      status: "draft",
      shipping: "STANDARD",
      created: 1770000000,
      costs: { currency: "USD", subtotal: 25, shipping: 4.99, total: 29.99 },
      retail_costs: { currency: "USD", subtotal: 35, total: 39.99 },
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts string costs", () => {
    const parsed = order.safeParse({
      id: 1,
      status: "draft",
      costs: { subtotal: "25.00", total: "29.99" },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an order with no costs at all", () => {
    expect(order.safeParse({ id: 1, status: "draft" }).success).toBe(true);
  });

  it("ignores unfamiliar fields rather than rejecting the order", () => {
    // Printful adds keys over time; a new one must never fail a real order.
    const parsed = order.safeParse({
      id: 1,
      status: "pending",
      some_field_printful_added_later: { nested: true },
    });
    expect(parsed.success).toBe(true);
  });

  it("still requires the fields we actually use", () => {
    // id and status are read by the confirm flow, so they must be present.
    expect(order.safeParse({ status: "draft" }).success).toBe(false);
    expect(order.safeParse({ id: 1 }).success).toBe(false);
  });
});

describe("decimal fields elsewhere", () => {
  it("accepts a retail price as either a string or a number", () => {
    for (const price of ["29.50", 29.5]) {
      const parsed = syncVariant.safeParse({
        id: 1,
        name: "Tee - Black / L",
        retail_price: price,
      });
      expect(parsed.success, `retail_price ${typeof price}`).toBe(true);
    }
  });

  it("accepts a shipping rate as either a string or a number", () => {
    for (const rate of ["4.99", 4.99]) {
      const parsed = shippingRate.safeParse({
        id: "STANDARD",
        name: "Standard",
        rate,
        currency: "USD",
      });
      expect(parsed.success, `rate ${typeof rate}`).toBe(true);
    }
  });

  it("parses both forms to the same amount", () => {
    // The whole point of accepting both: they must mean the same money.
    expect(parseDecimal("4.99")?.amount).toBe(499);
    expect(parseDecimal(4.99)?.amount).toBe(499);
    expect(parseDecimal(25)?.amount).toBe(2500);
    expect(parseDecimal(29.5)?.amount).toBe(2950);
  });
});
