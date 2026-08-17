import type { z } from "zod";

/** Reads a JSON body, returning null instead of throwing on malformed input. */
export async function jsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Flattens a Zod error into `{ fieldName: message }` so the checkout form can
 * put each message next to its input. Nested paths are joined with dots to
 * match the form's field naming.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    // Keep the first message per field; later ones are usually less specific.
    if (key && !fields[key]) fields[key] = issue.message;
  }
  return fields;
}
