/**
 * Client-side result ranking for MusicBrainz search results
 *
 * Scoring model: multiplicative boosts on a strategy base score.
 * Uses MB's own relevance score (0-100) as a prior, then applies
 * text-matching boosts for track, artist, and release fields.
 *
 * Constants tuned against 44k+ Last.fm scrobbles with ground-truth MBIDs;
 * see scripts/eval/ for the evaluation harness and methodology.
 */

import type { MusicBrainzRecording } from "./oldStamp";
import { normalizeForComparison } from "./musicbrainzCleaner";
import { fuzzyScore } from "./fuzzyMatching";
import type { SearchStrategy } from "./musicbrainzSearchUtils";

// =============================================================================
// SCORING CONSTANTS (14 tunable values)
//
// Multiplicative boosts applied to a base score of 1.0.
// Tuned against Last.fm scrobble corpus (scripts/eval/).
// =============================================================================

// Strategy base: exact results are strongly preferred over fuzzy/partial.
// Wide gap ensures fuzzy-stage P@1 rarely outscores exact-stage P@1.
const STRATEGY_SCORE = { exact: 3.0, fuzzy: 0.6, partial: 0.4 } as const;

// MB API priors
const MB_SCORE_WEIGHT = 0.2;   // blend weight for MB's Lucene score (0 = ignore, 1 = trust fully)
const POSITION_DECAY = 0.015;  // per-position penalty (pos 10 → 0.85x, floored at 0.6x)

// Text match boosts (applied when normalized query text matches result text)
const MATCH_EXACT = 2.2;       // exact string match
const MATCH_PARTIAL = 1.3;     // startsWith or contains
const MATCH_BOTH_FIELDS = 1.5; // bonus when BOTH track and artist match

// Release signals
const RELEASE_MATCH = 1.3;     // release title matches query
const RELEASE_OFFICIAL = 1.08; // official release status (mild -- most recordings are official)
const RELEASE_BOOTLEG = 0.92;  // bootleg / pseudo-release penalty

// Variant/disambiguation handling
const VARIANT_MATCH = 1.3;     // query mentions variant keyword and result has it
const VARIANT_PENALTY = 0.92;  // result has variant info the query didn't ask for

// Classical catalog number handling
const CATALOG_MATCH = 1.8;     // catalog number (BWV, Op., K., etc.) matches
const CATALOG_MISMATCH = 0.5;  // same catalog system but wrong number

// Classical catalog number patterns: BWV 846, Op. 27, K. 331, HWV 56, etc.
const CATALOG_PATTERN = /\b(BWV|Op\.?|K\.?|HWV|RV|D\.?|S\.?|Hob\.?|TrV|WAB|WoO)\s*(\d+)\b/i;

/**
 * Extract catalog identifier from a track title (e.g., "BWV 846" from
 * "Prelude and Fugue No. 1 in C Major, BWV 846").
 * Returns { system, number } or null.
 */
function extractCatalogNumber(text: string): { system: string; number: number } | null {
  const match = text.match(CATALOG_PATTERN);
  if (!match) return null;
  return {
    system: match[1].replace(/\.$/, "").toUpperCase(),
    number: parseInt(match[2], 10),
  };
}

// Variant keywords for matching query variants against result metadata
const VARIANT_KEYWORDS = [
  "live", "acoustic", "remix", "remaster", "remastered",
  "mono", "stereo", "edit", "single", "version",
  "extended", "demo", "dub", "instrumental", "orchestral",
] as const;

export interface RankingQuery {
  track?: string;
  artist?: string;
  release?: string;
  cleanedTrack?: string;
  cleanedArtist?: string;
  cleanedRelease?: string;
}

export type { SearchStrategy } from "./musicbrainzSearchUtils";

// =============================================================================
// FEATURING-ARTIST EXTRACTION
// =============================================================================

const FEAT_PATTERNS = [/\s+feat\.?\s+/i, /\s+ft\.?\s+/i, /\s+featuring\s+/i];

/**
 * Extract the featured artist name from a string.
 * Checks parenthesized, bracketed, and inline "feat." patterns.
 * Returns first 1-3 meaningful words (length > 2), or null.
 */
