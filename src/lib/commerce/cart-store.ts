import { emptyCart, parseCart } from "./cart";
import type { Cart } from "./cart";

/**
 * The cart as an external store, read through `useSyncExternalStore`.
 *
 * localStorage genuinely is an external store: it exists outside React, it
 * persists across reloads, and another tab can change it underneath us. Modelling
 * it that way (rather than copying it into state inside an effect) gets correct
 * hydration and cross-tab sync for free, and avoids a cascading render on mount.
 */

const STORAGE_KEY = "dnr.cart.v1";

/**
 * The server has no cart, so SSR and the hydration pass both render this exact
 * object. React swaps to the client snapshot immediately after mount.
 */
const SERVER_SNAPSHOT: Cart = emptyCart();

/** Cached so repeated getSnapshot calls return a stable reference. */
let snapshot: Cart | null = null;

const listeners = new Set<() => void>();

function readStorage(): Cart {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? parseCart(JSON.parse(stored)) : emptyCart();
  } catch {
    // Corrupt JSON, or storage blocked (private mode, cookies disabled).
    return emptyCart();
  }
}

export function getCartSnapshot(): Cart {
  if (snapshot === null) snapshot = readStorage();
  return snapshot;
}

export function getCartServerSnapshot(): Cart {
  return SERVER_SNAPSHOT;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToCart(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab writing the cart should update this one.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = readStorage();
    emit();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Applies an update, persists it, and notifies subscribers. */
export function updateCart(mutate: (current: Cart) => Cart): void {
  const next = mutate(getCartSnapshot());
  if (next === snapshot) return;

  snapshot = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage unavailable; the cart still works in-memory.
  }

  emit();
}

/** Test seam: drops the cached snapshot so the next read hits storage again. */
export function resetCartCache(): void {
  snapshot = null;
}
