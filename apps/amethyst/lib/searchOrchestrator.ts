/**
 * Multi-stage MusicBrainz search orchestrator
 *
 * Pipeline: clean input -> exact search -> (fallback if needed) -> rank
 * Separated from UI code (oldStamp.tsx) for testability and clarity.
 *
 * Expected API calls per lookup:
 *   Best case (track+artist, exact hit): 1-2 calls (with/without release)
 *   Cleaning diverged, exact hit:        2-3 calls
 *   Hard case (fuzzy fallback):           3-4 calls
 *
 * Rate limit: MusicBrainz requires max 1 request/second. We enforce this
 * at the fetch layer (musicbrainzSearchUtils.ts) so cache hits are instant.
 */

import type { MusicBrainzRecording, SearchParams } from "./oldStamp";
import {
  cleanArtistName,
  cleanTrackName,
  cleanReleaseName,
  normalizeForComparison,
} from "./musicbrainzCleaner";
import {
  searchStage,
  PARTIAL_THRESHOLD,
  hasCJK,
  resolveArtistAlias,
} from "./musicbrainzSearchUtils";
import {
  rankMultiStageResults,
  type RankingQuery,
} from "./musicbrainzRanking";

/**
 * Check if exact search results are "good enough" to skip later stages.
 *
 * Uses MB's own relevance score as a confidence signal:
 * - High MB score (>=70) with artist: sufficient
 * - >= 3 results with artist: sufficient (multiple candidates to rank)
 * - Track-only: need >= 2 results OR first result must match well
 */
