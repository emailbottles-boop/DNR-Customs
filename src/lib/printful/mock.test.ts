import { describe, expect, it } from "vitest";
import { MOCK_PRODUCTS, MOCK_SHIPPING_RATES } from "./mock";
import { idFromSlug } from "./catalog";
import { parseDecimal } from "@/lib/commerce/money";
import { isInStock, optionValues, startingPrice } from "@/lib/commerce/product";

/**
 * The demo catalog is the entire experience for anyone without credentials, and
 * it is what the storefront prerenders at build time. These guard the
 * invariants the rest of the app assumes about it.
 */

describe("demo catalog", () => {
  it("uses negative ids so a demo id can never collide with a real Printful one", () => {
    for (const product of MOCK_PRODUCTS) {
      expect(product.id).toBeLessThan(0);
      for (const variant of product.variants) {
        expect(variant.id).toBeLessThan(0);
      }
    }
  });

  it("has globally unique variant ids", () => {
    const ids = MOCK_PRODUCTS.flatMap((p) => p.variants.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique product ids and slugs", () => {
    const ids = MOCK_PRODUCTS.map((p) => p.id);
    const slugs = MOCK_PRODUCTS.map((p) => p.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses clean, URL-safe slugs", () => {
    // Demo products are looked up by exact slug, not by parsing an id out of
    // it (which only works for the positive ids Printful issues). So the demo
    // slugs stay plain names — no trailing id, no double hyphen.
    for (const product of MOCK_PRODUCTS) {
      expect(product.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(idFromSlug(product.slug)).toBeNull();
    }
  });

  it("prices every variant above zero", () => {
    for (const product of MOCK_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.price.amount).toBeGreaterThan(0);
        expect(variant.price.currency).toBe("USD");
      }
    }
  });

  it("gives every product a thumbnail, a description, and stock", () => {
    for (const product of MOCK_PRODUCTS) {
      expect(product.thumbnail).toBeTruthy();
      expect(product.description).toBeTruthy();
      expect(isInStock(product)).toBe(true);
      expect(startingPrice(product)).not.toBeNull();
    }
  });

  it("names a size and colour on every variant so the picker renders", () => {
    for (const product of MOCK_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.size, `${product.name} / ${variant.name}`).toBeTruthy();
        expect(variant.color, `${product.name} / ${variant.name}`).toBeTruthy();
      }
      expect(optionValues(product, "size").length).toBeGreaterThan(0);
      expect(optionValues(product, "color").length).toBeGreaterThan(0);
    }
  });

  it("keeps variant names consistent with their parsed options", () => {
    for (const product of MOCK_PRODUCTS) {
      for (const variant of product.variants) {
        expect(variant.name).toBe(`${variant.color} / ${variant.size}`);
      }
    }
  });

  it("includes at least one unavailable variant", () => {
    // Real catalogs have gaps; the picker's disabled-combination handling is
    // only exercised in the demo if the demo actually contains one.
    const unavailable = MOCK_PRODUCTS.flatMap((p) =>
      p.variants.filter((v) => !v.available),
    );
    expect(unavailable.length).toBeGreaterThan(0);
  });

  it("embeds images as self-contained data URIs", () => {
    // No external image host, so the demo renders offline and at build time.
    for (const product of MOCK_PRODUCTS) {
      expect(product.thumbnail).toMatch(/^data:image\/svg\+xml/);
      for (const variant of product.variants) {
        expect(variant.image).toMatch(/^data:image\/svg\+xml/);
      }
    }
  });
});

describe("demo shipping rates", () => {
  it("parses every rate as money", () => {
    for (const rate of MOCK_SHIPPING_RATES) {
      const parsed = parseDecimal(rate.rate, "USD");
      expect(parsed).not.toBeNull();
      expect(parsed!.amount).toBeGreaterThan(0);
    }
  });

  it("offers distinct options with a cheapest one", () => {
    const ids = MOCK_SHIPPING_RATES.map((rate) => rate.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MOCK_SHIPPING_RATES.length).toBeGreaterThan(1);
  });
});
