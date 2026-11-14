/**
 * Picks search params as optional strings, for routes whose links come from the
 * shared href helpers. Call it inside an inline `validateSearch` arrow so the
 * router can infer the result type.
 */
export function pickStrings<K extends string>(search: Record<string, unknown>, ...keys: K[]): { [P in K]?: string } {
  const out: { [P in K]?: string } = {};
  for (const key of keys) {
    const value = search[key];
    if (typeof value === "string" && value) out[key] = value;
    else if (typeof value === "number") out[key] = String(value);
  }
  return out;
}
