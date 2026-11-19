import type { Profile } from "./types";

const numbers = new Intl.NumberFormat("en");

export const count = (n: number) => numbers.format(n);

export function plural(n: number, one: string, many = `${one}s`) {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** A MusicBrainz ID, which plays write bare or as `mbid:<uuid>`; undefined when it isn't one. */
export function mbid(value?: string) {
  const id = value?.replace(/^mbid:/, "");

  return id && /^[0-9a-f-]{36}$/i.test(id) ? id.toLowerCase() : undefined;
}

/** Cover Art Archive thumbnail for a release MBID. */
export function coverUrl(releaseMbId?: string, size: 250 | 500 = 250) {
  const id = mbid(releaseMbId);

  return id && `https://coverartarchive.org/release/${id}/front-${size}`;
}

/** A track length in seconds as "3:07" or "1:02:45". */
export function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);

  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function profilePath(
  profile: Pick<Profile, "did" | "handle"> | undefined,
  did: string,
) {
  return profile?.handle ?? did;
}

export function displayName(profile: Profile | undefined, did: string) {
  return profile?.displayName?.trim() || profile?.handle || did;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];
const relative = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

export function timeAgo(iso?: string) {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) return "";
  const seconds = (Date.now() - time) / 1000;
  if (seconds < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (seconds >= size)
      return relative.format(-Math.floor(seconds / size), unit);
  }

  return "just now";
}
