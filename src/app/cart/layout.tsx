import type { Metadata } from "next";

/**
 * The cart page is a client component, and client components cannot export
 * `metadata` — so without this layout the browser tab falls back to the
 * site-wide default and every page reads the same.
 */
export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
