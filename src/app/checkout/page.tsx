"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/use-cart";
import { toOrderItems } from "@/lib/commerce/cart";
import { format } from "@/lib/commerce/money";
import type {
  ApiError,
  PlaceOrderResponse,
  ShippingOptionJson,
  ShippingQuoteResponse,
} from "@/lib/checkout/schema";

type FormState = {
  name: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  phone: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  state_code: "",
  country_code: "US",
  zip: "",
  phone: "",
};

/** Countries where Printful requires a state/province code. */
const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

/**
 * The API validates the request body, so its field paths are prefixed
 * ("recipient.zip"). The form's inputs are keyed by the bare field name, so the
 * prefix is stripped here — without it, inline errors silently never appear.
 */
function toFormFields(fields: Record<string, string> = {}): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [path, message] of Object.entries(fields)) {
    mapped[path.replace(/^recipient\./, "")] = message;
  }
  return mapped;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, total, ready, reset } = useCart();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  /**
   * A quote is only valid for the address it was requested for, so it is stored
   * together with that address and validity is *derived* during render. Editing
   * a field invalidates the quote with no effect and no intermediate frame in
   * which stale rates are still on screen.
   */
  const [quote, setQuote] = useState<{
    addressKey: string;
    options: ShippingOptionJson[];
  } | null>(null);
  const [chosenShippingId, setChosenShippingId] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);

  const items = useMemo(() => toOrderItems(cart), [cart]);

  const addressKey = JSON.stringify([
    form.address1,
    form.address2,
    form.city,
    form.state_code,
    form.country_code,
    form.zip,
  ]);

  const options = quote?.addressKey === addressKey ? quote.options : null;

  // Falls back to the first option so a rate is always selected once quoted.
  const shipping =
    options?.find((option) => option.id === chosenShippingId) ??
    options?.[0] ??
    null;

  const addressComplete =
    form.name.trim() !== "" &&
    form.email.trim() !== "" &&
    form.address1.trim() !== "" &&
    form.city.trim() !== "" &&
    form.zip.trim() !== "" &&
    form.country_code.trim().length === 2 &&
    (!STATE_REQUIRED.has(form.country_code) || form.state_code.trim() !== "");

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFields((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleQuote() {
    setQuoting(true);
    setError(null);
    setFields({});

    try {
      const response = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: form, items }),
      });

      const body = (await response.json()) as
        | ShippingQuoteResponse
        | ApiError;

      if (!response.ok) {
        const failure = body as ApiError;
        setError(failure.error);
        setFields(toFormFields(failure.fields));
        return;
      }

      const quoted = (body as ShippingQuoteResponse).options;
      setQuote({ addressKey, options: quoted });
      setChosenShippingId(quoted[0]?.id ?? null);

      if (quoted.length === 0) {
        setError("No shipping options are available for that address.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setQuoting(false);
    }
  }

  async function handlePlaceOrder() {
    setPlacing(true);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: form,
          items,
          shippingOptionId: shipping?.id,
        }),
      });

      const body = (await response.json()) as PlaceOrderResponse | ApiError;

      if (!response.ok) {
        const failure = body as ApiError;
        setError(failure.error);
        setFields(toFormFields(failure.fields));
        return;
      }

      const order = body as PlaceOrderResponse;

      // Stripe (or any redirect provider) takes over from here. The cart is
      // left intact deliberately: payment hasn't happened yet, and clearing it
      // would strand anyone who backs out of the payment page.
      if (order.redirectUrl) {
        window.location.assign(order.redirectUrl);
        return;
      }

      reset();
      const query = new URLSearchParams({ reference: order.reference });
      if (order.instructions) query.set("instructions", order.instructions);
      router.push(`/checkout/confirmed?${query.toString()}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-32 sm:px-10">
        <p className="label">Loading…</p>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-36 text-center sm:px-10">
        <p className="label">Checkout — empty</p>
        <h1 className="display mt-8 text-6xl sm:text-8xl">
          Nothing to
          <br />
          check out
        </h1>
        <p className="prose-body mx-auto mt-10 text-sm">
          Your cart is empty. Pick something from the line first.
        </p>
        <Link href="/shop" className="btn btn-primary mt-14">
          Browse the shop
        </Link>
      </div>
    );
  }

  const grandTotal = shipping ? total.amount + shipping.rate.amount : total.amount;

  return (
    <div className="mx-auto max-w-5xl px-6 sm:px-10">
      <header className="border-b border-hairline py-24 sm:py-28">
        <p className="label">Step 2 of 2</p>
        <h1 className="display mt-6 text-7xl sm:text-8xl">Checkout</h1>
      </header>

      <div className="grid gap-16 py-16 lg:grid-cols-[1fr_320px] lg:gap-24 lg:py-20">
        <form
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (options) void handlePlaceOrder();
            else void handleQuote();
          }}
        >
          <h2 className="label border-b border-hairline pb-4 text-bone">
            01 — Delivery address
          </h2>

          <Field
            label="Full name"
            value={form.name}
            error={fields.name}
            autoComplete="name"
            onChange={(value) => update("name", value)}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            error={fields.email}
            autoComplete="email"
            onChange={(value) => update("email", value)}
          />
          <Field
            label="Address"
            value={form.address1}
            error={fields.address1}
            autoComplete="address-line1"
            onChange={(value) => update("address1", value)}
          />
          <Field
            label="Apartment, suite (optional)"
            value={form.address2}
            error={fields.address2}
            autoComplete="address-line2"
            required={false}
            onChange={(value) => update("address2", value)}
          />

          <div className="grid gap-8 sm:grid-cols-2">
            <Field
              label="City"
              value={form.city}
              error={fields.city}
              autoComplete="address-level2"
              onChange={(value) => update("city", value)}
            />
            <Field
              label={
                STATE_REQUIRED.has(form.country_code)
                  ? "State / province code"
                  : "State / province (optional)"
              }
              value={form.state_code}
              error={fields.state_code}
              autoComplete="address-level1"
              required={STATE_REQUIRED.has(form.country_code)}
              hint="Two-letter code, e.g. CA"
              onChange={(value) => update("state_code", value.toUpperCase())}
            />
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <Field
              label="Country code"
              value={form.country_code}
              error={fields.country_code}
              autoComplete="country"
              hint="Two-letter code, e.g. US"
              onChange={(value) => update("country_code", value.toUpperCase())}
            />
            <Field
              label="Postal code"
              value={form.zip}
              error={fields.zip}
              autoComplete="postal-code"
              onChange={(value) => update("zip", value)}
            />
          </div>

          <Field
            label="Phone (optional)"
            type="tel"
            value={form.phone}
            error={fields.phone}
            autoComplete="tel"
            required={false}
            onChange={(value) => update("phone", value)}
          />

          {options ? (
            <fieldset className="pt-10">
              <legend className="label border-b border-hairline pb-4 text-bone">
                02 — Shipping method
              </legend>
              <div className="mt-6">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center justify-between gap-6 border-b border-hairline py-5 transition-colors hover:border-hairline-lit"
                  >
                    <span className="flex items-center gap-4">
                      <input
                        type="radio"
                        name="shipping"
                        value={option.id}
                        checked={shipping?.id === option.id}
                        onChange={() => setChosenShippingId(option.id)}
                        className="accent-bone"
                      />
                      <span
                        className={`text-sm transition-colors ${
                          shipping?.id === option.id
                            ? "text-bone"
                            : "text-bone-soft"
                        }`}
                      >
                        {option.name}
                        {option.minDeliveryDays && option.maxDeliveryDays ? (
                          <span className="label mt-2 block">
                            {option.minDeliveryDays}–{option.maxDeliveryDays}{" "}
                            business days
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="font-mono text-sm whitespace-nowrap tabular-nums text-bone">
                      {option.rate.formatted}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border-l-2 border-alert bg-surface px-4 py-3 text-sm text-alert"
            >
              {error}
            </p>
          ) : null}

          <div className="pt-4">
            <button
              type="submit"
              disabled={!addressComplete || quoting || placing}
              className="btn btn-primary w-full sm:w-auto"
            >
              {quoting
                ? "Getting rates…"
                : placing
                  ? "Placing order…"
                  : options
                    ? "Place order"
                    : "Continue to shipping"}
            </button>

            {!addressComplete ? (
              <p className="mt-4 text-xs text-ink-faint">
                Fill in the required fields to continue.
              </p>
            ) : null}
          </div>
        </form>

        <aside className="h-fit border-t border-rule pt-6 lg:sticky lg:top-28">
          <h2 className="label">Order summary</h2>

          <ul className="mt-6">
            {cart.lines.map((line) => (
              <li
                key={line.variantId}
                className="flex justify-between gap-6 border-b border-rule py-4 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate">{line.productName}</span>
                  <span className="mt-1 block text-xs text-ink-faint">
                    {line.variantName} × {line.quantity}
                  </span>
                </span>
                <span className="shrink-0">
                  {format({
                    amount: line.unitPrice.amount * line.quantity,
                    currency: line.unitPrice.currency,
                  })}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="label">Subtotal</dt>
              <dd>{format(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="label">Shipping</dt>
              <dd>{shipping ? shipping.rate.formatted : "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-rule pt-4">
              <dt className="label">Total</dt>
              <dd className="text-base">
                {format({ amount: grandTotal, currency: total.currency })}
              </dd>
            </div>
          </dl>

          <p className="editorial mt-8 text-sm leading-relaxed text-ink-soft">
            Taxes, where applicable, are calculated by the fulfiller and shown on
            your invoice.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  required = true,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div>
      <label htmlFor={id} className="label block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="field-input mt-2"
      />
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-xs text-alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
