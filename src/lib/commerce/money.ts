/**
 * Money is always carried as an integer number of minor units (cents for USD).
 *
 * Printful's API returns prices as decimal *strings* ("29.50"). Parsing those
 * into floats and adding them up is how storefronts end up charging $29.509999,
 * so every price crosses into this module at the boundary and stays an integer
 * until it is rendered.
 */

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export type Money = {
  /** Integer minor units. 2950 === $29.50 */
  amount: number;
  currency: Currency;
};

const SUPPORTED: readonly Currency[] = ["USD", "EUR", "GBP", "CAD", "AUD"];

export function isCurrency(value: string): value is Currency {
  return (SUPPORTED as readonly string[]).includes(value);
}

export function money(amount: number, currency: Currency = "USD"): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(
      `Money amount must be an integer number of minor units, received ${amount}`,
    );
  }
  return { amount, currency };
}

export function zero(currency: Currency = "USD"): Money {
  return { amount: 0, currency };
}

/**
 * Parses a decimal money string ("29.50", "1,299.00", "-5") into minor units.
 * Returns null rather than throwing, so a single malformed price from an
 * upstream API degrades one product instead of taking down the whole catalog.
 */
export function parseDecimal(
  value: string | number | null | undefined,
  currency: Currency = "USD",
): Money | null {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;

  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");

  // Pad or truncate to exactly two decimal places, rounding the remainder.
  const padded = `${fraction}00`.slice(0, 2);
  const beyond = fraction.slice(2, 3);
  let minor = Number(whole) * 100 + Number(padded);
  if (beyond && Number(beyond) >= 5) minor += 1;

  if (!Number.isFinite(minor)) return null;
  return { amount: negative ? -minor : minor, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(
      `Cannot combine ${a.currency} with ${b.currency}; convert first.`,
    );
  }
}

export function add(...amounts: Money[]): Money {
  if (amounts.length === 0) return zero();
  return amounts.reduce((acc, next) => {
    assertSameCurrency(acc, next);
    return { amount: acc.amount + next.amount, currency: acc.currency };
  });
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

/** Multiplies by an integer quantity. Rounds half-up for fractional factors. */
export function multiply(value: Money, factor: number): Money {
  return { amount: Math.round(value.amount * factor), currency: value.currency };
}

export function isZero(value: Money): boolean {
  return value.amount === 0;
}

export function isPositive(value: Money): boolean {
  return value.amount > 0;
}

export function format(value: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(value.amount / 100);
}

/** Renders as a plain decimal string, the shape Printful expects on write. */
export function toDecimalString(value: Money): string {
  const sign = value.amount < 0 ? "-" : "";
  const abs = Math.abs(value.amount);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
