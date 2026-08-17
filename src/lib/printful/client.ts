import "server-only";
import { z } from "zod";
import { config } from "@/lib/config";
import { envelope, errorEnvelope } from "./types";

/**
 * Thin, typed transport for the Printful v1 API.
 *
 * Responsibilities stop at: auth, timeouts, retries on transient failures, and
 * validating the response envelope. Mapping to domain types lives in
 * `catalog.ts` / `orders.ts`.
 */

export class PrintfulError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PrintfulError";
  }

  /** True when retrying the same request could plausibly succeed. */
  get isTransient(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export class PrintfulNotConfiguredError extends Error {
  constructor() {
    super(
      "PRINTFUL_API_KEY is not set. The storefront is running on the demo catalog.",
    );
    this.name = "PrintfulNotConfiguredError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

type RequestOptions<T extends z.ZodTypeAny> = {
  path: string;
  schema: T;
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /**
   * Seconds to cache a GET in Next's data cache. Catalog reads are cached;
   * shipping quotes and order writes never are.
   */
  revalidate?: number | false;
};

function buildUrl(
  path: string,
  query?: RequestOptions<z.ZodTypeAny>["query"],
): string {
  const url = new URL(path.replace(/^\//, ""), `${config.printful.baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readError(response: Response): Promise<string> {
  try {
    const parsed = errorEnvelope.safeParse(await response.json());
    if (parsed.success) {
      const { error, result } = parsed.data;
      const message =
        error?.message ??
        error?.reason ??
        (typeof result === "string" ? result : "");
      return message || `Printful returned ${response.status}`;
    }
  } catch {
    // Body was not JSON; fall through to the generic message.
  }
  return `Printful returned ${response.status}`;
}

/**
 * Performs one Printful request, validating the `{ code, result }` envelope and
 * returning the unwrapped `result`. Retries transient failures with backoff.
 */
export async function printfulRequest<T extends z.ZodTypeAny>({
  path,
  schema,
  method = "GET",
  body,
  query,
  revalidate = false,
}: RequestOptions<T>): Promise<z.infer<T>> {
  if (!config.printful.token) throw new PrintfulNotConfiguredError();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.printful.token}`,
    "Content-Type": "application/json",
  };
  // Account-level tokens serve several stores and must say which one.
  if (config.printful.storeId) {
    headers["X-PF-Store-Id"] = config.printful.storeId;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: timeout,
        cache: revalidate === false ? "no-store" : undefined,
        next: revalidate === false ? undefined : { revalidate },
      });

      if (!response.ok) {
        const error = new PrintfulError(
          await readError(response),
          response.status,
        );
        if (error.isTransient && attempt < MAX_ATTEMPTS) {
          lastError = error;
          await backoff(attempt);
          continue;
        }
        throw error;
      }

      const wrapper = envelope.safeParse(await response.json());
      if (!wrapper.success) {
        // A shape change upstream is a bug on our side to fix, not a retry.
        throw new PrintfulError(
          `Unexpected response envelope from ${path}`,
          response.status,
          wrapper.error.issues,
        );
      }

      const parsed = schema.safeParse(wrapper.data.result);
      if (!parsed.success) {
        throw new PrintfulError(
          `Unexpected response shape from ${path}`,
          response.status,
          parsed.error.issues,
        );
      }

      return parsed.data as z.infer<T>;
    } catch (error) {
      if (error instanceof PrintfulError && !error.isTransient) throw error;

      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await backoff(attempt);
        continue;
      }
    }
  }

  if (lastError instanceof Error) {
    throw new PrintfulError(
      `Printful request to ${path} failed: ${lastError.message}`,
      503,
      lastError,
    );
  }
  throw new PrintfulError(`Printful request to ${path} failed`, 503, lastError);
}

function backoff(attempt: number): Promise<void> {
  const delay = 250 * 2 ** (attempt - 1);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
