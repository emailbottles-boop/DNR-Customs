import { describe, expect, it } from "vitest";
import {
  MAX_UNITS_PER_ORDER,
  addLine,
  clear,
  emptyCart,
  isEmpty,
  itemCount,
  parseCart,
  removeLine,
  setQuantity,
  subtotal,
  toOrderItems,
} from "./cart";
import { money } from "./money";
import type { Product, ProductVariant } from "./product";

function variant(id: number, price: number, name = `Variant ${id}`): ProductVariant {
  return {
    id,
    catalogVariantId: null,
    name,
    size: null,
    color: null,
    price: money(price),
    image: null,
    available: true,
  };
}

const tee: Product = {
  id: 1,
  slug: "dnr-tee",
  name: "DNR Tee",
  description: null,
  thumbnail: "https://example.test/tee.png",
  images: [],
  variants: [variant(11, 2950), variant(12, 2950)],
};

const hoodie: Product = {
  id: 2,
  slug: "dnr-hoodie",
  name: "DNR Hoodie",
  description: null,
  thumbnail: null,
  images: [],
  variants: [variant(21, 5999)],
};

describe("addLine", () => {
  it("adds a new line", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0]);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].variantId).toBe(11);
    expect(cart.lines[0].quantity).toBe(1);
    expect(itemCount(cart)).toBe(1);
  });

  it("merges quantity when the same variant is added twice, up to the cap", () => {
    let cart = addLine(emptyCart(), tee, tee.variants[0], 1);
    cart = addLine(cart, tee, tee.variants[0], 3);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(MAX_UNITS_PER_ORDER);
  });

  it("keeps different variants of one product on separate lines", () => {
    let cart = addLine(emptyCart(), tee, tee.variants[0]);
    cart = addLine(cart, tee, tee.variants[1]);
    expect(cart.lines).toHaveLength(2);
  });

  it("clamps quantity to the order cap", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0], 999);
    expect(cart.lines[0].quantity).toBe(MAX_UNITS_PER_ORDER);
  });

  it("caps the order across lines, not just within one", () => {
    // Two units of one size uses the whole budget; another size won't fit.
    let cart = addLine(emptyCart(), tee, tee.variants[0], 2);
    cart = addLine(cart, tee, tee.variants[1], 1);
    expect(cart.lines).toHaveLength(1);
    expect(itemCount(cart)).toBe(MAX_UNITS_PER_ORDER);
  });

  it("splits the budget between sizes", () => {
    let cart = addLine(emptyCart(), tee, tee.variants[0], 1);
    cart = addLine(cart, tee, tee.variants[1], 5);
    expect(cart.lines).toHaveLength(2);
    expect(cart.lines[1].quantity).toBe(1);
    expect(itemCount(cart)).toBe(MAX_UNITS_PER_ORDER);
  });

  it("setQuantity cannot push the order past the cap", () => {
    let cart = addLine(emptyCart(), tee, tee.variants[0], 1);
    cart = addLine(cart, tee, tee.variants[1], 1);
    cart = setQuantity(cart, tee.variants[0].id, 99);
    expect(itemCount(cart)).toBe(MAX_UNITS_PER_ORDER);
  });

  it("clamps a zero or negative quantity up to one", () => {
    expect(addLine(emptyCart(), tee, tee.variants[0], 0).lines[0].quantity).toBe(1);
    expect(addLine(emptyCart(), tee, tee.variants[0], -4).lines[0].quantity).toBe(1);
  });

  it("falls back to the product thumbnail when the variant has no image", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0]);
    expect(cart.lines[0].image).toBe("https://example.test/tee.png");
  });

  it("does not mutate the input cart", () => {
    const original = emptyCart();
    addLine(original, tee, tee.variants[0]);
    expect(original.lines).toHaveLength(0);
  });
});

describe("subtotal", () => {
  it("is zero for an empty cart", () => {
    expect(subtotal(emptyCart())).toEqual(money(0));
    expect(isEmpty(emptyCart())).toBe(true);
  });

  it("multiplies each line by its quantity", () => {
    let cart = addLine(emptyCart(), tee, tee.variants[0], 1);
    cart = addLine(cart, hoodie, hoodie.variants[0], 1);
    // 2950 + 5999
    expect(subtotal(cart).amount).toBe(8949);
    expect(itemCount(cart)).toBe(2);
  });
});

