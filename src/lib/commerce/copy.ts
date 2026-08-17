/**
 * Product copy that has to render on both the server and the client.
 *
 * Deliberately not in `config.ts`: that module is `server-only`, and this text
 * appears in the checkout form, which is a client component. Keeping one
 * exported constant is what stops the same sentence being written twice and
 * drifting.
 */

/**
 * Where the artwork sits on the garment.
 *
 * Stated on the product page above the size picker, and again in the checkout
 * summary. It is the single thing a buyer is most likely to get wrong — the
 * mockup shows a front view and the print is on the back — and a made-to-order
 * garment cannot be returned for a change of mind, so the disclosure has to
 * land before the money does.
 *
 * One constant because the shop sells one thing. When the range grows this
 * belongs on the product: Printful reports placement per print file.
 */
export const PRINT_PLACEMENT =
  "Logo is printed on the back. The front is blank.";