function extractFeaturedArtist(text: string): string | null {
  const lower = text.toLowerCase();

  for (const parenMatch of text.matchAll(/\(([^)]+)\)/g)) {
    const found = extractFeatFromContent(parenMatch[1].toLowerCase());
    if (found) return found;
  }

  for (const bracketMatch of text.matchAll(/\[([^\]]+)\]/g)) {
    const found = extractFeatFromContent(bracketMatch[1].toLowerCase());
    if (found) return found;
  }

  for (const pattern of FEAT_PATTERNS) {
    const match = lower.match(pattern);
    if (match && match.index !== undefined) {
      const content = lower.substring(match.index + match[0].length).trim();
      const words = content.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) return words.slice(0, 3).join(" ");
    }
  }

  return null;
}

function extractFeatFromContent(content: string): string | null {
  for (const pattern of FEAT_PATTERNS) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      const after = content.substring(match.index + match[0].length).trim();
      const words = after.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) return words.slice(0, 3).join(" ");
    }
  }
  return null;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Compare two normalized strings: "exact", "partial" (startsWith/contains), or "none". */
function matchLevel(query: string, result: string): "exact" | "partial" | "none" {
  if (result === query) return "exact";
  if (result.includes(query)) return "partial";
  return "none";
}

/** Best match level across an array of candidates. */
function bestMatch(query: string, candidates: string[]): "exact" | "partial" | "none" {
  let best: "exact" | "partial" | "none" = "none";
  for (const c of candidates) {
    const level = matchLevel(query, c);
    if (level === "exact") return "exact";
    if (level === "partial") best = "partial";
  }
  return best;
}

// =============================================================================
// SCORING
// =============================================================================

