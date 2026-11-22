import { type SearchResult, type SearchConfig, type APIMetrics } from "./types";
import type { LastFMCache } from "./evaluate-lastfm-cache.js";
import {
  escapeLucene,
  fetchMusicBrainzRecordings,
  MusicBrainzUnavailableError,
  resolveArtistAlias,
  searchStage,
} from "../../apps/amethyst/lib/musicbrainzSearchUtils";
import { searchRecordings } from "../../apps/amethyst/lib/searchOrchestrator";

type StageCache = Pick<LastFMCache, "getSearchResults" | "setSearchResults">;

// Count the actual fetches for both recording and artist requests, including retries.
function measuredFetch(metrics?: APIMetrics, onRequest?: () => void): typeof fetch {
  return async (input, init) => {
    const started = Date.now();
    onRequest?.();
    if (metrics) metrics.musicbrainzCalls++;
    try {
      const signal = init?.signal ?? (
        "timeout" in AbortSignal && typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(15_000)
          : undefined
      );
      const res = await fetch(input, { ...init, signal });
      if (metrics && !res.ok) {
        if (res.status === 429 || res.status === 503) metrics.musicbrainzRateLimits++;
        else metrics.musicbrainzErrors++;
      }
      return res;
    } catch (error) {
      if (metrics) metrics.musicbrainzErrors++;
      throw error;
    } finally {
      if (metrics) metrics.totalAPICallTime += Date.now() - started;
    }
  };
}

export async function baselineSearch(
  track: string,
  artist: string,
  release: string | undefined,
  cache?: StageCache,
  apiMetrics?: APIMetrics,
): Promise<SearchResult[]> {
  const cached = cache?.getSearchResults(track, artist, release);
  if (cached != null) return cached;

  const queryParts: string[] = [];
  if (track) queryParts.push(`title:"${escapeLucene(track)}"`);
  if (artist) queryParts.push(`artist:"${escapeLucene(artist)}"`);
  if (release) queryParts.push(`release:"${escapeLucene(release)}"`);
  if (queryParts.length === 0) return [];

  const results = await fetchMusicBrainzRecordings(queryParts.join(" AND "), {
    fetcher: measuredFetch(apiMetrics),
    failOnError: true,
  });
  if (results === null) throw new MusicBrainzUnavailableError("MusicBrainz recording search was canceled");
  cache?.setSearchResults(track, artist, release, results);
  return results;
}

async function cachedSearchStage(
  track: string | undefined,
  artist: string | undefined,
  release: string | undefined,
  strategy: "exact" | "fuzzy" | "partial",
  cache: StageCache | undefined,
  fetcher: typeof fetch,
): Promise<SearchResult[]> {
  const cached = cache?.getSearchResults(
    track ?? "", artist ?? "", release, false, false, false, strategy,
  );
  if (cached != null) return cached;

  const results = await searchStage(track, artist, release, strategy, { fetcher, failOnError: true });
  cache?.setSearchResults(
    track ?? "", artist ?? "", release, results, false, false, false, strategy,
  );
  return results;
}

export function improvedSearchWithConfig(
  track: string,
  artist: string,
  release: string | undefined,
  config: SearchConfig,
  cache?: StageCache,
  apiMetrics?: APIMetrics,
  onRequest?: () => void,
): Promise<SearchResult[]> {
  const fetcher = measuredFetch(apiMetrics, onRequest);
  return searchRecordings(
    { track: track || undefined, artist: artist || undefined, release: release || undefined },
    config,
    (track, artist, release, strategy) =>
      cachedSearchStage(track, artist, release, strategy, cache, fetcher),
    { resolveAlias: (name) => resolveArtistAlias(name, { fetcher, failOnError: true }) },
  );
}

export async function compareSearches(
  track: string,
  artist: string,
  release: string | undefined,
  config: SearchConfig,
  cache?: StageCache,
  apiMetrics?: APIMetrics,
) {
  const baselineCacheHit = cache?.getSearchResults(track, artist, release) != null;
  let apiCallsImproved = 0;
  try {
    const baselineRes = await baselineSearch(track, artist, release, cache, apiMetrics);
    const improvedRes = await improvedSearchWithConfig(track, artist, release, config, cache, apiMetrics, () => {
      apiCallsImproved++;
    });
    return { status: "scored" as const, baselineRes, improvedRes, baselineCacheHit, apiCallsImproved };
  } catch (error) {
    if (!(error instanceof MusicBrainzUnavailableError)) throw error;
    return { status: "unavailable" as const, reason: error.message };
  }
}
