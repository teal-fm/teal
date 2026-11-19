/** Reading teal records, which clients write loosely. */

import type { Play } from "./types";

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

/**
 * Unix milliseconds for playedTime, read like play.lua does: ISO 8601 with or
 * without a zone (none means UTC) or a Unix number. Undefined when it's
 * neither.
 */
export function playedAt(value: unknown): number | undefined {
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(str(value) ?? "")) {
    const n = Number(value);
    return n > 1e11 ? n : n * 1000;
  }
  const text = str(value);
  if (!text) return undefined;
  const zoned = /([zZ]|[+-]\d\d:?\d\d)\s*$/.test(text) ? text : `${text}Z`;
  const time = Date.parse(zoned);

  return Number.isNaN(time) ? undefined : time;
}

/**
 * A play record as the site shows it. Mirrors play_of in
 * happyview/scripts/prelude.lua; `fallbackTime` (Unix ms) stands in for a
 * playedTime that can't be read.
 */
export function playOf(
  uri: string,
  did: string,
  record: Record<string, unknown>,
  fallbackTime?: number,
): Play {
  const time = playedAt(record.playedTime) ?? fallbackTime;

  return {
    uri,
    did,
    trackName: str(record.trackName) ?? "Untitled",
    artists: artistsOf(record),
    releaseName: str(record.releaseName),
    releaseMbId: str(record.releaseMbId),
    recordingMbId: str(record.recordingMbId),
    duration:
      typeof record.duration === "number"
        ? Math.floor(record.duration)
        : undefined,
    playedTime: time === undefined ? undefined : new Date(time).toISOString(),
    originUrl: str(record.originUri) ?? str(record.originUrl),
    musicService:
      str(record.musicServiceUri) ?? str(record.musicServiceBaseDomain),
    client: str(record.submissionClientAgent),
  };
}

const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";

/** When a TID record key was minted (Unix ms); undefined for other keys. */
export function tidTime(rkey: string): number | undefined {
  if (!/^[2-7a-z]{13}$/.test(rkey)) return undefined;
  let n = 0n;
  for (const char of rkey) n = n * 32n + BigInt(TID_ALPHABET.indexOf(char));

  return Number((n >> 10n) / 1000n);
}

/** The parts of an at:// URI. */
export function parseAtUri(uri: string) {
  const [did, collection, rkey] = uri.replace(/^at:\/\//, "").split("/");

  return { did, collection, rkey };
}
