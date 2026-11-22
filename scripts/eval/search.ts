/**
 * Search functions for the evaluation harness.
 *
 * Baseline: raw Lucene query (matches the old searchMusicbrainz in oldStamp.tsx).
 * Improved: runs the production pipeline and wraps each
 * search stage with a SQLite cache layer (cachedSearchStage) so that MB API
 * responses persist across eval runs. The production code only has an in-memory
 * 5-min cache, which is fine for interactive use but not for repeatable evaluation.
 */

import {
  MUSICBRAINZ_BASE_URL,
  USER_AGENT,
  RATE_LIMIT_DELAY,
  type SearchResult,
  type SearchConfig,
  type APIMetrics,
} from "./types";
import type { LastFMCache } from "./evaluate-lastfm-cache.js";
import { escapeLucene, searchStage } from "../../apps/amethyst/lib/musicbrainzSearchUtils";
import { searchRecordings } from "../../apps/amethyst/lib/searchOrchestrator";

type StageCache = Pick<LastFMCache, "getSearchResults" | "setSearchResults">;

/**
 * Baseline search (original "funny search string").
 *
 * Uses escapeLucene() for safety (prevents query injection), making baseline
 * slightly better than the true original, but this is a correctness fix.
 */
export async function baselineSearch(
  track: string,
  artist: string,
  release: string | undefined,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<SearchResult[]> {
  if (cache) {
    const cached = cache.getSearchResults(track, artist, release, false, false, false);
    if (cached !== null) return cached;
  }

  const queryParts: string[] = [];
  if (track) queryParts.push(`title:"${escapeLucene(track)}"`);
  if (artist) queryParts.push(`artist:"${escapeLucene(artist)}"`);
  if (release) queryParts.push(`release:"${escapeLucene(release)}"`);

  if (queryParts.length === 0) return [];

  const query = queryParts.join(" AND ");
  const url = `${MUSICBRAINZ_BASE_URL}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=25`;

  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const apiCallStart = Date.now();
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      const apiCallTime = Date.now() - apiCallStart;

      if (apiMetrics) {
        apiMetrics.musicbrainzCalls++;
        apiMetrics.totalAPICallTime += apiCallTime;
      }

      if (res.status === 503) {
        if (apiMetrics) apiMetrics.musicbrainzRateLimits++;
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        const results: SearchResult[] = [];
        if (cache) cache.setSearchResults(track, artist, release, results, false, false, false);
        return results;
      }

      if (!res.ok) {
        if (apiMetrics) apiMetrics.musicbrainzErrors++;
        const results: SearchResult[] = [];
        if (cache) cache.setSearchResults(track, artist, release, results, false, false, false);
        return results;
      }

      const data = (await res.json()) as { recordings?: SearchResult[] };
      const rawResults = data.recordings || [];
      const results = rawResults.filter(
        (r: SearchResult): r is SearchResult & { id: string } => !!r.id,
      );
      if (cache) cache.setSearchResults(track, artist, release, results, false, false, false);
      return results;
    } catch (error) {
      if (apiMetrics) apiMetrics.musicbrainzErrors++;
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      const results: SearchResult[] = [];
      if (cache) cache.setSearchResults(track, artist, release, results, false, false, false);
      return results;
    }
  }

  const results: SearchResult[] = [];
  if (cache) cache.setSearchResults(track, artist, release, results, false, false, false);
  return results;
}

/**
 * Cache-aware search stage for the eval harness.
 * Checks SQLite cache before calling the real searchStage (which only has
 * an in-memory 5-min cache). Stores results back for cross-run reuse.
 * The mb_search_cache is keyed by (track, artist, album, strategy) and
 * never invalidated -- raw MB API responses don't change with our code.
 */
async function cachedSearchStage(
  track: string | undefined,
  artist: string | undefined,
  release: string | undefined,
  strategy: "exact" | "fuzzy" | "partial",
  cache?: StageCache,
  apiMetrics?: APIMetrics,
): Promise<SearchResult[]> {
  // Check SQLite cache first
  if (cache) {
    const cached = cache.getSearchResults(
      track ?? "", artist ?? "", release, false, false, false, strategy,
    );
    if (cached !== null) return cached.filter(
      (r: SearchResult): r is SearchResult & { id: string } => !!r.id,
    );
  }

  const stageStart = Date.now();
  const raw = (await searchStage(track, artist, release, strategy)) as SearchResult[];
  if (apiMetrics && (track || artist || release)) {
    apiMetrics.musicbrainzCalls++;
    apiMetrics.totalAPICallTime += Date.now() - stageStart;
  }
  const results = raw.filter(
    (r): r is SearchResult & { id: string } => !!r.id,
  );

  // Store in SQLite for cross-run reuse
  if (cache) {
    cache.setSearchResults(
      track ?? "", artist ?? "", release, results, false, false, false, strategy,
    );
  }

  return results;
}

export function improvedSearchWithConfig(
  track: string,
  artist: string,
  release: string | undefined,
  config: SearchConfig,
  cache?: StageCache,
  apiMetrics?: APIMetrics,
): Promise<SearchResult[]> {
  return searchRecordings(
    { track: track || undefined, artist: artist || undefined, release: release || undefined },
    config,
    (track, artist, release, strategy) =>
      cachedSearchStage(track, artist, release, strategy, cache, apiMetrics),
  );
}
