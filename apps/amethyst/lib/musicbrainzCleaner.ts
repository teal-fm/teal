/**
 * MusicBrainz name cleaning utilities
 * Ported from backend Rust implementation for improved search matching
 */

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

/**
 * Threshold for "short" base names that need disambiguation info preserved.
 * Track names shorter than this are more likely to be generic (e.g., "High", "One")
 * and benefit from having remix/feat info preserved.
 * 
 * Evaluated against Last.fm scrobble data: 15 chars balances:
 * - Preserving disambiguation for common short names
 * - Removing guff for longer, more specific names
 */
const SHORT_NAME_THRESHOLD = 15;

/**
 * Threshold for "common phrase" length (combined with word count check).
 * Names under this length with ≤3 words are considered common phrases
 * that may need disambiguation.
 */
const COMMON_PHRASE_LENGTH = 20;

/**
 * Minimum word length to be considered a potential artist name in disambiguation.
 * Words shorter than this are likely articles/prepositions, not artist names.
 */
const MIN_ARTIST_NAME_LENGTH = 4;

/**
 * Generic track names that commonly need disambiguation info preserved.
 * These are words that appear in many different songs by different artists.
 */
const GENERIC_TRACK_NAMES = [
  "song", "track", "music", "beat", "sound", "tune", "piece",
  "high", "low", "one", "two", "three", "four", "five",
  "love", "time", "life", "home", "heart", "dream",
] as const;

/**
 * Words commonly found in parenthetical/bracketed content that can be removed
 * without losing essential information for matching.
 * 
 * Categories:
 * - Audio quality/format: mono, stereo, remastered, etc.
 * - Version types: remix, edit, live, acoustic, etc.
 * - Production info: prod, produced, by
 * - Edition types: deluxe, expanded, anniversary, bonus
 * - Collaboration markers: feat, ft, featuring, vs, with
 * - Status/metadata: official, explicit, clean, etc.
 */
const GUFF_WORDS = [
  // Audio quality/format
  "mono",
  "stereo",
  "quadraphonic",
  "remastered",
  "remaster",
  "master",
  "hd",
  "hifi",
  "hi-fi",
  
  // Version types
  "a cappella",
  "acoustic",
  "extended",
  "instrumental",
  "karaoke",
  "live",
  "orchestral",
  "piano",
  "unplugged",
  "vocal",
  
  // Remix/edit variants
  "club",
  "clubmix",
  "dance",
  "edit",
  "maxi",
  "megamix",
  "mix",
  "radio",
  "re-edit",
  "reedit",
  "refix",
  "remake",
  "remix",
  "remixed",
  "remode",
  "reprise",
  "rework",
  "reworked",
  "rmx",
  
  // Production credits (commonly in brackets)
  "prod",
  "produced",
  "production",
  
  // Edition/release types
  "anniversary",
  "bonus",
  "deluxe",
  "edition",
  "expanded",
  "original",
  "release",
  "released",
  "single",
  "special",
  "version",
  "ver",
  
  // Session/take variants
  "demo",
  "outtake",
  "outtakes",
  "rehearsal",
  "session",
  "take",
  "takes",
  "tape",
  "tryout",
  
  // Track structure
  "composition",
  "cut",
  "dialogue",
  "excerpt",
  "interlude",
  "intro",
  "long",
  "main",
  "outro",
  "rap",
  "short",
  "skit",
  "studio",
  "track",
  
  // Content ratings
  "censored",
  "clean",
  "dirty",
  "explicit",
  "uncensored",
  
  // Collaboration/featuring
  "feat",
  "featuring",
  "ft",
  "vs",
  "with",
  "without",
  
  // Video/media
  "official",
  "video",
  
  // Other metadata
  "reinterpreted",
  "snippet",
  "preview",
  "unknown",
  "untitled",
] as const;

/**
 * Check if content should be kept for disambiguation (remix/feat info)
 * 
 * Returns true if:
 * - Content contains remix/feat info AND
 * - Base name is generic, short, or content has artist name
 */
