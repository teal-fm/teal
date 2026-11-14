/**
 * Fuzzy matching utilities for MusicBrainz search
 *
 * Provides edit distance (Levenshtein) and scored similarity
 * for comparing track/artist names against search results.
 */

import { normalizeForComparison } from "./musicbrainzCleaner";

/**
 * Calculate Levenshtein edit distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const len1 = s1.length;
  const len2 = s2.length;

  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio (0-1) based on edit distance
 * 1.0 = identical, 0.0 = completely different
 */
export function similarityRatio(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Check if two strings are a fuzzy match within a threshold
 */
export function fuzzyMatch(
  query: string,
  candidate: string,
  threshold: number = 0.75,
): boolean {
  const queryNorm = normalizeForComparison(query);
  const candidateNorm = normalizeForComparison(candidate);

  if (queryNorm === candidateNorm) return true;

  return similarityRatio(queryNorm, candidateNorm) >= threshold;
}

/**
 * Score a candidate match based on fuzzy similarity
 * Returns score 0-1, where 1.0 is perfect match
 */
export function fuzzyScore(query: string, candidate: string): number {
  const queryNorm = normalizeForComparison(query);
  const candidateNorm = normalizeForComparison(candidate);

  if (queryNorm === candidateNorm) return 1.0;

  // Scale prefix/containment scores by how much of the candidate the query covers.
  // "Hello World" in "Hello World (Live)" (high coverage) scores near the cap;
  // "Love" in "I Will Always Love You" (low coverage) scores much lower.
  const coverage = queryNorm.length / candidateNorm.length;
  if (candidateNorm.startsWith(queryNorm)) return 0.7 + 0.2 * coverage;
  if (candidateNorm.includes(queryNorm)) return 0.5 + 0.3 * coverage;

  return similarityRatio(queryNorm, candidateNorm);
}
