import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import {
  getUserTopArtists,
  getUserTopRecordings,
  getUserTopReleases,
  type StatsPeriod,
} from "./api";
import { indexedStatContext } from "./profileStats";
import { musicAlbumHref, musicArtistHref } from "./routes";

export type TopKind = "artists" | "albums" | "tracks";

export const STATS_PERIODS: readonly { label: string; value: StatsPeriod }[] = [
  { label: "7 days", value: "7days" },
  { label: "30 days", value: "30days" },
  { label: "90 days", value: "90days" },
  { label: "180 days", value: "180days" },
  { label: "365 days", value: "365days" },
  { label: "All time", value: "all" },
];

const PERIODS = new Set(STATS_PERIODS.map((p) => p.value));

export function normalizePeriod(value: unknown): StatsPeriod {
  return typeof value === "string" && PERIODS.has(value as StatsPeriod) ? (value as StatsPeriod) : "90days";
}

export function periodLabel(period: StatsPeriod) {
  return STATS_PERIODS.find((p) => p.value === period)?.label ?? "90 days";
}

export function normalizeKind(value: unknown): TopKind {
  return value === "albums" || value === "tracks" ? value : "artists";
}

export type TopItem = {
  id: string;
  kind: TopKind;
  name: string;
  mbid?: string;
  playCount: number;
  /** The artist line for albums and tracks, when history knows it. */
  artist?: string;
  href?: string;
};

type Named = { mbid?: string; name?: string; playCount?: number };

const UNKNOWN: Record<TopKind, string> = {
  artists: "Unknown artist",
  albums: "Unknown album",
  tracks: "Unknown track",
};

function toItem(kind: TopKind) {
  return (item: Named, index: number): TopItem => ({
    id: item.mbid || `${item.name}-${index}`,
    kind,
    name: item.name || UNKNOWN[kind],
    mbid: item.mbid,
    playCount: item.playCount || 0,
  });
}

/** One page of someone's top artists, albums, or tracks for a period. */
export async function loadTop(actor: string, kind: TopKind, period: StatsPeriod, limit: number, cursor?: string) {
  if (kind === "artists") {
    const res = await getUserTopArtists(actor, period, limit, cursor);
    return { items: res.artists.map(toItem(kind)), cursor: res.cursor };
  }
  if (kind === "albums") {
    const res = await getUserTopReleases(actor, period, limit, cursor);
    return { items: res.releases.map(toItem(kind)), cursor: res.cursor };
  }
  const res = await getUserTopRecordings(actor, period, limit, cursor);
  return { items: res.recordings.map(toItem(kind)), cursor: res.cursor };
}

/** Where an item links. Tracks need history context (artist, release) to build a page link. */
export function withContext(item: TopItem, plays: PlayView[]): TopItem {
  if (item.kind === "artists") return { ...item, href: musicArtistHref(item.name, item.mbid) };
  const context = indexedStatContext(item.kind, item.mbid, plays);
  if (context) return { ...item, artist: context.artist, href: context.href };
  if (item.kind === "albums" && item.mbid) return { ...item, href: musicAlbumHref("music", item.name, item.mbid) };
  return item;
}

export function playsLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "play" : "plays"}`;
}

export function topStatsHref(actor: string, kind: TopKind, period: StatsPeriod) {
  return `/profile/${encodeURIComponent(actor)}/stats/${kind}?period=${period}`;
}
