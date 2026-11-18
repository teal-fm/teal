/** The first value of a route param, which Expo Router gives as a string or an array. */
export function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** A route param limited to `values`, or `fallback` when it's missing or unknown. */
export function paramOneOf<const T extends string>(
  value: string | string[] | undefined,
  values: readonly T[],
  fallback: T,
): T {
  const first = param(value);

  return values.find((option) => option === first) ?? fallback;
}