function shouldKeepForDisambiguation(
  content: string,
  baseName: string,
  type: "remix" | "feat" | "version"
): boolean {
  const contentLower = content.toLowerCase();
  const baseNameLower = baseName.toLowerCase();
  
  // Instrumental/acoustic are always worth preserving regardless of base name length.
  // Eval: stripping instrumental has 0 better-position wins, 16 regressions (all from P@1).
  // These denote distinct recordings in MB (vocal vs instrumental, plugged vs acoustic).
  if (type === "version" && /\b(?:instrumental|acoustic)\b/.test(contentLower)) {
    return true;
  }

  // Check if content matches the type we're looking for
  const isRelevant = type === "remix"
    ? /remix|rmx|rework|refix|remode/.test(contentLower)
    : type === "version"
    ? /\b(?:mono|stereo|quadraphonic)\b/.test(contentLower)
      || (/\b(?:remaster(?:ed)?)\b/.test(contentLower) && /(19|20)\d{2}/.test(contentLower))
    : /feat\.?|ft\.?|featuring/i.test(contentLower);

  // "edition" and "mix" are remix-like only when accompanied by an artist name
  // (e.g., "Kaytranada Edition" / "Zomby mix" = named remix, "Deluxe Edition" / "Original Mix" = guff)
  const GENERIC_MIX_WORDS = /^(?:edition|deluxe|special|expanded|anniversary|bonus|limited|original|remastered|collector|club|radio|dance|dub|instrumental|extended|vocal|single|version|maxi|mega|short|long|main|mix|\d+\w*)$/;
  const isNamedVariantWithArtist = type === "remix"
    && /\b(?:edition|mix)\b/.test(contentLower)
    && contentLower.split(/\s+/).some(
      word => word.length >= MIN_ARTIST_NAME_LENGTH
        && !GENERIC_MIX_WORDS.test(word)
    );

  if (!isRelevant && !isNamedVariantWithArtist) return false;

  // Check if base name is generic (common word that appears in many songs)
  const isGenericWord = GENERIC_TRACK_NAMES.some(
    word => baseNameLower === word || baseNameLower.startsWith(word + " ")
  );
  const isShort = baseName.length < SHORT_NAME_THRESHOLD;
  const isCommonPhrase = baseName.split(/\s+/).length <= 3 && baseName.length < COMMON_PHRASE_LENGTH;

  // Check if content contains artist name (word ≥ MIN_ARTIST_NAME_LENGTH that's not a keyword)
  const keywordPattern = type === "remix"
    ? /remix|rmx|rework|refix|remode|edition/i
    : type === "version"
    ? /mono|stereo|quadraphonic|remaster(?:ed)?/i
    : /feat\.?|ft\.?|featuring/i;
  const hasArtistName = contentLower.split(/\s+/).some(
    word => word.length >= MIN_ARTIST_NAME_LENGTH && !keywordPattern.test(word)
  );
  
  return isGenericWord || (isShort && isCommonPhrase) || hasArtistName;
}

/**
 * Check if parenthetical content is likely "guff" that should be removed
 */
function isLikelyGuff(content: string): boolean {
  const contentLower = content.toLowerCase();
  const words = contentLower.split(/\s+/);

  // Count guff words (strip trailing punctuation for matching: "prod." -> "prod")
  const guffWordSet = new Set<string>(GUFF_WORDS);
  const guffWordCount = words.filter((word) => {
    const stripped = word.replace(/[.,!?;:]+$/, ""); // Strip trailing punctuation
    return guffWordSet.has(word) || guffWordSet.has(stripped);
  }).length;

  // Check for years (19XX or 20XX)
  const hasYear = /(19|20)\d{2}/.test(contentLower);

  // Consider it guff if >50% are guff words, or if it contains years, or if it's short and common
  return (
    guffWordCount > words.length / 2 ||
    hasYear ||
    (words.length <= 2 &&
      GUFF_WORDS.some((guff) => contentLower.includes(guff)))
  );
}

/**
 * Clean artist name by removing common variations and guff
 */
export function cleanArtistName(name: string): string {
  let cleaned = name.trim();

  // Remove common featuring patterns
  const featPatterns = [
    /\s+feat\.?\s+/i,
    /\s+ft\.?\s+/i,
    /\s+featuring\s+/i,
  ];
  for (const pattern of featPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      cleaned = cleaned.substring(0, match.index).trim();
    }
  }

  // Remove parenthetical content if it looks like guff
  // Match backend behavior: only remove first occurrence to handle nested parentheses correctly
  if (cleaned.includes("(") && cleaned.includes(")")) {
    const start = cleaned.indexOf("(");
    // Find matching closing paren (handle nested)
    let depth = 1;
    let end = start + 1;
    while (end < cleaned.length && depth > 0) {
      if (cleaned[end] === "(") depth++;
      else if (cleaned[end] === ")") depth--;
      end++;
    }
    if (depth === 0) {
      end--; // Adjust for final increment
      const parenContent = cleaned.substring(start + 1, end).toLowerCase();
      if (isLikelyGuff(parenContent)) {
        cleaned = (cleaned.substring(0, start) + cleaned.substring(end + 1)).trim();
        // Normalize whitespace after removal (fixes double spaces)
        cleaned = cleaned.replace(/\s+/g, " ").trim();
      }
    }
  }

  // Remove brackets with guff
  // Match backend behavior: only remove first occurrence
  if (cleaned.includes("[") && cleaned.includes("]")) {
    const start = cleaned.indexOf("[");
    // Find matching closing bracket (handle nested)
    let depth = 1;
    let end = start + 1;
    while (end < cleaned.length && depth > 0) {
      if (cleaned[end] === "[") depth++;
      else if (cleaned[end] === "]") depth--;
      end++;
    }
    if (depth === 0) {
      end--; // Adjust for final increment
      const bracketContent = cleaned.substring(start + 1, end).toLowerCase();
      if (isLikelyGuff(bracketContent)) {
        cleaned = (cleaned.substring(0, start) + cleaned.substring(end + 1)).trim();
        // Normalize whitespace after removal
        cleaned = cleaned.replace(/\s+/g, " ").trim();
      }
    }
  }

  // Don't strip "The " prefix -- MusicBrainz indexes artists with "The"
  // (e.g., "The Beatles", "The Rolling Stones") and stripping causes exact
  // search misses that force unnecessary fuzzy/fallback stages.

  return cleaned.trim();
}

