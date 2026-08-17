import { describe, expect, it } from "vitest";
import { buildSlug, idFromSlug, parseVariantOptions, toProduct, toVariant } from "./catalog";
import type { SyncProductDetail, SyncVariant } from "./types";

function syncVariant(overrides: Partial<SyncVariant> = {}): SyncVariant {
  return {
    id: 4001,
    external_id: "ext-4001",
    sync_product_id: 300,
    name: "DNR Tee - Black / L",
    synced: true,
    variant_id: 4012,
    retail_price: "29.50",
    currency: "USD",
    files: [{ id: 1, type: "preview", preview_url: "https://cdn.test/p.png" }],
    product: {
      variant_id: 4012,
      product_id: 71,
      image: "https://cdn.test/catalog.png",
      name: "Unisex Staple T-Shirt | Bella + Canvas 3001 (Black / L)",
    },
    ...overrides,
  };
}

function detail(overrides: Partial<SyncProductDetail> = {}): SyncProductDetail {
  return {
    sync_product: {
      id: 300,
      external_id: "ext-300",
      name: "DNR Tee",
      description: "  A good tee.  ",
      variants: 1,
      synced: 1,
      thumbnail_url: "https://cdn.test/thumb.png",
    },
    sync_variants: [syncVariant()],
    ...overrides,
  };
}

describe("parseVariantOptions", () => {
  it("reads size and colour from the catalog product name", () => {
    expect(parseVariantOptions(syncVariant())).toEqual({
      size: "L",
      color: "Black",
      label: "Black / L",
    });
  });

  it("falls back to the sync variant name when the catalog name is absent", () => {
    const parsed = parseVariantOptions(
      syncVariant({ product: null, name: "DNR Hoodie - Faded Olive / 2XL" }),
    );
    expect(parsed).toEqual({
      size: "2XL",
      color: "Faded Olive",
      label: "Faded Olive / 2XL",
    });
  });

  it("handles a size-only variant", () => {
    const parsed = parseVariantOptions(
      syncVariant({ product: { name: "Poster (18×24)" }, name: "Poster - 18×24" }),
    );
    expect(parsed.size).toBe("18×24");
    expect(parsed.color).toBeNull();
  });

  it("treats One Size as a size, not a colour", () => {
    const parsed = parseVariantOptions(
      syncVariant({ product: { name: "Cap (Olive / One Size)" } }),
    );
    expect(parsed).toEqual({
      size: "One Size",
      color: "Olive",
      label: "Olive / One Size",
    });
  });

  it("falls back to the raw name when nothing parses", () => {
    const parsed = parseVariantOptions(
      syncVariant({ product: null, name: "Mystery Item" }),
    );
    expect(parsed.size).toBeNull();
    expect(parsed.color).toBeNull();
    expect(parsed.label).toBe("Mystery Item");
  });
});

describe("toVariant", () => {
  it("parses the price into minor units", () => {
    expect(toVariant(syncVariant(), "USD")?.price).toEqual({
      amount: 2950,
      currency: "USD",
    });
  });

  it("drops a variant with an unusable price rather than showing it free", () => {
    expect(toVariant(syncVariant({ retail_price: null }), "USD")).toBeNull();
    expect(toVariant(syncVariant({ retail_price: "" }), "USD")).toBeNull();
    expect(toVariant(syncVariant({ retail_price: "TBD" }), "USD")).toBeNull();
  });

  it("prefers the file preview over the catalog image", () => {
    expect(toVariant(syncVariant(), "USD")?.image).toBe("https://cdn.test/p.png");
  });

  it("falls back to the catalog image when no preview exists", () => {
    expect(toVariant(syncVariant({ files: [] }), "USD")?.image).toBe(
      "https://cdn.test/catalog.png",
    );
  });

  it("marks discontinued and out-of-stock variants unavailable", () => {
    expect(
      toVariant(syncVariant({ availability_status: "discontinued" }), "USD")
        ?.available,
    ).toBe(false);
    expect(
      toVariant(syncVariant({ availability_status: "out_of_stock" }), "USD")
        ?.available,
    ).toBe(false);
  });

  it("treats an unrecognised status as available", () => {
    expect(
      toVariant(syncVariant({ availability_status: "some_new_status" }), "USD")
        ?.available,
    ).toBe(true);
  });

  it("uses the variant currency when it is supported", () => {
    expect(
      toVariant(syncVariant({ currency: "gbp" }), "USD")?.price.currency,
    ).toBe("GBP");
  });

  it("falls back to the store currency for an unknown one", () => {
    expect(
      toVariant(syncVariant({ currency: "XYZ" }), "USD")?.price.currency,
    ).toBe("USD");
  });
});

describe("toProduct", () => {
  it("maps a full product", () => {
    const product = toProduct(detail())!;
    expect(product.id).toBe(300);
    expect(product.name).toBe("DNR Tee");
    expect(product.description).toBe("A good tee.");
    expect(product.slug).toBe("dnr-tee-300");
    expect(product.variants).toHaveLength(1);
  });

  it("returns null when no variant is sellable", () => {
    expect(
      toProduct(detail({ sync_variants: [syncVariant({ retail_price: null })] })),
    ).toBeNull();
    expect(toProduct(detail({ sync_variants: [] }))).toBeNull();
  });

  it("keeps sellable variants when a sibling is unpriced", () => {
    const product = toProduct(
      detail({
        sync_variants: [syncVariant({ retail_price: null }), syncVariant({ id: 4002 })],
      }),
    )!;
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0].id).toBe(4002);
  });

  it("normalises a blank description to null", () => {
    const product = toProduct(
      detail({
        sync_product: { id: 300, name: "DNR Tee", description: "   " },
      }),
    )!;
    expect(product.description).toBeNull();
  });

  it("de-duplicates images", () => {
    const product = toProduct(
      detail({
        sync_variants: [syncVariant(), syncVariant({ id: 4002 })],
      }),
    )!;
    expect(product.images).toEqual([
      "https://cdn.test/thumb.png",
      "https://cdn.test/p.png",
    ]);
  });
});

describe("slugs", () => {
  it("round-trips an id through a slug", () => {
    const slug = buildSlug("DNR Heavyweight Tee", 4821);
    expect(slug).toBe("dnr-heavyweight-tee-4821");
    expect(idFromSlug(slug)).toBe(4821);
  });

  it("keeps same-named products distinct", () => {
    expect(buildSlug("Tee", 1)).not.toBe(buildSlug("Tee", 2));
  });

  it("strips accents and punctuation", () => {
    expect(buildSlug("Café  Crème!! Tee", 7)).toBe("cafe-creme-tee-7");
  });

  it("survives a name with no usable characters", () => {
    expect(buildSlug("!!!", 9)).toBe("product-9");
    expect(idFromSlug(buildSlug("!!!", 9))).toBe(9);
  });

  it("returns null for a slug with no id", () => {
    expect(idFromSlug("just-a-name")).toBeNull();
    expect(idFromSlug("")).toBeNull();
  });
});
