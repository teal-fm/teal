import type { AlbumSummary } from "@teal/lexicons/src/fm/teal/music/defs";

import type { ArtistListenerPeriod } from "./api";

export const LISTENER_PERIODS: readonly { label: string; value: ArtistListenerPeriod }[] = [
  { label: "All time", value: "all" },
  { label: "30 days", value: "30days" },
  { label: "7 days", value: "7days" },
];

export function normalizeListenerPeriod(value?: string): ArtistListenerPeriod {
  return value === "30days" || value === "7days" ? value : "all";
}

/** An artist's releases split the way record shops do: albums, EPs, singles, everything else. */
export function discography(all: readonly AlbumSummary[]) {
  // The index can list one MBID under two names (an album and its single); show it once.
  const seen = new Set<string>();
  const releases = all.filter((r) => !seen.has(r.mbid) && seen.add(r.mbid));
  const of = (test: (type?: string) => boolean) => releases.filter((r) => test(r.releaseType));
  return [
    { title: "Albums", releases: of((t) => t === "album") },
    { title: "EPs", releases: of((t) => t === "ep") },
    { title: "Singles", releases: of((t) => t === "single") },
    { title: "Other releases", releases: of((t) => t !== "album" && t !== "ep" && t !== "single") },
  ].filter((group) => group.releases.length > 0);
}

export function countLabel(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}