/**
 * Clean track name by removing common variations and guff
 * 
 * Smarter remix handling -- don't remove "remix" if it's the only distinguishing feature.
 * (e.g., "High You Are (Branchez Remix)" - "Branchez Remix" distinguishes this from other versions)
 */
export function cleanTrackName(name: string): string {
  let cleaned = name.trim();

  // Strip leading/trailing decorative characters (* ~ · • ★ etc.)
  const stripped = cleaned.replace(/^[\s*~·•★☆♪♫|_>]+/, "").replace(/[\s*~·•★☆♪♫|_<]+$/, "").trim();
  if (stripped.length > 0) cleaned = stripped;

  // Remove parenthetical content if it looks like guff.
  // Process all top-level parenthetical groups right-to-left so removals don't shift
  // earlier indices. Handles "Song (Remix) (Live Version)" removing "(Live Version)".
  {
    // Collect all top-level paren groups
    const groups: Array<{ start: number; end: number; content: string }> = [];
    let i = 0;
    while (i < cleaned.length) {
      if (cleaned[i] === "(") {
        let depth = 1;
        let j = i + 1;
        while (j < cleaned.length && depth > 0) {
          if (cleaned[j] === "(") depth++;
          else if (cleaned[j] === ")") depth--;
          j++;
        }
        if (depth === 0) {
          groups.push({ start: i, end: j - 1, content: cleaned.substring(i + 1, j - 1) });
          i = j;
        } else {
          break;
        }
      } else {
        i++;
      }
    }

    // Process right-to-left
    for (let g = groups.length - 1; g >= 0; g--) {
      const { start, end, content } = groups[g];
      const baseName = cleaned.substring(0, start).trim();
      const shouldKeepRemix = shouldKeepForDisambiguation(content, baseName, "remix");
      const shouldKeepFeat = shouldKeepForDisambiguation(content, baseName, "feat");
      const shouldKeepVersion = shouldKeepForDisambiguation(content, baseName, "version");
      const shouldKeep = shouldKeepRemix || shouldKeepFeat || shouldKeepVersion;
      const wouldLeaveEmpty = baseName.length === 0 && cleaned.substring(end + 1).trim().length === 0;
      if (isLikelyGuff(content.toLowerCase()) && !shouldKeep && !wouldLeaveEmpty) {
        cleaned = (cleaned.substring(0, start) + cleaned.substring(end + 1)).trim();
        cleaned = cleaned.replace(/\s+/g, " ").trim();
      }
    }
  }

  // Remove brackets with guff (same right-to-left logic as parentheses)
  {
    const groups: Array<{ start: number; end: number; content: string }> = [];
    let bi = 0;
    while (bi < cleaned.length) {
      if (cleaned[bi] === "[") {
        let depth = 1;
        let bj = bi + 1;
        while (bj < cleaned.length && depth > 0) {
          if (cleaned[bj] === "[") depth++;
          else if (cleaned[bj] === "]") depth--;
          bj++;
        }
        if (depth === 0) {
          groups.push({ start: bi, end: bj - 1, content: cleaned.substring(bi + 1, bj - 1) });
          bi = bj;
        } else {
          break;
        }
      } else {
        bi++;
      }
    }

    for (let g = groups.length - 1; g >= 0; g--) {
      const { start, end, content } = groups[g];
      const baseName = cleaned.substring(0, start).trim();
      const shouldKeepRemix = shouldKeepForDisambiguation(content, baseName, "remix");
      const shouldKeepFeat = shouldKeepForDisambiguation(content, baseName, "feat");
      const shouldKeepVersion = shouldKeepForDisambiguation(content, baseName, "version");
      const shouldKeep = shouldKeepRemix || shouldKeepFeat || shouldKeepVersion;
      const wouldLeaveEmpty = baseName.length === 0 && cleaned.substring(end + 1).trim().length === 0;
      if (isLikelyGuff(content.toLowerCase()) && !shouldKeep && !wouldLeaveEmpty) {
        cleaned = (cleaned.substring(0, start) + cleaned.substring(end + 1)).trim();
        cleaned = cleaned.replace(/\s+/g, " ").trim();
      }
    }
  }

  // Remove dash-separated suffixes that look like guff or remix info.
  // Common in Last.fm/scrobbler data: "Song - Single Version", "Song - Artist Remix"
  // Must run BEFORE feat removal so "Song - feat. Artist" also gets handled.
  const dashIndex = cleaned.indexOf(" - ");
  if (dashIndex > 0) {
    const baseName = cleaned.substring(0, dashIndex).trim();
    const suffix = cleaned.substring(dashIndex + 3).trim();

    if (baseName.length > 0 && suffix.length > 0) {
      // Treat the suffix like parenthetical content: strip if guff and not needed for disambiguation
      const shouldKeepRemix = shouldKeepForDisambiguation(suffix, baseName, "remix");
      const shouldKeepFeat = shouldKeepForDisambiguation(suffix, baseName, "feat");
      const shouldKeepVersion = shouldKeepForDisambiguation(suffix, baseName, "version");
      const shouldKeep = shouldKeepRemix || shouldKeepFeat || shouldKeepVersion;

      if (isLikelyGuff(suffix.toLowerCase()) && !shouldKeep) {
        cleaned = baseName;
      } else if (/\b(?:remix|rmx|rework|re-edit|reedit|mix)\b/i.test(suffix)) {
        // Convert dash-separated remix/mix to parenthesized format.
        // Last.fm uses "Track - Artist Remix" but MusicBrainz often uses "Track (Artist Remix)"
        cleaned = `${baseName} (${suffix})`;
      }
    }
  }

  // Remove featuring artists from track titles
  const featPatterns = [
    /\s+feat\.?\s+/i,
    /\s+ft\.?\s+/i,
    /\s+featuring\s+/i,
  ];

  for (const pattern of featPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      const baseName = cleaned.substring(0, match.index).trim();
      const featContent = cleaned.substring(match.index + match[0].length).trim();

      // Only remove if not needed for disambiguation
      const shouldKeep = shouldKeepForDisambiguation(featContent, baseName, "feat");
      if (!shouldKeep) {
        cleaned = baseName;
      }
      break;
    }
  }

  return cleaned.trim();
}

