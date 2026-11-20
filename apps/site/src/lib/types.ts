/** Shapes from the fm.teal.site.* queries in happyview/lexicons. */

export const PERIODS = ["day", "week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

export function periodOf(value: unknown, fallback: Period): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : fallback;
}

export interface Play {
  uri: string;
  did: string;
  trackName: string;
  artists: string[];
  /** Each artist's MusicBrainz ID, in the same order; "" for an unlinked one. Absent when none are linked. */
  artistMbIds?: string[];
  releaseName?: string;
  releaseMbId?: string;
  recordingMbId?: string;
  isrc?: string;
  duration?: number;
  playedTime?: string;
  originUrl?: string;
  musicService?: string;
  client?: string;
}

export interface ArtistStat {
  name: string;
  plays: number;
  listeners?: number;
}

export interface TrackStat {
  trackName: string;
  artist?: string;
  releaseMbId?: string;
  plays: number;
  listeners?: number;
}

export interface ReleaseStat {
  releaseName: string;
  artist?: string;
  releaseMbId?: string;
  plays: number;
}

export interface Leaderboard {
  period: Period;
  plays: number;
  listenerCount: number;
  listeners: { did: string; plays: number }[];
  artists: ArtistStat[];
  tracks: TrackStat[];
  computedAt?: string;
  /** Older than its period's refresh interval; a rebuild follows in the background. */
  stale?: boolean;
}

export interface ActorStats {
  did: string;
  period: Period;
  totalPlays: number;
  plays: number;
  artists: ArtistStat[];
  tracks: TrackStat[];
  releases: ReleaseStat[];
}

export interface PlaysPage {
  plays: Play[];
  cursor?: string;
}

/** Who someone is, as Bluesky (or failing that, their DID document) knows them. */
export interface Profile {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

export type Profiles = Record<string, Profile>;
