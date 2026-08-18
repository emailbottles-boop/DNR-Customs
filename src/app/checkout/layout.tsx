import type { Metadata } from "next";

/**
 * Same reason as the cart: the checkout page is a client component and cannot
 * export `metadata` itself. Left out of search indexes as well — a checkout
 * form is not a landing page.
 */
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
