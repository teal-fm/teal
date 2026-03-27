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
let lastAPICallTime = 0;

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

/**
 * Single search stage with specified matching strategy.
 * Caches results in-memory to avoid redundant API calls (MB rate limit: 1 req/sec).
 */
export async function searchStage(
  track: string | undefined,
  artist: string | undefined,
  release: string | undefined,
  strategy: SearchStrategy,
  options?: {
    limit?: number;
    userAgent?: string;
    baseUrl?: string;
  },
): Promise<MusicBrainzRecording[]> {
  const limit = options?.limit ?? 25;
  const userAgent = options?.userAgent ?? "tealtracker/0.0.1 (https://github.com/teal-fm/teal)";
  const baseUrl = options?.baseUrl ?? "https://musicbrainz.org/ws/2";

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
  const cacheKey = `${query}|${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Enforce MusicBrainz rate limit (1 request/second) between API calls.
  // Placed after cache check so cache hits are instant.
  const now = Date.now();
  const elapsed = now - lastAPICallTime;
  if (elapsed < MB_RATE_LIMIT_MS && lastAPICallTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, MB_RATE_LIMIT_MS - elapsed));
  }
  lastAPICallTime = Date.now();

  // Retry with exponential backoff for rate limiting
  let retries = MAX_RETRIES;
  let delay = INITIAL_RETRY_DELAY;

  while (retries > 0) {
    try {
      const res = await fetch(
        `${baseUrl}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`,
        {
          headers: {
            "User-Agent": userAgent,
          },
        },
      );

      // Handle rate limiting (503)
      if (res.status === 503) {
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        return [];
      }

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const results: MusicBrainzRecording[] = data.recordings || [];
      setCache(cacheKey, results);
      return results;
    } catch (error) {
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        if (error instanceof Error) {
          console.error(`Search stage ${strategy} failed:`, error.message);
        }
        return [];
      }
    }
  }

  return [];
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
  options?: {
    userAgent?: string;
    baseUrl?: string;
  },
): Promise<string | null> {
  const userAgent = options?.userAgent ?? "tealtracker/0.0.1 (https://github.com/teal-fm/teal)";
  const baseUrl = options?.baseUrl ?? "https://musicbrainz.org/ws/2";

  // Search artist by alias
  const escaped = artistName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const query = `alias:"${escaped}"`;

  const cacheKey = `artist-alias|${query}`;
  const cachedAlias = aliasCache.get(cacheKey);
  if (cachedAlias && Date.now() - cachedAlias.timestamp <= CACHE_TTL_MS) {
    return cachedAlias.value;
  }

  // Rate limit
  const now = Date.now();
  const elapsed = now - lastAPICallTime;
  if (elapsed < MB_RATE_LIMIT_MS && lastAPICallTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, MB_RATE_LIMIT_MS - elapsed));
  }
  lastAPICallTime = Date.now();

  try {
    const res = await fetch(
      `${baseUrl}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=3`,
      { headers: { "User-Agent": userAgent } },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const artists = data.artists || [];

    if (artists.length === 0) {
      aliasCache.set(cacheKey, { value: null, timestamp: Date.now() });
      return null;
    }

    // Return the canonical name of the highest-scoring artist
    const name: string | null = artists[0].name || null;
    aliasCache.set(cacheKey, { value: name, timestamp: Date.now() });
    return name;
  } catch {
    return null;
  }
}
