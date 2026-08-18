import { describe, expect, it } from "vitest";
import { selectColor, selectSize } from "./product";
import { money } from "./money";
import type { Product, ProductVariant } from "./product";

/**
 * The reported bug: pick 2XL in Black, switch to White, and the buy button
 * dies. White is not made in 2XL, so the pair does not exist and nothing
 * corrects it. These pin the reconciliation that fixes it.
 */

function variant(
  color: string,
  size: string,
  available = true,
): ProductVariant {
  return {
    id: Math.abs(`${color}${size}`.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7)),
    catalogVariantId: null,
    name: `${color} / ${size}`,
    size,
    color,
    price: money(4200),
    image: null,
    available,
  };
}

/** Black runs S–2XL. White stops at XL. */
const shirt: Product = {
  id: 1,
  slug: "drop-01",
  name: "Drop 01 Long Sleeve",
  description: null,
  thumbnail: null,
  images: [],
  variants: [
    variant("Black", "S"),
    variant("Black", "M"),
    variant("Black", "XL"),
    variant("Black", "2XL"),
    variant("White", "S"),
    variant("White", "M"),
    variant("White", "XL"),
  ],
};

describe("selectColor", () => {
  it("keeps the size when the new colour is made in it", () => {
    expect(selectColor(shirt, "White", "M")).toEqual({
      color: "White",
      size: "M",
    });
  });

  it("moves the size when the new colour does not come in it", () => {
    // The exact reported failure: 2XL in Black, then switch to White.
    const next = selectColor(shirt, "White", "2XL");
    expect(next.color).toBe("White");
    expect(next.size).not.toBe("2XL");
    expect(
      shirt.variants.some(
        (v) => v.color === next.color && v.size === next.size && v.available,
      ),
    ).toBe(true);
  });

  it("never overrides the colour the shopper just chose", () => {
    expect(selectColor(shirt, "White", "2XL").color).toBe("White");
  });

  it("leaves an entirely unavailable colour alone rather than jumping away", () => {
    const soldOut: Product = {
      ...shirt,
      variants: [...shirt.variants, variant("Clay", "M", false)],
    };
    expect(selectColor(soldOut, "Clay", "M")).toEqual({
      color: "Clay",
      size: "M",
    });
  });

  it("skips unavailable variants when picking the fallback size", () => {
    const partly: Product = {
      ...shirt,
      variants: [
        variant("Sage", "S", false),
        variant("Sage", "L", true),
        ...shirt.variants,
      ],
    };
    expect(selectColor(partly, "Sage", "2XL")).toEqual({
      color: "Sage",
      size: "L",
    });
  });
});

describe("selectSize", () => {
  it("keeps the colour when that size exists in it", () => {
    expect(selectSize(shirt, "XL", "White")).toEqual({
      color: "White",
      size: "XL",
    });
  });

  it("moves the colour when the size is not made in it", () => {
    // 2XL only exists in Black, so asking for 2XL from White moves to Black.
    expect(selectSize(shirt, "2XL", "White")).toEqual({
      color: "Black",
      size: "2XL",
    });
  });

  it("never overrides the size the shopper just chose", () => {
    expect(selectSize(shirt, "2XL", "White").size).toBe("2XL");
  });
});

describe("round trips", () => {
  it("always lands on a real, buyable combination", () => {
    const colors = ["Black", "White"];
    const sizes = ["S", "M", "XL", "2XL"];

    for (const color of colors) {
      for (const size of sizes) {
        for (const next of colors) {
          const result = selectColor(shirt, next, size);
          const real = shirt.variants.some(
            (v) =>
              v.color === result.color &&
              v.size === result.size &&
              v.available,
          );
          expect(real, `${color}/${size} → ${next}`).toBe(true);
        }
      }
    }
  });
});

describe("nearest size fallback", () => {
  it("moves 2XL to XL, not all the way down to S", () => {
    // Landing on S would hand a 2XL shopper something that will not fit.
    expect(selectColor(shirt, "White", "2XL")).toEqual({
      color: "White",
      size: "XL",
    });
  });

  it("measures distance along the product's size order, not the alphabet", () => {
    // Alphabetically "M" precedes "S"; by size order M is adjacent to S.
    const upTo: Product = {
      ...shirt,
      variants: [
        variant("Black", "S"),
        variant("Black", "M"),
        variant("Black", "XL"),
        variant("Sage", "M"),
      ],
    };
    expect(selectColor(upTo, "Sage", "S").size).toBe("M");
  });

  it("prefers the larger size when two are equally close", () => {
    // A shirt slightly too big is wearable; too small is not.
    const gap: Product = {
      ...shirt,
      variants: [
        variant("Black", "S"),
        variant("Black", "M"),
        variant("Black", "L"),
        variant("Sage", "S"),
        variant("Sage", "L"),
      ],
    };
    expect(selectColor(gap, "Sage", "M").size).toBe("L");
  });
});