function exactResultsSufficient(
  results: MusicBrainzRecording[],
  cleanedTrack: string | undefined,
  hasArtist: boolean,
): boolean {
  if (results.length === 0) return false;

  const topScore = results[0]?.score ?? 100;

  if (hasArtist) {
    return topScore >= 70 || results.length >= 3;
  }

  // Track-only: need >= 2 results OR first result must match well
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
 * Multi-stage MusicBrainz search with improved matching.
 *
 * Designed to minimize API calls: most lookups (track+artist, clean data)
 * early-exit after 1 call. Later stages only fire when results are insufficient.
 *
 * Stage 1a: Exact match with release (narrows to specific recording on album)
 * Stage 1b: Exact match without release (catches album-name mismatches)
 * Stage 1c: Retry with originals if cleaning changed names and stages got 0
 * Stage 2: Fuzzy match (typos, Unicode, word reordering) -- only if exact insufficient
 * Stage 3: Track-only fallback (drops artist) -- only if still sparse
 */
export async function searchMusicbrainz(
  searchParams: SearchParams,
): Promise<MusicBrainzRecording[]> {
  if (!searchParams.track && !searchParams.artist && !searchParams.release) {
    return [];
  }

  try {
    const cleanedTrack = searchParams.track
      ? cleanTrackName(searchParams.track) || undefined
      : undefined;
    const cleanedArtist = searchParams.artist
      ? cleanArtistName(searchParams.artist) || undefined
      : undefined;
    const cleanedRelease = searchParams.release
      ? cleanReleaseName(searchParams.release) || undefined
      : undefined;

    const cleaningChangedTrack =
      cleanedTrack !== undefined && cleanedTrack !== searchParams.track;
    const cleaningChangedArtist =
      cleanedArtist !== undefined && cleanedArtist !== searchParams.artist;

    // Stage 1a: Exact match WITH release (if available).
    // When release matches, this narrows to the specific recording on that album,
    // which is critical for popular tracks with many recordings in MB.
    let exactWithRelease: MusicBrainzRecording[] = [];
    if (cleanedRelease) {
      exactWithRelease = await searchStage(
        cleanedTrack,
        cleanedArtist,
        cleanedRelease,
        "exact",
      );
    }

    // Stage 1b: Exact match WITHOUT release.
    // Skip if 1a already got sufficient results (saves 1 API call in the common case).
    // Still run if 1a got 0 results (release name might differ between scrobbler and MB).
    let exactWithoutRelease: MusicBrainzRecording[] = [];
    if (!exactResultsSufficient(exactWithRelease, cleanedTrack, !!cleanedArtist)) {
      exactWithoutRelease = await searchStage(
        cleanedTrack,
        cleanedArtist,
        undefined,
        "exact",
      );
    }

    // Stage 1c: If cleaning changed names and both stages got 0, retry with originals.
    let originalExactResults: MusicBrainzRecording[] = [];
    if (exactWithRelease.length === 0 && exactWithoutRelease.length === 0 &&
        (cleaningChangedTrack || cleaningChangedArtist)) {
      originalExactResults = await searchStage(
        searchParams.track,
        searchParams.artist,
        undefined,
        "exact",
      );
    }

    // Stage 1d: CJK artist alias resolution.
    // MB indexes artists by romanized name (e.g., "Joe Hisaishi"), but scrobblers
    // often submit CJK (e.g., "久石譲"). Resolve via MB artist alias search,
    // then re-search recordings with the romanized name.
    let cjkAliasResults: MusicBrainzRecording[] = [];
    const artistForSearch = cleanedArtist || searchParams.artist;
    if (
      exactWithRelease.length === 0 &&
      exactWithoutRelease.length === 0 &&
      originalExactResults.length === 0 &&
      artistForSearch &&
      hasCJK(artistForSearch)
    ) {
      const romanized = await resolveArtistAlias(artistForSearch);
      if (romanized && romanized !== artistForSearch) {
        cjkAliasResults = await searchStage(
          cleanedTrack,
          romanized,
          cleanedRelease || undefined,
          "exact",
        );
      }
    }

    const combinedExact = [
      ...exactWithRelease,
      ...exactWithoutRelease,
      ...originalExactResults,
      ...cjkAliasResults,
    ];
    const hasArtist = !!cleanedArtist;

    // Early exit: good exact results -> skip later stages but still rank.
    // Ranking applies variant matching, release quality, and text-match boosts
    // that can improve on MB's default Lucene ordering.
    if (exactResultsSufficient(combinedExact, cleanedTrack, hasArtist)) {
      const rankingQuery: RankingQuery = {
        track: searchParams.track,
        artist: searchParams.artist,
        release: searchParams.release,
        cleanedTrack,
        cleanedArtist,
        cleanedRelease,
      };
      return rankMultiStageResults(
        [{ results: combinedExact, strategy: "exact" as const }],
        rankingQuery,
      ).slice(0, 25);
    }

    const needsMoreStages =
      combinedExact.length === 0 ||
      (!hasArtist && combinedExact.length === 1);

    // Stage 2: Fuzzy match (typos, Unicode, word reordering)
    let fuzzyResults: MusicBrainzRecording[] = [];
    if (needsMoreStages && (cleanedTrack || cleanedArtist)) {
      fuzzyResults = await searchStage(
        cleanedTrack,
        cleanedArtist,
        undefined,
        "fuzzy",
      );
    }

    // Stage 3: Track-only fallback (when artist name doesn't match MB's data)
    let trackOnlyResults: MusicBrainzRecording[] = [];
    const totalSoFar = combinedExact.length + fuzzyResults.length;
    if (needsMoreStages && totalSoFar < PARTIAL_THRESHOLD &&
        searchParams.track && searchParams.artist) {
      trackOnlyResults = await searchStage(
        cleanedTrack ?? searchParams.track,
        undefined,
        undefined,
        "exact",
      );
    }

    // Rank and combine all stages
    const stageResults = [
      { results: exactWithRelease, strategy: "exact" as const },
      { results: exactWithoutRelease, strategy: "exact" as const },
      { results: originalExactResults, strategy: "exact" as const },
      { results: cjkAliasResults, strategy: "exact" as const },
      { results: fuzzyResults, strategy: "fuzzy" as const },
      { results: trackOnlyResults, strategy: "exact" as const },
    ].filter((stage) => stage.results.length > 0);

    const rankingQuery: RankingQuery = {
      track: searchParams.track,
      artist: searchParams.artist,
      release: searchParams.release,
      cleanedTrack,
      cleanedArtist,
      cleanedRelease,
    };

    return rankMultiStageResults(stageResults, rankingQuery).slice(0, 25);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Failed to fetch MusicBrainz data:", error.message);
    } else {
      console.error("Failed to fetch MusicBrainz data:", error);
    }
    return [];
  }
}
