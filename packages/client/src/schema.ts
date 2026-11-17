import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";
import { z } from "zod";

/** A non-empty string, or `undefined` when the field is missing, empty, or not a string. */
export const optionalString = z
  .string()
  .min(1)
  .optional()
  .catch(undefined);

/** A finite number, or `undefined` when the field is missing or not a number. */
export const optionalNumber = z.number().optional().catch(undefined);

/**
 * Parses each element on its own and drops the ones that fail, so one
 * malformed entry does not discard a whole third-party payload. A value that
 * is not an array becomes `undefined`.
 */
export function lenientArray<T extends z.ZodType>(item: T) {
  return z.unknown().transform((value): z.output<T>[] | undefined =>
    Array.isArray(value)
      ? value.flatMap((entry) => {
          const parsed = item.safeParse(entry);

          return parsed.success ? [parsed.data] : [];
        })
      : undefined,
  );
}

/** A lexicon `datetime` string. */
export type DatetimeString = NonNullable<PlayRecord["playedTime"]>;

/** Formats a date as a lexicon `datetime` string. */
export function toDatetimeString(date: Date): DatetimeString {
  // SAFETY: Date#toISOString() always returns YYYY-MM-DDTHH:mm:ss.sssZ, which
  // matches the DatetimeString template; invalid dates throw a RangeError.
  return date.toISOString() as DatetimeString;
}