export function scoreResult(
  result: MusicBrainzRecording,
  query: RankingQuery,
  searchStrategy: SearchStrategy,
  /** 0-based position in MB's result list */
  resultPosition?: number,
): number {
  let score = 1.0;

  const resultTitle = result.title || "";
  const credits = result["artist-credit"] ?? [];
  const resultArtist = credits.length > 0
    ? credits.map((c) => c.name).join(credits[0]?.joinphrase ?? " ")
    : "";
  const resultReleases = result.releases ?? [];

  // --- MB API score prior ---
  if (result.score != null && result.score > 0) {
    const mbNorm = result.score / 100;
    score *= (1 - MB_SCORE_WEIGHT) + MB_SCORE_WEIGHT * mbNorm;
  }

  // --- Position prior ---
  if (resultPosition != null && resultPosition > 0) {
    score *= Math.max(0.6, 1.0 - POSITION_DECAY * resultPosition);
  }

  // --- Strategy base ---
  score *= STRATEGY_SCORE[searchStrategy] ?? STRATEGY_SCORE.partial;
  if (searchStrategy === "fuzzy") {
    if (query.track || query.cleanedTrack) {
      score *= 0.5 + fuzzyScore(query.cleanedTrack || query.track!, resultTitle) * 0.5;
    }
    if (query.artist || query.cleanedArtist) {
      score *= 0.5 + fuzzyScore(query.cleanedArtist || query.artist!, resultArtist) * 0.5;
    }
  }

  // --- Normalized forms ---
  const resultTitleNorm = normalizeForComparison(resultTitle);
  const resultArtistNorm = normalizeForComparison(resultArtist);
  const individualCreditNorms = credits.map((c) => normalizeForComparison(c.name));

  // --- Track matching ---
  const queryTrackNorm = normalizeForComparison(query.cleanedTrack || query.track || "");
  let trackMatched = false;
  if (queryTrackNorm) {
    const level = matchLevel(queryTrackNorm, resultTitleNorm);
    if (level === "exact") { score *= MATCH_EXACT; trackMatched = true; }
    else if (level === "partial") { score *= MATCH_PARTIAL; trackMatched = true; }
  }

  // --- Artist matching (check full credit string + individual credits) ---
  const queryArtistNorm = normalizeForComparison(query.cleanedArtist || query.artist || "");
  let artistMatched = false;
  if (queryArtistNorm) {
    const level = bestMatch(queryArtistNorm, [resultArtistNorm, ...individualCreditNorms]);
    if (level === "exact") { score *= MATCH_EXACT; artistMatched = true; }
    else if (level === "partial") { score *= MATCH_PARTIAL; artistMatched = true; }
  }

  // --- Both fields match bonus ---
  if (trackMatched && artistMatched) {
    score *= MATCH_BOTH_FIELDS;
  }

  // --- Release matching (scan ALL releases, not just the first) ---
  // MusicBrainz recordings appear on multiple releases (original, compilation, reissue).
  // The query album might match a non-first release.
  const queryReleaseNorm = normalizeForComparison(query.cleanedRelease || query.release || "");
  if (queryReleaseNorm && resultReleases.length > 0) {
    const releaseMatch = resultReleases.some((rel) => {
      if (!rel.title) return false;
      const relNorm = normalizeForComparison(rel.title);
      // Bidirectional: "Street Songs" matches "Street Songs (Deluxe Edition)" and vice versa
      return relNorm.includes(queryReleaseNorm) || queryReleaseNorm.includes(relNorm);
    });
    if (releaseMatch) {
      score *= RELEASE_MATCH;
    }
  }

  // --- Featuring artist bonus ---
  const queryFeat = extractFeaturedArtist(query.track || query.cleanedTrack || "");
  if (queryFeat) {
    const resultFeat = extractFeaturedArtist(resultTitle);
    if (resultFeat) {
      const qNorm = normalizeForComparison(queryFeat);
      const rNorm = normalizeForComparison(resultFeat);
      if (rNorm.includes(qNorm) || qNorm.includes(rNorm)) {
        score *= MATCH_PARTIAL;
      }
    }
  }

  // --- Classical catalog number matching ---
  const queryTrackRaw = query.track || query.cleanedTrack || "";
  const queryCatalog = extractCatalogNumber(queryTrackRaw);
  if (queryCatalog) {
    const resultCatalog = extractCatalogNumber(resultTitle);
    if (resultCatalog && resultCatalog.system === queryCatalog.system) {
      score *= resultCatalog.number === queryCatalog.number
        ? CATALOG_MATCH
        : CATALOG_MISMATCH;
    }
  }

  // --- Variant version matching ---
  const queryForVariants = (query.track || query.cleanedTrack || "").toLowerCase();
  const resultTitleLower = resultTitle.toLowerCase();
  const disambLower = (result.disambiguation && typeof result.disambiguation === "string")
    ? result.disambiguation.toLowerCase().trim()
    : "";
  const resultVariantText = `${resultTitleLower} ${disambLower}`;

  const queryVariants = VARIANT_KEYWORDS.filter((kw) => queryForVariants.includes(kw));

  if (queryVariants.length > 0) {
    const resultHasVariant = queryVariants.some((kw) => resultVariantText.includes(kw));
    score *= resultHasVariant ? VARIANT_MATCH : VARIANT_PENALTY;
  } else if (disambLower.length > 0) {
    const resultHasVariant = VARIANT_KEYWORDS.some((kw) => disambLower.includes(kw));
    if (resultHasVariant) score *= VARIANT_PENALTY;
  }

  // --- Release quality signals ---
  const firstRelease = result.releases?.[0];
  const releaseStatus = firstRelease?.status?.toLowerCase();
  if (releaseStatus === "official") {
    score *= RELEASE_OFFICIAL;
  } else if (releaseStatus === "bootleg" || releaseStatus === "pseudo-release") {
    score *= RELEASE_BOOTLEG;
  }

  return score;
}

/**
 * Rank and sort search results by relevance
 */
export function rankResults(
  results: MusicBrainzRecording[],
  query: RankingQuery,
  searchStrategy: SearchStrategy,
): MusicBrainzRecording[] {
  const ranked = results.map((result, idx) => ({
    result,
    score: scoreResult(result, query, searchStrategy, idx),
  }));

  ranked.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.01) return b.score - a.score;
    return 0;
  });

  return ranked.map((r) => r.result);
}

/**
 * Rank results from multiple search stages, deduplicating by ID.
 * Keeps the highest-scored entry for each recording ID.
 */
export function rankMultiStageResults(
  stageResults: Array<{
    results: MusicBrainzRecording[];
    strategy: SearchStrategy;
  }>,
  query: RankingQuery,
): MusicBrainzRecording[] {
  const bestByID = new Map<string, { result: MusicBrainzRecording; score: number }>();

  for (const { results, strategy } of stageResults) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.id) continue;
      const score = scoreResult(result, query, strategy, i);
      const existing = bestByID.get(result.id);
      if (!existing || score > existing.score) {
        bestByID.set(result.id, { result, score });
      }
    }
  }

  const allRanked = Array.from(bestByID.values());
  allRanked.sort((a, b) => b.score - a.score);
  return allRanked.map((r) => r.result);
}
