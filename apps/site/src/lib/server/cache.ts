const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

function fresh(key: string, now: number) {
  const hit = entries.get(key);

  return hit && hit.expires > now ? hit.value : undefined;
}

function remember(
  key: string,
  ttl: number,
  value: Promise<unknown>,
  now: number,
) {
  if (entries.size > 5000) {
    for (const [k, entry] of entries)
      if (entry.expires <= now) entries.delete(k);
  }
  entries.set(key, { expires: now + ttl * 1000, value });
  value.catch(() => entries.delete(key));
}

/**
 * Remembers a lookup for `ttl` seconds in this worker isolate, sharing the
 * in-flight promise so concurrent requests make one upstream call. Failures
 * aren't kept.
 */
export function cached<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = fresh(key, now);
  if (hit) return hit as Promise<T>;

  const value = load();
  remember(key, ttl, value, now);

  return value;
}

/** Like `cached`, for lookups that batch: loads every missing key in one call. */
export async function cachedMany<T>(
  prefix: string,
  keys: string[],
  ttl: number,
  load: (missing: string[]) => Promise<Record<string, T>>,
): Promise<Record<string, T | undefined>> {
  const now = Date.now();
  const missing = keys.filter((key) => !fresh(`${prefix}:${key}`, now));
  if (missing.length > 0) {
    const batch = load(missing);
    for (const key of missing)
      remember(
        `${prefix}:${key}`,
        ttl,
        batch.then((found) => found[key]),
        now,
      );
  }
  const values = await Promise.all(
    keys.map((key) => fresh(`${prefix}:${key}`, now) as Promise<T | undefined>),
  );

  return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
}
