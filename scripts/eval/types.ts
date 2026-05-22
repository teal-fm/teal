/**
 * Shared types, constants, and helpers for the evaluation harness.
 */

// ── Constants ──────────────────────────────────────────────────────────

export const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
export const USER_AGENT = "tealtracker/0.0.1 (https://github.com/teal-fm/teal)";
// 1 second between MusicBrainz API calls (default).
// Honors MB_RATE_LIMIT_MS env var -- set to 0 when using a rotating proxy.
export const RATE_LIMIT_DELAY = (() => {
  if (typeof process !== "undefined" && process.env?.MB_RATE_LIMIT_MS != null) {
    const v = parseInt(process.env.MB_RATE_LIMIT_MS, 10);
    return Number.isFinite(v) && v >= 0 ? v : 1000;
  }
  return 1000;
})();

// ── Interfaces ─────────────────────────────────────────────────────────

export interface CachedScrobble {
  track: string;
  artist: string;
  album?: string;
  mbid: string | null;
  mbid_source: MBIDSource | null;
  timestamp: string; // ISO timestamp from Last.fm
}

export interface ScrobbleCache {
  timestamp: string;
  username: string;
  scrobbles: CachedScrobble[];
}

export interface LastFMTrack {
  name: string;
  artist: { "#text": string; mbid?: string };
  album?: { "#text": string };
  mbid?: string;
  "@attr"?: { nowplaying?: string };
  date?: { "#text": string; uts: string };
}

export interface LastFMResponse {
  recenttracks: {
    track: LastFMTrack | LastFMTrack[];
    "@attr": {
      total: string;
      page: string;
      perPage: string;
      totalPages: string;
    };
  };
}

export interface SearchResult {
  id: string;
  title: string;
  score?: number; // MB API relevance score (0-100)
  disambiguation?: string;
  "first-release-date"?: string;
  "artist-credit"?: Array<{
    artist: { id: string; name: string };
    name: string;
  }>;
  releases?: Array<{
    title: string;
    id: string;
    status?: string;
    date?: string;
  }>;
}

export interface SearchConfig {
  enableCleaning: boolean;
  enableFuzzy: boolean;
  enableMultiStage: boolean;
}

export interface APIMetrics {
  musicbrainzCalls: number;
  musicbrainzRateLimits: number;
  musicbrainzErrors: number;
  lastfmCalls: number;
  lastfmErrors: number;
  totalAPICallTime: number; // milliseconds
}

export interface EvaluationCase {
  track: string;
  artist: string;
  album?: string;
  mbid: string;
  baselinePos: number; // -1 if not found
  improvedPos: number; // -1 if not found
  baselineFound: boolean;
  improvedFound: boolean;
  baselineNDCG: number;
  improvedNDCG: number;
  failureMode?: string;
  duplicateCount?: number;
  fieldCombination?: string;
  hardness?: "easy" | "medium" | "hard";
  baselineCacheHit?: boolean;
  improvedCacheHit?: boolean;
  workEquivalentPos: number;
  workEquivalentSource: "baseline" | "improved" | null;
  apiCallsImproved: number;
  improvedTopIds?: string[];
  baselineTopIds?: string[];
}

/**
 * Provenance of an MBID -- tracks how the MBID was obtained to prevent
 * ground-truth circularity. Only "lastfm_track_info", "track_data", and
 * "listenbrainz_acr" are safe to use as evaluation ground truth; the
 * others are derived from the same MusicBrainz search we are evaluating.
 */
export type MBIDSource =
  | "lastfm_track_info"     // From Last.fm track.getInfo API (independent ground truth)
  | "lastfm_search"         // From Last.fm track.search API (semi-independent)
  | "musicbrainz_search"    // From MusicBrainz recording search (CIRCULAR -- not ground truth)
  | "listenbrainz_acr"      // From ListenBrainz ACR lookup (independent canonical mapping)
  | "track_data";           // From Last.fm scrobble's own .mbid field (independent)

/** Ground-truth-safe MBID sources (independent of MB search). */
export const GROUND_TRUTH_SOURCES: ReadonlySet<MBIDSource> = new Set([
  "lastfm_track_info",
  "lastfm_search",
  "listenbrainz_acr",
  "track_data",
]);

export interface MBIDResult {
  mbid: string | null;
  source: MBIDSource | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Format milliseconds as human-readable duration. */
export function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Estimate time remaining given elapsed time and progress. */
export function calculateETA(
  elapsed: number,
  completed: number,
  total: number,
): string {
  if (completed === 0 || completed >= total) return "0s";
  const avgTimePerItem = elapsed / completed;
  const remaining = total - completed;
  return formatTime(avgTimePerItem * remaining);
}

/** Create a fresh APIMetrics object. */
export function createAPIMetrics(): APIMetrics {
  return {
    musicbrainzCalls: 0,
    musicbrainzRateLimits: 0,
    musicbrainzErrors: 0,
    lastfmCalls: 0,
    lastfmErrors: 0,
    totalAPICallTime: 0,
  };
}