describe("setQuantity and removeLine", () => {
  it("updates a line quantity, bounded by the order cap", () => {
    const cart = setQuantity(addLine(emptyCart(), tee, tee.variants[0]), 11, 4);
    expect(cart.lines[0].quantity).toBe(MAX_UNITS_PER_ORDER);
    const two = setQuantity(addLine(emptyCart(), tee, tee.variants[0]), 11, 2);
    expect(two.lines[0].quantity).toBe(2);
  });

  it("removes the line when quantity drops to zero or below", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0]);
    expect(setQuantity(cart, 11, 0).lines).toHaveLength(0);
    expect(setQuantity(cart, 11, -2).lines).toHaveLength(0);
  });

  it("ignores unknown variant ids", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0]);
    expect(setQuantity(cart, 999, 5).lines[0].quantity).toBe(1);
    expect(removeLine(cart, 999).lines).toHaveLength(1);
  });

  it("clears every line", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0]);
    expect(isEmpty(clear(cart))).toBe(true);
  });
});

describe("toOrderItems", () => {
  it("reduces the cart to ids and quantities", () => {
    let cart = addLine(emptyCart(), tee, tee.variants[0], 1);
    cart = addLine(cart, hoodie, hoodie.variants[0]);
    expect(toOrderItems(cart)).toEqual([
      { variantId: 11, quantity: 1 },
      { variantId: 21, quantity: 1 },
    ]);
  });
});

describe("parseCart", () => {
  it("round-trips a real cart through JSON", () => {
    const cart = addLine(emptyCart(), tee, tee.variants[0], 3);
    expect(parseCart(JSON.parse(JSON.stringify(cart)))).toEqual(cart);
  });

  it("returns an empty cart for junk input", () => {
    expect(parseCart(null).lines).toHaveLength(0);
    expect(parseCart("nope").lines).toHaveLength(0);
    expect(parseCart(42).lines).toHaveLength(0);
    expect(parseCart({}).lines).toHaveLength(0);
    expect(parseCart({ lines: "not-an-array" }).lines).toHaveLength(0);
  });

  it("drops corrupt lines but keeps valid ones", () => {
    const parsed = parseCart({
      currency: "USD",
      lines: [
        null,
        { variantId: "abc", productId: 1, quantity: 1, unitPrice: { amount: 100 } },
        { variantId: 11, productId: 1, quantity: 0, unitPrice: { amount: 100 } },
        { variantId: 12, productId: 1, quantity: 2, unitPrice: { amount: 2950 } },
      ],
    });
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].variantId).toBe(12);
  });

  it("drops lines whose currency does not match the cart", () => {
    const parsed = parseCart({
      currency: "USD",
      lines: [
        {
          variantId: 11,
          productId: 1,
          quantity: 1,
          unitPrice: { amount: 100, currency: "EUR" },
        },
      ],
    });
    expect(parsed.lines).toHaveLength(0);
  });

  it("rejects a negative price", () => {
    const parsed = parseCart({
      currency: "USD",
      lines: [
        { variantId: 11, productId: 1, quantity: 1, unitPrice: { amount: -500 } },
      ],
    });
    expect(parsed.lines).toHaveLength(0);
  });

  it("clamps an absurd stored quantity", () => {
    const parsed = parseCart({
      currency: "USD",
      lines: [
        { variantId: 11, productId: 1, quantity: 10000, unitPrice: { amount: 100 } },
      ],
    });
    expect(parsed.lines[0].quantity).toBe(MAX_UNITS_PER_ORDER);
  });

  it("a stored cart from before the cap cannot restore more than the cap", () => {
    const line = (variantId: number, quantity: number) => ({
      variantId, productId: 1, quantity, unitPrice: { amount: 100 },
    });
    const parsed = parseCart({
      currency: "USD",
      lines: [line(11, 2), line(12, 2), line(13, 1)],
    });
    expect(parsed.lines.reduce((n, l) => n + l.quantity, 0)).toBe(
      MAX_UNITS_PER_ORDER,
    );
  });

  it("falls back to USD for an unknown currency", () => {
    expect(parseCart({ currency: "XYZ", lines: [] }).currency).toBe("USD");
  });
});
