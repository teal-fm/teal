/**
 * Search functions for the evaluation harness.
 *
 * Baseline: raw Lucene query (matches the old searchMusicbrainz in oldStamp.tsx).
 * Improved: mirrors the production searchOrchestrator pipeline but wraps each
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
} from "./types.js";
import type { LastFMCache } from "./evaluate-lastfm-cache.js";
import {
  cleanTrackName,
  cleanArtistName,
  cleanReleaseName,
  normalizeForComparison,
} from "../../apps/amethyst/lib/musicbrainzCleaner.js";
import {
  escapeLucene,
  searchStage,
  hasCJK,
  resolveArtistAlias,
  PARTIAL_THRESHOLD,
} from "../../apps/amethyst/lib/musicbrainzSearchUtils.js";
import {
  rankMultiStageResults,
  type RankingQuery,
} from "../../apps/amethyst/lib/musicbrainzRanking.js";

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

      const data = await res.json();
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
  cache?: LastFMCache,
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

/**
 * Check if exact search results are "good enough" to skip later stages.
 * Mirrors production exactResultsSufficient in searchOrchestrator.ts.
 */
function exactResultsSufficient(
  results: SearchResult[],
  cleanedTrack: string | undefined,
  hasArtist: boolean,
): boolean {
  if (results.length === 0) return false;

  const topScore = results[0]?.score ?? 100;

  if (hasArtist) {
    return topScore >= 70 || results.length >= 3;
  }

  if (results.length >= 2) return true;
  const first = results[0];
  if (first?.title && cleanedTrack) {
    const norm = normalizeForComparison(first.title);
    const trackNorm = normalizeForComparison(cleanedTrack);
    return norm === trackNorm || norm.startsWith(trackNorm + " ");
  }
  return false;
}

/**
 * Improved search matching production orchestrator (searchOrchestrator.ts).
 *
 * Pipeline: clean -> exact (fallback to original if 0) -> fuzzy -> track-only
 * Expected API calls: 1 (best), 2 (typical miss), 3 (worst)
 */
