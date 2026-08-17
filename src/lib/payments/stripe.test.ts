import { describe, expect, it } from "vitest";
import {
  __encodeFormForTests as encodeForm,
  __publicImageUrlForTests as publicImageUrl,
} from "./stripe";

/**
 * Stripe fetches line-item images server-side, so an unusable URL doesn't just
 * fail to render — it makes Stripe reject the session and the customer never
 * reaches a payment page. The filter has to be strict.
 */
describe("publicImageUrl", () => {
  it("passes through a public https URL", () => {
    const url = "https://files.cdn.printful.com/files/abc/preview.png";
    expect(publicImageUrl(url)).toBe(url);
  });

  it("allows plain http", () => {
    expect(publicImageUrl("http://cdn.example.com/a.png")).toBe(
      "http://cdn.example.com/a.png",
    );
  });

  it("drops the demo catalog's inline data URIs", () => {
    // The whole demo catalog uses these; sending one would break test checkouts.
    expect(publicImageUrl("data:image/svg+xml;utf8,%3Csvg%3E")).toBeNull();
  });

  it("drops relative paths, which Stripe cannot resolve", () => {
    expect(publicImageUrl("/images/tee.png")).toBeNull();
    expect(publicImageUrl("images/tee.png")).toBeNull();
  });

  it("drops localhost URLs that Stripe's servers cannot reach", () => {
    expect(publicImageUrl("http://localhost:3000/tee.png")).toBeNull();
    expect(publicImageUrl("http://127.0.0.1:3000/tee.png")).toBeNull();
    expect(publicImageUrl("http://[::1]:3000/tee.png")).toBeNull();
  });

  it("drops an over-long URL", () => {
    expect(publicImageUrl(`https://cdn.test/${"a".repeat(2100)}.png`)).toBeNull();
  });

  it("handles absent images", () => {
    expect(publicImageUrl(null)).toBeNull();
    expect(publicImageUrl(undefined)).toBeNull();
    expect(publicImageUrl("")).toBeNull();
  });

  it("is not fooled by a hostname that merely starts with localhost", () => {
    expect(publicImageUrl("https://localhost.dnrcustoms.com/a.png")).toBe(
      "https://localhost.dnrcustoms.com/a.png",
    );
  });
});

/**
 * Stripe's form encoding is the part of this integration most likely to break
 * silently — a wrong bracket path is accepted as an unknown parameter and the
 * session comes back missing a line item rather than erroring.
 */
describe("encodeForm", () => {
  it("encodes flat values", () => {
    expect(encodeForm({ mode: "payment" }).toString()).toBe("mode=payment");
  });

  it("encodes nested objects with bracket paths", () => {
    expect(
      encodeForm({ metadata: { order_reference: "DNR-1" } }).toString(),
    ).toBe("metadata%5Border_reference%5D=DNR-1");
  });

  it("indexes array entries", () => {
    const encoded = encodeForm({
      line_items: [
        { quantity: 2, price_data: { unit_amount: 2950, currency: "usd" } },
      ],
    });
    expect(encoded.get("line_items[0][quantity]")).toBe("2");
    expect(encoded.get("line_items[0][price_data][unit_amount]")).toBe("2950");
    expect(encoded.get("line_items[0][price_data][currency]")).toBe("usd");
  });

  it("keeps multiple line items distinct", () => {
    const encoded = encodeForm({
      line_items: [{ quantity: 1 }, { quantity: 5 }],
    });
    expect(encoded.get("line_items[0][quantity]")).toBe("1");
    expect(encoded.get("line_items[1][quantity]")).toBe("5");
  });

  it("omits null and undefined instead of sending the string 'null'", () => {
    const encoded = encodeForm({ a: null, b: undefined, c: "kept" });
    expect(encoded.has("a")).toBe(false);
    expect(encoded.has("b")).toBe(false);
    expect(encoded.get("c")).toBe("kept");
  });

  it("preserves zero and false rather than dropping them", () => {
    const encoded = encodeForm({ amount: 0, enabled: false });
    expect(encoded.get("amount")).toBe("0");
    expect(encoded.get("enabled")).toBe("false");
  });

  it("escapes values that would otherwise break the body", () => {
    const encoded = encodeForm({ name: "Tee & Hoodie / 2XL" });
    expect(encoded.get("name")).toBe("Tee & Hoodie / 2XL");
    expect(encoded.toString()).toContain("%26");
  });
});
