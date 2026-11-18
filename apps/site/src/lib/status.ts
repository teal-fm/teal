import { artistsOf, isObject, str } from "./records";

/**
 * fm.teal.actor.status: what someone is playing right now, one record at
 * rkey "self". Some people still write the alpha collection, so the newer of
 * the two wins.
 */
export const STATUS_COLLECTIONS = [
  "fm.teal.actor.status",
  "fm.teal.alpha.actor.status",
];

/** The lexicon's default when a status has no expiry. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;
/** Longer than any real track, so a status a client never cleared still ends. */
const MAX_TTL_MS = 3 * 60 * 60 * 1000;

export interface NowPlaying {
  collection: string;
  trackName: string;
  artists: string[];
  releaseName?: string;
  releaseMbId?: string;
  originUrl?: string;
  /** When the status was set, and when it stops being true (ISO 8601). */
  time: string;
  expiresAt: string;
}

/**
 * The status in a record, or undefined when it's empty or over. Clients clear
 * a status by writing an empty track or an expiry in the past.
 */
export function statusOf(
  collection: string,
  record: unknown,
  now = Date.now(),
): NowPlaying | undefined {
  if (!isObject(record) || !isObject(record.item)) return undefined;
  const item = record.item;
  const trackName = str(item.trackName);
  const time = Date.parse(str(record.time) ?? "");
  if (!trackName || Number.isNaN(time)) return undefined;

  const expiry = Date.parse(str(record.expiry) ?? "");
  const expiresAt = Math.min(
    Number.isNaN(expiry) ? time + DEFAULT_TTL_MS : expiry,
    time + MAX_TTL_MS,
  );
  if (expiresAt <= now) return undefined;

  return {
    collection,
    trackName,
    artists: artistsOf(item),
    releaseName: str(item.releaseName),
    releaseMbId: str(item.releaseMbId),
    originUrl: str(item.originUri) ?? str(item.originUrl),
    time: new Date(time).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/** The most recently set of some statuses. */
export function newest(
  statuses: (NowPlaying | undefined)[],
): NowPlaying | undefined {
  return statuses
    .filter((status): status is NowPlaying => status !== undefined)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
}
