/**
 * Shared utilities for MusicBrainz search
 * Used by both frontend (oldStamp.tsx) and evaluation scripts
 */

import type { MusicBrainzRecording } from "./oldStamp";

export type SearchStrategy = "exact" | "fuzzy" | "partial";

/**
 * Detect if a string contains CJK (Chinese/Japanese/Korean) characters.
 * Covers CJK Unified Ideographs, Hiragana, Katakana, Hangul, and extensions.
 */
export function hasCJK(text: string): boolean {
  return /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/.test(text);
}

/**
 * PARTIAL_THRESHOLD: minimum cumulative result count before skipping later stages.
 * Set to 5 to match typical UI display (top 5 results visible).
 * Can be overridden via process.env.PARTIAL_THRESHOLD for eval tuning.
 */
export const PARTIAL_THRESHOLD = (() => {
  if (typeof process !== "undefined" && process.env?.PARTIAL_THRESHOLD) {
    const parsed = parseInt(process.env.PARTIAL_THRESHOLD, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }
  return 5;
})();

export const PROXIMITY_DISTANCE = 3; // Words within 3 positions for proximity search
export const MAX_RETRIES = 3; // Maximum retry attempts for rate limiting
export const INITIAL_RETRY_DELAY = 1000; // Initial delay in milliseconds

/**
 * Escape Lucene special characters in search terms
 * Special chars: + - && || ! ( ) { } [ ] ^ " ~ * ? : \
 * 
 * Don't escape apostrophes (') and dashes (-) when inside quoted phrases.
 * MusicBrainz often stores names with apostrophes/dashes (e.g., "Dancin' Music", "V-Rally"),
 * and escaping them prevents matches. Inside quoted phrases, these are safe.
 * 
 * However, we still escape them for safety in unquoted contexts (partial search).
 */
export function escapeLucene(text: string): string {
  // Escape backslash first (must be first)
  let escaped = text.replace(/\\/g, "\\\\");
  
  // Escape Lucene operators (these are always problematic)
  escaped = escaped
    .replace(/\+/g, "\\+")
    .replace(/&&/g, "\\&&")
    .replace(/\|\|/g, "\\||")
    .replace(/!/g, "\\!")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\^/g, "\\^")
    .replace(/"/g, '\\"')
    .replace(/~/g, "\\~")
    .replace(/\*/g, "\\*")
    .replace(/\?/g, "\\?")
    .replace(/:/g, "\\:");
  
  // NOTE: We intentionally DON'T escape dashes (-) and apostrophes (')
  // when used in quoted phrases, as MusicBrainz often stores names with these characters.
  // For example: "Dancin' Music", "V-Rally", "Howl's Moving Castle"
  // Inside quoted phrases, these are safe and needed for matching.
  // 
  // If we need to escape them for unquoted contexts (partial search), we can add
  // a parameter to this function to control escaping behavior.
  
  return escaped;
}

/**
 * Build a single query part for a field (title, artist, release)
 * 
 * Strategies:
 * - exact: Quoted phrase (handles spaces, special chars)
 * - fuzzy: Proximity for multi-word, fuzzy operator for single word
 * - partial: Unquoted (allows substring matching, escapes operators)
 */
export function buildQueryPart(
  field: "title" | "artist" | "release",
  value: string,
  strategy: SearchStrategy,
): string {
  if (strategy === "exact") {
    let escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    return `${field}:"${escaped}"`;
  } else if (strategy === "fuzzy") {
    const escaped = escapeLucene(value);
    const words = value.split(/\s+/);
    if (words.length > 1) {
      return `${field}:"${escaped}"~${PROXIMITY_DISTANCE}`;
    } else {
      // Escape dashes for single-word fuzzy to prevent Lucene NOT operator
      // (e.g., "Jay-Z~" would be parsed as "Jay NOT Z~")
      let singleEscaped = escaped.replace(/-/g, "\\-");
      return `${field}:${singleEscaped}~`;
    }
  } else {
    // Partial: unquoted terms -- also escape dashes to avoid Lucene NOT operator
    // (e.g., "Jay-Z" would otherwise be parsed as "Jay NOT Z")
    let escaped = escapeLucene(value);
    escaped = escaped.replace(/-/g, "\\-");
    return `${field}:${escaped}`;
  }
}

// Rate limiting: MusicBrainz requires max 1 request/second.
// Override with MB_RATE_LIMIT_MS=0 when using a rotating proxy (e.g., eval harness).
const MB_RATE_LIMIT_MS = (() => {
  if (typeof process !== "undefined" && process.env?.MB_RATE_LIMIT_MS != null) {
    const v = parseInt(process.env.MB_RATE_LIMIT_MS, 10);
    return Number.isFinite(v) && v >= 0 ? v : 1100;
  }
  return 1100;
})();
let lastAPICallTime = -Infinity;

// In-memory cache for MusicBrainz search results.
// Avoids redundant API calls within a session (rate-limited to 1 req/sec).
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  results: MusicBrainzRecording[];
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry>();
const aliasCache = new Map<string, { value: string | null; timestamp: number }>();

function getCached(key: string): MusicBrainzRecording[] | undefined {
  const entry = searchCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return undefined;
  }
  return entry.results;
}

function setCache(key: string, results: MusicBrainzRecording[]): void {
  // Evict oldest entries when at capacity
  if (searchCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(key, { results, timestamp: Date.now() });
}

type MusicBrainzRequestOptions = {
  baseUrl?: string;
  userAgent?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  failOnError?: boolean;
};

export class MusicBrainzUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MusicBrainzUnavailableError";
  }
}

