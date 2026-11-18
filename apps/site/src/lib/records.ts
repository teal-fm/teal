/** Reading teal records, which clients write loosely. */

export const str = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Mirrors artists_of in happyview/scripts/prelude.lua. */
export function artistsOf(record: Record<string, unknown>): string[] {
  const names = Array.isArray(record.artists)
    ? record.artists
        .map((artist) =>
          isObject(artist)
            ? (str(artist.artistName) ?? str(artist.name))
            : undefined,
        )
        .filter((name): name is string => name !== undefined)
    : [];
  if (names.length > 0) return names;

  return Array.isArray(record.artistNames)
    ? record.artistNames.filter((name): name is string => !!str(name))
    : [];
}
