import type { Profile } from "./types";

const numbers = new Intl.NumberFormat("en");

export const count = (n: number) => numbers.format(n);

export function plural(n: number, one: string, many = `${one}s`) {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** Cover Art Archive thumbnail for a release MBID, which plays write bare or as `mbid:<uuid>`. */
export function coverUrl(releaseMbId?: string, size: 250 | 500 = 250) {
  const id = releaseMbId?.replace(/^mbid:/, "");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return undefined;

  return `https://coverartarchive.org/release/${id}/front-${size}`;
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