/**
 * Clean release/album name by removing common variations and guff
 * 
 * NOTE: Currently delegates to cleanTrackName. This is intentional because:
 * - Albums often have similar "guff" patterns (remastered, deluxe, etc.)
 * - The shouldKeepForDisambiguation logic works for both contexts
 * - If album-specific cleaning is needed later, add it here
 */
export function cleanReleaseName(name: string): string {
  return cleanTrackName(name);
}

/**
 * Normalize text for comparison (remove special chars, lowercase, etc.)
 * Enhanced with Unicode normalization for accent-insensitive matching.
 *
 * For Latin text: strips diacriticals, keeps [a-zA-Z0-9\s].
 * For non-Latin text (CJK, Cyrillic, etc.): keeps all Unicode
 * alphanumeric characters so that different non-Latin strings
 * remain distinguishable.
 */
export function normalizeForComparison(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  // Step 1: NFD decomposition to separate base characters from accents
  let normalized = text.normalize("NFD");

  // Step 2: Remove combining diacritical marks (accents)
  normalized = normalized.replace(/[\u0300-\u036f]/g, "");

  // Step 3: Keep all Unicode alphanumeric characters and whitespace.
  // This preserves CJK, Cyrillic, Arabic, etc. while still stripping
  // punctuation and symbols.
  const filtered = Array.from(normalized)
    .filter((c) => isUnicodeAlphanumeric(c) || /\s/.test(c))
    .join("");

  // Step 4: Re-compose (NFC) so that decomposed Hangul jamo and other
  // scripts round-trip correctly.
  return filtered
    .normalize("NFC")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .join(" ")
    .trim();
}

/**
 * Check if a character is alphanumeric in any script.
 * Uses Unicode category awareness: letters (L*) and numbers (N*).
 */
function isUnicodeAlphanumeric(c: string): boolean {
  // Fast path for ASCII
  if (/[a-zA-Z0-9]/.test(c)) return true;
  // Unicode letter or number (covers CJK, Cyrillic, Arabic, etc.)
  // \p{L} = any Unicode letter, \p{N} = any Unicode number
  return /[\p{L}\p{N}]/u.test(c);
}
