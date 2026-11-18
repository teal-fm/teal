import { z } from "zod";

/**
 * An optional search param as a non-empty string. The router parses `?size=5`
 * as a number, so numbers are read back as strings; anything else is dropped.
 */
export const searchString = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().min(1))
  .optional()
  .catch(undefined);

/** An optional search param limited to `values`; anything else is dropped. */
export function searchEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values).optional().catch(undefined);
}
