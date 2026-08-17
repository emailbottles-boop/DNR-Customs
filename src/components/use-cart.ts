"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addLine,
  clear,
  itemCount,
  removeLine,
  setQuantity,
  subtotal,
} from "@/lib/commerce/cart";
import {
  getCartServerSnapshot,
  getCartSnapshot,
  subscribeToCart,
  updateCart,
} from "@/lib/commerce/cart-store";
import type { Cart } from "@/lib/commerce/cart";
import type { Money } from "@/lib/commerce/money";
import type { Product, ProductVariant } from "@/lib/commerce/product";

/**
 * React binding over the cart store. There is no provider: the store is a
 * module singleton, so any client component can call `useCart()` directly.
 */

const noopSubscribe = () => () => {};

/** True only after hydration, so the UI can hold off on cart-dependent markup. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export type CartApi = {
  cart: Cart;
  count: number;
  total: Money;
  ready: boolean;
  add: (product: Product, variant: ProductVariant, quantity?: number) => void;
  remove: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  reset: () => void;
};

export function useCart(): CartApi {
  const cart = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getCartServerSnapshot,
  );
  const ready = useHydrated();

  const add = useCallback(
    (product: Product, variant: ProductVariant, quantity = 1) => {
      updateCart((current) => addLine(current, product, variant, quantity));
    },
    [],
  );

  const remove = useCallback((variantId: number) => {
    updateCart((current) => removeLine(current, variantId));
  }, []);

  const updateQuantity = useCallback((variantId: number, quantity: number) => {
    updateCart((current) => setQuantity(current, variantId, quantity));
  }, []);

  const reset = useCallback(() => {
    updateCart((current) => clear(current));
  }, []);

  return useMemo(
    () => ({
      cart,
      count: itemCount(cart),
      total: subtotal(cart),
      ready,
      add,
      remove,
      updateQuantity,
      reset,
    }),
    [cart, ready, add, remove, updateQuantity, reset],
  );
}
