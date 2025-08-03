-- Fix case sensitivity in discriminant extraction patterns
-- This migration updates the discriminant extraction functions to properly handle case-insensitive matching

-- Drop dependent views first, then functions, then recreate everything
DROP VIEW IF EXISTS discriminant_analysis CASCADE;
DROP VIEW IF EXISTS discriminant_stats CASCADE;

-- Drop existing functions to replace with case-insensitive versions
DROP FUNCTION IF EXISTS extract_discriminant(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_base_name(TEXT) CASCADE;
DROP FUNCTION IF EXISTS extract_edition_discriminant(TEXT) CASCADE;

-- Enhanced function to extract discriminants with case-insensitive matching
CREATE OR REPLACE FUNCTION extract_discriminant(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    -- Comprehensive patterns for discriminant extraction with case-insensitive flags
    discriminant_patterns TEXT[] := ARRAY[
        -- Parentheses patterns
        '(?i)\(([^)]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?)\)',
        '(?i)\(([^)]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?)\)',
        '(?i)\(([^)]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?)\)',
        '(?i)\(([^)]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?)\)',
        '(?i)\(([^)]*(?:from|soundtrack|ost|score|theme).*?)\)',

        -- Brackets patterns
        '(?i)\[([^]]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?)\]',
        '(?i)\[([^]]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?)\]',
        '(?i)\[([^]]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?)\]',
        '(?i)\[([^]]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?)\]',
        '(?i)\[([^]]*(?:from|soundtrack|ost|score|theme).*?)\]',

        -- Braces patterns
        '(?i)\{([^}]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?)\}',
        '(?i)\{([^}]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?)\}',
        '(?i)\{([^}]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?)\}',
        '(?i)\{([^}]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?)\}',
        '(?i)\{([^}]*(?:from|soundtrack|ost|score|theme).*?)\}',

        -- Dash/hyphen patterns (common for editions)
        '(?i)[-–—]\s*([^-–—]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray).*?)$',
        '(?i)[-–—]\s*(\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$',

        -- Colon patterns (common for subtitles and versions)
        '(?i):\s*([^:]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive).*?)$',
        '(?i):\s*(\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$'
    ];

    pattern TEXT;
    match_result TEXT;
BEGIN
    -- Return early if input is null or empty
    IF name_text IS NULL OR trim(name_text) = '' THEN
        RETURN NULL;
    END IF;

    -- Try each pattern to find discriminant information
    FOREACH pattern IN ARRAY discriminant_patterns
    LOOP
        SELECT substring(name_text FROM pattern) INTO match_result;
        IF match_result IS NOT NULL AND length(trim(match_result)) > 0 THEN
            -- Clean up the match result
            match_result := trim(match_result);
            -- Remove leading/trailing punctuation
            match_result := regexp_replace(match_result, '^[^\w]+|[^\w]+$', '', 'g');
            -- Ensure it's not just whitespace or empty after cleanup
            IF length(trim(match_result)) > 0 THEN
                RETURN match_result;
            END IF;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enhanced function to get base name without discriminant with case-insensitive matching
CREATE OR REPLACE FUNCTION get_base_name(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    -- Comprehensive cleanup patterns matching the extraction patterns
    cleanup_patterns TEXT[] := ARRAY[
        -- Remove parentheses content
        '(?i)\s*\([^)]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?\)\s*',
        '(?i)\s*\([^)]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?\)\s*',
        '(?i)\s*\([^)]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?\)\s*',
        '(?i)\s*\([^)]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?\)\s*',
        '(?i)\s*\([^)]*(?:from|soundtrack|ost|score|theme).*?\)\s*',

        -- Remove brackets content
        '(?i)\s*\[[^]]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?\]\s*',
        '(?i)\s*\[[^]]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?\]\s*',
        '(?i)\s*\[[^]]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?\]\s*',
        '(?i)\s*\[[^]]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?\]\s*',
        '(?i)\s*\[[^]]*(?:from|soundtrack|ost|score|theme).*?\]\s*',

        -- Remove braces content
        '(?i)\s*\{[^}]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?\}\s*',
        '(?i)\s*\{[^}]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?\}\s*',
        '(?i)\s*\{[^}]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?\}\s*',
        '(?i)\s*\{[^}]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?\}\s*',
        '(?i)\s*\{[^}]*(?:from|soundtrack|ost|score|theme).*?\}\s*',

        -- Remove dash/hyphen patterns
        '(?i)\s*[-–—]\s*[^-–—]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray).*?$',
        '(?i)\s*[-–—]\s*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$',

        -- Remove colon patterns
        '(?i)\s*:\s*[^:]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive).*?$',
        '(?i)\s*:\s*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$'
    ];

    pattern TEXT;
    result_text TEXT := name_text;
BEGIN
    -- Return early if input is null or empty
    IF name_text IS NULL OR trim(name_text) = '' THEN
        RETURN name_text;
    END IF;

    -- Remove discriminant patterns to get base name
    FOREACH pattern IN ARRAY cleanup_patterns
    LOOP
        result_text := regexp_replace(result_text, pattern, ' ', 'g');
    END LOOP;

    -- Clean up extra whitespace and normalize
    result_text := regexp_replace(trim(result_text), '\s+', ' ', 'g');

    -- Remove trailing punctuation that might be left after removal
    result_text := regexp_replace(result_text, '[,;:\-–—]\s*$', '', 'g');
    result_text := trim(result_text);

    -- Ensure we don't return an empty string
    IF length(result_text) = 0 THEN
        RETURN name_text;
    END IF;

    RETURN result_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enhanced function to extract discriminant specifically for editions and versions with case-insensitive matching
CREATE OR REPLACE FUNCTION extract_edition_discriminant(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    -- Focused patterns for edition/version extraction with case-insensitive flags
    edition_patterns TEXT[] := ARRAY[
        -- Edition patterns
        '(?i)\(([^)]*edition[^)]*)\)',
        '(?i)\[([^]]*edition[^]]*)\]',
        '(?i)\{([^}]*edition[^}]*)\}',
        '(?i)[-–—]\s*([^-–—]*edition[^-–—]*)$',
        '(?i):\s*([^:]*edition[^:]*)$',

        -- Version patterns
        '(?i)\(([^)]*version[^)]*)\)',
        '(?i)\[([^]]*version[^]]*)\]',
        '(?i)\{([^}]*version[^}]*)\}',
        '(?i)[-–—]\s*([^-–—]*version[^-–—]*)$',
        '(?i):\s*([^:]*version[^:]*)$',

        -- Remaster patterns
        '(?i)\(([^)]*remaster[^)]*)\)',
        '(?i)\[([^]]*remaster[^]]*)\]',
        '(?i)\{([^}]*remaster[^}]*)\}',
        '(?i)[-–—]\s*([^-–—]*remaster[^-–—]*)$',
        '(?i):\s*([^:]*remaster[^:]*)$',

        -- Year-based patterns
        '(?i)\(([^)]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release)[^)]*)\)',
        '(?i)\[([^]]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release)[^]]*)\]',
        '(?i)\{([^}]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release)[^}]*)\}'
    ];

    pattern TEXT;
    match_result TEXT;
BEGIN
    -- Return early if input is null or empty
    IF name_text IS NULL OR trim(name_text) = '' THEN
        RETURN NULL;
    END IF;

    -- Try edition-specific patterns first
    FOREACH pattern IN ARRAY edition_patterns
    LOOP
        SELECT substring(name_text FROM pattern) INTO match_result;
        IF match_result IS NOT NULL AND length(trim(match_result)) > 0 THEN
            match_result := trim(match_result);
            match_result := regexp_replace(match_result, '^[^\w]+|[^\w]+$', '', 'g');
            IF length(trim(match_result)) > 0 THEN
                RETURN match_result;
            END IF;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing records with newly extracted discriminants (case-insensitive)
UPDATE recordings
SET discriminant = extract_discriminant(name)
WHERE discriminant IS NULL
  AND extract_discriminant(name) IS NOT NULL;

UPDATE releases
SET discriminant = extract_discriminant(name)
WHERE discriminant IS NULL
  AND extract_discriminant(name) IS NOT NULL;

UPDATE plays
SET track_discriminant = extract_discriminant(track_name)
WHERE track_discriminant IS NULL
  AND extract_discriminant(track_name) IS NOT NULL;

UPDATE plays
SET release_discriminant = extract_discriminant(release_name)
WHERE release_discriminant IS NULL
  AND release_name IS NOT NULL
  AND extract_discriminant(release_name) IS NOT NULL;

-- Update comments for the enhanced functions
COMMENT ON FUNCTION extract_discriminant IS 'Enhanced case-insensitive discriminant extraction supporting comprehensive edition/version patterns including parentheses, brackets, braces, dashes, and colons';
COMMENT ON FUNCTION get_base_name IS 'Enhanced case-insensitive base name extraction removing comprehensive discriminant patterns to enable proper grouping';
COMMENT ON FUNCTION extract_edition_discriminant IS 'Specialized case-insensitive function for extracting edition and version discriminants with focused patterns';

-- Refresh materialized views to reflect the case-insensitive improvements
REFRESH MATERIALIZED VIEW mv_release_play_counts;
REFRESH MATERIALIZED VIEW mv_recording_play_counts;

-- Update discriminant analysis view to include case-insensitive results
DROP VIEW IF EXISTS discriminant_analysis;
CREATE OR REPLACE VIEW discriminant_analysis AS
SELECT
    'recordings' as table_name,
    name as original_name,
    discriminant,
    get_base_name(name) as base_name,
    extract_discriminant(name) as extracted_discriminant,
    extract_edition_discriminant(name) as edition_discriminant
FROM recordings
WHERE name IS NOT NULL
UNION ALL
SELECT
    'releases' as table_name,
    name as original_name,
    discriminant,
    get_base_name(name) as base_name,
    extract_discriminant(name) as extracted_discriminant,
    extract_edition_discriminant(name) as edition_discriminant
FROM releases
WHERE name IS NOT NULL;

COMMENT ON VIEW discriminant_analysis IS 'Analysis view showing case-insensitive discriminant extraction results for quality assessment and debugging';
