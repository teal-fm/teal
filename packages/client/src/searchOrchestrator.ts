/**
 * Multi-stage MusicBrainz search orchestrator
 *
 * Pipeline: clean input -> exact search -> (fallback if needed) -> rank
 * Separated from UI code (oldStamp.tsx) for testability and clarity.
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
  MusicBrainzUnavailableError,
  searchStage,
  PARTIAL_THRESHOLD,
  hasCJK,
  resolveArtistAlias,
} from "./musicbrainzSearchUtils";
import {
  rankMultiStageResults,
  type RankingQuery,
} from "./musicbrainzRanking";

export interface SearchConfig {
  enableCleaning: boolean;
  enableFuzzy: boolean;
  enableMultiStage: boolean;
}

interface SearchProgress {
  signal?: AbortSignal;
  resolveAlias?: typeof resolveArtistAlias;
}

const appConfig: SearchConfig = {
  enableCleaning: true,
  enableFuzzy: true,
  enableMultiStage: true,
};

/**
 * Check if exact search results are "good enough" to skip later stages.
 *
 * Uses MB's own relevance score as a confidence signal:
 * - High MB score (>=70) with artist: sufficient
 * - Track-only: need >= 2 results OR first result must match well
 */
function exactResultsSufficient(
  results: MusicBrainzRecording[],
  cleanedTrack: string | undefined,
  hasArtist: boolean,
): boolean {
  if (results.length === 0) return false;

  if (hasArtist) {
    return results.some((r) => (r.score ?? 0) >= 70);
  }

  // Release-specific and unrestricted queries can return the same recording.
  if (new Set(results.map((r) => r.id)).size >= 2) return true;
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
export async function searchRecordings(
  searchParams: SearchParams,
  config: SearchConfig,
  request: typeof searchStage = searchStage,
  { signal, resolveAlias = resolveArtistAlias }: SearchProgress = {},
): Promise<MusicBrainzRecording[]> {
  const assertActive = () => {
    if (signal?.aborted) throw new Error("Search cancelled");
  };

  const lookup: typeof searchStage = async (track, artist, release, strategy) => {
    assertActive();

    const results = signal
      ? await request(track, artist, release, strategy, { signal })
      : await request(track, artist, release, strategy);

    assertActive();

    return results;
  };

  const { track, artist, release } = searchParams;

  if (!track && !artist && !release) return [];

  const cleanedTrack =
    track && config.enableCleaning ? cleanTrackName(track) || undefined : track;

  const cleanedArtist =
    artist && config.enableCleaning ? cleanArtistName(artist) || undefined : artist;

  const cleanedRelease =
    release && config.enableCleaning ? cleanReleaseName(release) || undefined : release;

  const rankingQuery: RankingQuery = config.enableCleaning
    ? { ...searchParams, cleanedTrack, cleanedArtist, cleanedRelease }
    : searchParams;

  const cleaningChangedTrack = cleanedTrack !== undefined && cleanedTrack !== track;
  const cleaningChangedArtist = cleanedArtist !== undefined && cleanedArtist !== artist;

  // Stage 1a: Exact match WITH release (if available).
  // When release matches, this narrows to the specific recording on that album,
  // which is critical for popular tracks with many recordings in MB.
  let exactWithRelease: MusicBrainzRecording[] = [];

  if (cleanedRelease) {
    exactWithRelease = await lookup(
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
    exactWithoutRelease = await lookup(
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
    originalExactResults = await lookup(
      track,
      artist,
      undefined,
      "exact",
    );
  }

  // Stage 1d: CJK artist alias resolution.
  // MB indexes artists by romanized name (e.g., "Joe Hisaishi"), but scrobblers
  // often submit CJK (e.g., "久石譲"). Resolve via MB artist alias search,
  // then re-search recordings with the romanized name.
  let cjkAliasResults: MusicBrainzRecording[] = [];
  const artistForSearch = cleanedArtist || artist;
  const exactBeforeAlias = [...exactWithRelease, ...exactWithoutRelease, ...originalExactResults];

  if (
    artistForSearch &&
    hasCJK(artistForSearch) &&
    (exactBeforeAlias.length === 0 ||
      (config.enableMultiStage && !exactResultsSufficient(exactBeforeAlias, cleanedTrack, !!cleanedArtist)))
  ) {
    assertActive();
    const romanized = await resolveAlias(artistForSearch, { signal });
    assertActive();

    if (romanized && romanized !== artistForSearch) {
      cjkAliasResults = await lookup(
        cleanedTrack,
        romanized,
        cleanedRelease || undefined,
        "exact",
      );
    }
  }

  const combinedExact = [...exactBeforeAlias, ...cjkAliasResults];

  // Early exit: good exact results -> skip later stages but still rank.
  // Ranking applies variant matching, release quality, and text-match boosts
  // that can improve on MB's default Lucene ordering.
  if (exactResultsSufficient(combinedExact, cleanedTrack, !!cleanedArtist)) {
    return rankMultiStageResults(
      [{ results: combinedExact, strategy: "exact" as const }],
      rankingQuery,
    ).slice(0, 25);
  }

  // Stage 2: Fuzzy match (typos, Unicode, word reordering)
  const needsMoreStages = combinedExact.length === 0 || (!cleanedArtist && combinedExact.length === 1);
  const useFuzzy = needsMoreStages && config.enableMultiStage && config.enableFuzzy && (cleanedTrack || cleanedArtist);
  let fuzzyResults: MusicBrainzRecording[] = [];

  if (useFuzzy) {
    fuzzyResults = await lookup(
      cleanedTrack,
      cleanedArtist,
      undefined,
      "fuzzy",
    );
  }

  // Stage 3: Track-only fallback (when artist name doesn't match MB's data)
  let trackOnlyResults: MusicBrainzRecording[] = [];
  const totalSoFar = new Set([...combinedExact, ...fuzzyResults].map((r) => r.id)).size;

  if (needsMoreStages && config.enableMultiStage && totalSoFar < PARTIAL_THRESHOLD && track && artist) {
    trackOnlyResults = await lookup(
      cleanedTrack ?? track,
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

  return rankMultiStageResults(stageResults, rankingQuery).slice(0, 25);
}

export async function searchMusicbrainz(
  params: SearchParams,
  { signal, throwOnError }: { signal?: AbortSignal; throwOnError?: boolean } = {},
): Promise<MusicBrainzRecording[]> {
  let unavailable: MusicBrainzUnavailableError | undefined;

  async function recover<T>(lookup: () => Promise<T>, empty: T): Promise<T> {
    try {
      return await lookup();
    } catch (error) {
      if (!(error instanceof MusicBrainzUnavailableError)) throw error;
      unavailable = error;

      return empty;
    }
  }

  try {
    const results = await searchRecordings(
      params,
      appConfig,
      (track, artist, release, strategy) => recover(
        () => searchStage(track, artist, release, strategy, { signal, failOnError: true }),
        [],
      ),
      {
        signal,
        resolveAlias: (name) => recover(
          () => resolveArtistAlias(name, { signal, failOnError: true }),
          null,
        ),
      },
    );

    if (results.length === 0 && unavailable) throw unavailable;

    return results;
  } catch (error) {
    if (throwOnError) throw error;

    if (!signal?.aborted) console.error("Failed to fetch MusicBrainz data:", error);

    return [];
  }
}