export async function improvedSearchWithConfig(
  track: string,
  artist: string,
  release: string | undefined,
  config: SearchConfig,
  cache?: LastFMCache,
  apiMetrics?: APIMetrics,
): Promise<SearchResult[]> {
  let cleanedTrack: string | undefined;
  let cleanedArtist: string | undefined;
  let cleanedRelease: string | undefined;

  if (config.enableCleaning) {
    cleanedTrack = track ? cleanTrackName(track) || undefined : undefined;
    cleanedArtist = artist ? cleanArtistName(artist) || undefined : undefined;
    cleanedRelease = release ? cleanReleaseName(release) || undefined : undefined;
  } else {
    cleanedTrack = track || undefined;
    cleanedArtist = artist || undefined;
    cleanedRelease = release || undefined;
  }

  const cleaningChangedTrack = cleanedTrack !== undefined && cleanedTrack !== track;
  const cleaningChangedArtist = cleanedArtist !== undefined && cleanedArtist !== artist;

  // Stage 1a: Exact match WITH release (if available).
  // Narrows to specific recording on that album -- critical for popular tracks.
  let exactWithRelease: SearchResult[] = [];
  if (cleanedRelease) {
    exactWithRelease = await cachedSearchStage(
      cleanedTrack, cleanedArtist, cleanedRelease, "exact", cache, apiMetrics,
    );
  }

  // Stage 1b: Exact match WITHOUT release.
  // Skip if 1a already got sufficient results (saves 1 API call in the common case).
  // Still run if 1a got 0 results (release name might differ between scrobbler and MB).
  let exactWithoutRelease: SearchResult[] = [];
  if (!exactResultsSufficient(exactWithRelease, cleanedTrack, !!cleanedArtist)) {
    exactWithoutRelease = await cachedSearchStage(
      cleanedTrack, cleanedArtist, undefined, "exact", cache, apiMetrics,
    );
  }

  // Stage 1c: If cleaning changed names and both stages got 0, retry with originals
  let originalExactResults: SearchResult[] = [];
  if (exactWithRelease.length === 0 && exactWithoutRelease.length === 0 &&
      (cleaningChangedTrack || cleaningChangedArtist)) {
    originalExactResults = await cachedSearchStage(
      track || undefined, artist || undefined, undefined,
      "exact", cache, apiMetrics,
    );
  }

  // Stage 1d: CJK artist alias resolution (mirrors searchOrchestrator.ts)
  let cjkAliasResults: SearchResult[] = [];
  const artistForSearch = cleanedArtist || artist;
  if (
    exactWithRelease.length === 0 &&
    exactWithoutRelease.length === 0 &&
    originalExactResults.length === 0 &&
    artistForSearch &&
    hasCJK(artistForSearch)
  ) {
    const romanized = await resolveArtistAlias(artistForSearch);
    if (romanized && romanized !== artistForSearch) {
      cjkAliasResults = await cachedSearchStage(
        cleanedTrack, romanized, cleanedRelease || undefined,
        "exact", cache, apiMetrics,
      );
    }
  }

  const combinedExact = [
    ...exactWithRelease, ...exactWithoutRelease,
    ...originalExactResults, ...cjkAliasResults,
  ];
  const hasArtist = !!cleanedArtist;

  // Early exit: good exact results -> rank (matches production behavior)
  const sufficient = exactResultsSufficient(
    combinedExact,
    cleanedTrack,
    hasArtist,
  );
  if (sufficient) {
    // Rank even on early exit (matches production searchOrchestrator behavior).
    // Ranking applies variant matching, release quality, and text-match boosts
    // that can improve on MB's default Lucene ordering.
    const rankingQuery: RankingQuery = {
      track,
      artist,
      release,
      cleanedTrack: config.enableCleaning ? cleanedTrack : undefined,
      cleanedArtist: config.enableCleaning ? cleanedArtist : undefined,
      cleanedRelease: config.enableCleaning ? cleanedRelease : undefined,
    };
    return rankMultiStageResults(
      [{ results: combinedExact, strategy: "exact" as const }],
      rankingQuery,
    ).slice(0, 25);
  }

  const needsMoreStages =
    combinedExact.length === 0 ||
    (!hasArtist && combinedExact.length === 1);

  // Stage 2: Fuzzy match (no release constraint)
  let fuzzyResults: SearchResult[] = [];
  if (needsMoreStages && config.enableMultiStage && config.enableFuzzy && (cleanedTrack || cleanedArtist)) {
    fuzzyResults = await cachedSearchStage(
      cleanedTrack, cleanedArtist, undefined, "fuzzy", cache, apiMetrics,
    );
  }

  // Stage 3: Track-only fallback (drops artist constraint)
  let trackOnlyResults: SearchResult[] = [];
  const totalSoFar = combinedExact.length + fuzzyResults.length;
  if (needsMoreStages && config.enableMultiStage && totalSoFar < PARTIAL_THRESHOLD && track && artist) {
    trackOnlyResults = await cachedSearchStage(
      cleanedTrack ?? (track || undefined), undefined,
      undefined, "exact", cache, apiMetrics,
    );
  }

  // Rank and combine all stages
  const stageResultsForRanking = [
    { results: exactWithRelease, strategy: "exact" as const },
    { results: exactWithoutRelease, strategy: "exact" as const },
    { results: originalExactResults, strategy: "exact" as const },
    { results: cjkAliasResults, strategy: "exact" as const },
    { results: fuzzyResults, strategy: "fuzzy" as const },
    { results: trackOnlyResults, strategy: "exact" as const },
  ].filter((stage) => stage.results.length > 0);

  let finalResults: SearchResult[];
  if (stageResultsForRanking.length > 0) {
    const rankingQuery: RankingQuery = {
      track,
      artist,
      release,
      cleanedTrack: config.enableCleaning ? cleanedTrack : undefined,
      cleanedArtist: config.enableCleaning ? cleanedArtist : undefined,
      cleanedRelease: config.enableCleaning ? cleanedRelease : undefined,
    };
    finalResults = rankMultiStageResults(stageResultsForRanking, rankingQuery);
  } else {
    finalResults = [];
  }

  return finalResults.slice(0, 25);
}