function unavailable(error: unknown): MusicBrainzUnavailableError {
  return error instanceof MusicBrainzUnavailableError
    ? error
    : new MusicBrainzUnavailableError(error instanceof Error ? error.message : "MusicBrainz request failed");
}

async function waitForRequestSlot(signal?: AbortSignal) {
  // Recheck after waking so parallel searches cannot take the same slot.
  while (!signal?.aborted) {
    const wait = MB_RATE_LIMIT_MS - (Date.now() - lastAPICallTime);
    if (wait <= 0) {
      lastAPICallTime = Date.now();
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  return false;
}

const DEFAULT_BASE_URL = "https://musicbrainz.org/ws/2";
const DEFAULT_USER_AGENT = "tealtracker/0.0.1 (https://github.com/teal-fm/teal)";

type RecordingRequestOptions = MusicBrainzRequestOptions & { limit?: number };

/**
 * Single search stage with specified matching strategy.
 * Caches results in-memory to avoid redundant API calls (MB rate limit: 1 req/sec).
 */
export async function searchStage(
  track: string | undefined,
  artist: string | undefined,
  release: string | undefined,
  strategy: SearchStrategy,
  options?: RecordingRequestOptions,
): Promise<MusicBrainzRecording[]> {
  if (options?.signal?.aborted) return [];

  const queryParts: string[] = [];

  if (track) {
    queryParts.push(buildQueryPart("title", track, strategy));
  }

  if (artist) {
    queryParts.push(buildQueryPart("artist", artist, strategy));
  }

  if (release) {
    queryParts.push(buildQueryPart("release", release, strategy));
  }

  if (queryParts.length === 0) {
    return [];
  }

  const query = queryParts.join(" AND ");

  // Check cache first
  const cacheKey = JSON.stringify([options?.baseUrl ?? DEFAULT_BASE_URL, query, options?.limit ?? 25]);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const results = await fetchMusicBrainzRecordings(query, options);
  if (results === null) return [];
  setCache(cacheKey, results);
  return results;
}

export async function fetchMusicBrainzRecordings(
  query: string,
  {
    limit = 25, userAgent = DEFAULT_USER_AGENT, baseUrl = DEFAULT_BASE_URL,
    signal, fetcher = fetch, failOnError = false,
  }: RecordingRequestOptions = {},
): Promise<MusicBrainzRecording[] | null> {
  const url = `${baseUrl}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
  let delay = INITIAL_RETRY_DELAY;

  for (let attempt = 1; ; attempt++) {
    if (!(await waitForRequestSlot(signal)) || signal?.aborted) return null;
    try {
      const res = await fetcher(url, { signal, headers: { "User-Agent": userAgent } });
      if (signal?.aborted) return null;
      if (res.ok) {
        const data = (await res.json()) as { recordings?: MusicBrainzRecording[] };
        if (Array.isArray(data?.recordings) && data.recordings.every((r) => r && typeof r.id === "string" && r.id && typeof r.title === "string")) {
          return data.recordings;
        }
        throw new MusicBrainzUnavailableError("Invalid MusicBrainz recordings response");
      }
      if ((res.status !== 429 && res.status !== 503) || attempt === MAX_RETRIES) {
        throw new MusicBrainzUnavailableError(`MusicBrainz recording search returned HTTP ${res.status}`);
      }
    } catch (error) {
      if (signal?.aborted) return null;
      if (error instanceof MusicBrainzUnavailableError || attempt === MAX_RETRIES) {
        if (failOnError) throw unavailable(error);
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
}

/**
 * Look up an artist's canonical (romanized) name by alias search.
 *
 * MusicBrainz indexes artist aliases separately from credit names.
 * When the input is CJK (e.g., "久石譲"), the primary artist name in MB
 * is often romanized (e.g., "Joe Hisaishi"), so a recording search for
 * artist:"久石譲" fails. This does an artist search on the alias field,
 * then returns the canonical name for use in a recording search.
 *
 * Returns the best-matching artist name, or null if no match.
 */
export async function resolveArtistAlias(
  artistName: string,
  {
    userAgent = DEFAULT_USER_AGENT, baseUrl = DEFAULT_BASE_URL,
    signal, fetcher = fetch, failOnError = false,
  }: MusicBrainzRequestOptions = {},
): Promise<string | null> {
  if (signal?.aborted) return null;

  // Search artist by alias
  const escaped = artistName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `alias:"${escaped}"`;

  const cacheKey = JSON.stringify([baseUrl, query]);
  const cachedAlias = aliasCache.get(cacheKey);
  if (cachedAlias && Date.now() - cachedAlias.timestamp <= CACHE_TTL_MS) {
    return cachedAlias.value;
  }

  try {
    if (!(await waitForRequestSlot(signal)) || signal?.aborted) return null;
    const res = await fetcher(
      `${baseUrl}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
      { signal, headers: { "User-Agent": userAgent } },
    );

    if (signal?.aborted) return null;
    if (!res.ok) throw new MusicBrainzUnavailableError(`MusicBrainz artist search returned HTTP ${res.status}`);

    const data = (await res.json()) as {
      artists?: Array<{ name?: string }>;
    };
    const artists = data?.artists;
    if (!Array.isArray(artists) || artists.some((artist) => !artist || typeof artist.name !== "string" || !artist.name)) {
      throw new MusicBrainzUnavailableError("Invalid MusicBrainz artist response");
    }

    if (artists.length === 0) {
      aliasCache.set(cacheKey, { value: null, timestamp: Date.now() });
      return null;
    }

    // Return the canonical name of the highest-scoring artist
    const name = artists[0].name ?? null;
    aliasCache.set(cacheKey, { value: name, timestamp: Date.now() });
    return name;
  } catch (error) {
    if (failOnError && !signal?.aborted) throw unavailable(error);
    return null;
  }
}
