-- Enhanced discriminant extraction with comprehensive edition/version patterns
-- This migration improves the auto-population of discriminants for better metadata handling

-- Drop existing functions to replace them with enhanced versions
DROP FUNCTION IF EXISTS extract_discriminant(TEXT);
DROP FUNCTION IF EXISTS get_base_name(TEXT);

-- Enhanced function to extract discriminants with comprehensive patterns
CREATE OR REPLACE FUNCTION extract_discriminant(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    -- Comprehensive patterns for discriminant extraction
    discriminant_patterns TEXT[] := ARRAY[
        -- Parentheses patterns
        '\(([^)]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?)\)',
        '\(([^)]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?)\)',
        '\(([^)]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?)\)',
        '\(([^)]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?)\)',
        '\(([^)]*(?:from|soundtrack|ost|score|theme).*?)\)',

        -- Brackets patterns
        '\[([^]]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?)\]',
        '\[([^]]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?)\]',
        '\[([^]]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?)\]',
        '\[([^]]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?)\]',
        '\[([^]]*(?:from|soundtrack|ost|score|theme).*?)\]',

        -- Braces patterns
        '\{([^}]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?)\}',
        '\{([^}]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?)\}',
        '\{([^}]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?)\}',
        '\{([^}]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?)\}',
        '\{([^}]*(?:from|soundtrack|ost|score|theme).*?)\}',

        -- Dash/hyphen patterns (common for editions)
        '[-–—]\s*([^-–—]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray).*?)$',
        '[-–—]\s*(\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$',

        -- Colon patterns (common for subtitles and versions)
        ':\s*([^:]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive).*?)$',
        ':\s*(\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$'
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
        SELECT substring(name_text FROM pattern COLLATE "C") INTO match_result;
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

-- Enhanced function to get base name without discriminant
CREATE OR REPLACE FUNCTION get_base_name(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    -- Comprehensive cleanup patterns matching the extraction patterns
    cleanup_patterns TEXT[] := ARRAY[
        -- Remove parentheses content
        '\s*\([^)]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?\)\s*',
        '\s*\([^)]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?\)\s*',
        '\s*\([^)]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?\)\s*',
        '\s*\([^)]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?\)\s*',
        '\s*\([^)]*(?:from|soundtrack|ost|score|theme).*?\)\s*',

        -- Remove brackets content
        '\s*\[[^]]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?\]\s*',
        '\s*\[[^]]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?\]\s*',
        '\s*\[[^]]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?\]\s*',
        '\s*\[[^]]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?\]\s*',
        '\s*\[[^]]*(?:from|soundtrack|ost|score|theme).*?\]\s*',

        -- Remove braces content
        '\s*\{[^}]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray|hdtv|web|retail|promo|single|ep|lp|maxi|mini|radio|club|dance|house|techno|trance|ambient|classical|jazz|folk|country|rock|pop|metal|punk|indie|alternative).*?\}\s*',
        '\s*\{[^}]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?\}\s*',
        '\s*\{[^}]*(?:vol\.|volume|pt\.|part|disc|disk|cd)\s*\d+.*?\}\s*',
        '\s*\{[^}]*(?:feat\.|featuring|ft\.|with|vs\.|versus|&|and)\s+.*?\}\s*',
        '\s*\{[^}]*(?:from|soundtrack|ost|score|theme).*?\}\s*',

        -- Remove dash/hyphen patterns
        '\s*[-–—]\s*[^-–—]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive|digital|vinyl|cd|dvd|blu-ray).*?$',
        '\s*[-–—]\s*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$',

        -- Remove colon patterns
        '\s*:\s*[^:]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus|edition|special|limited|expanded|director''s|uncut|final|ultimate|platinum|gold|anniversary|collector''s|standard|enhanced|super|mega|ultra|plus|pro|premium|complete|definitive|classic|original|alternate|alternative|unreleased|rare|exclusive).*?$',
        '\s*:\s*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release).*?$'
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
        result_text := regexp_replace(result_text, pattern, ' ', 'gi');
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

-- Create function to extract discriminant specifically for editions and versions
CREATE OR REPLACE FUNCTION extract_edition_discriminant(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    -- Focused patterns for edition/version extraction
    edition_patterns TEXT[] := ARRAY[
        -- Edition patterns
        '\(([^)]*edition[^)]*)\)',
        '\[([^]]*edition[^]]*)\]',
        '\{([^}]*edition[^}]*)\}',
        '[-–—]\s*([^-–—]*edition[^-–—]*)$',
        ':\s*([^:]*edition[^:]*)$',

        -- Version patterns
        '\(([^)]*version[^)]*)\)',
        '\[([^]]*version[^]]*)\]',
        '\{([^}]*version[^}]*)\}',
        '[-–—]\s*([^-–—]*version[^-–—]*)$',
        ':\s*([^:]*version[^:]*)$',

        -- Remaster patterns
        '\(([^)]*remaster[^)]*)\)',
        '\[([^]]*remaster[^]]*)\]',
        '\{([^}]*remaster[^}]*)\}',
        '[-–—]\s*([^-–—]*remaster[^-–—]*)$',
        ':\s*([^:]*remaster[^:]*)$',

        -- Year-based patterns
        '\(([^)]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release)[^)]*)\)',
        '\[([^]]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release)[^]]*)\]',
        '\{([^}]*(?:\d{4}|\d{2})\s*(?:remaster|edition|version|mix|cut|release)[^}]*)\}'
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
        SELECT substring(name_text FROM pattern COLLATE "C") INTO match_result;
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

-- Update recordings table to populate discriminants from existing names
UPDATE recordings
SET discriminant = extract_discriminant(name)
WHERE discriminant IS NULL
  AND extract_discriminant(name) IS NOT NULL;

-- Update releases table to populate discriminants from existing names
UPDATE releases
SET discriminant = extract_discriminant(name)
WHERE discriminant IS NULL
  AND extract_discriminant(name) IS NOT NULL;

-- Update plays table to populate discriminants from existing names where not already set
UPDATE plays
SET track_discriminant = extract_discriminant(track_name)
WHERE track_discriminant IS NULL
  AND extract_discriminant(track_name) IS NOT NULL;

UPDATE plays
SET release_discriminant = extract_discriminant(release_name)
WHERE release_discriminant IS NULL
  AND release_name IS NOT NULL
  AND extract_discriminant(release_name) IS NOT NULL;

-- Create indexes for efficient discriminant queries
CREATE INDEX IF NOT EXISTS idx_recordings_name_discriminant ON recordings (name, discriminant);
CREATE INDEX IF NOT EXISTS idx_releases_name_discriminant ON releases (name, discriminant);

-- Add comments for the new function
COMMENT ON FUNCTION extract_discriminant IS 'Enhanced discriminant extraction supporting comprehensive edition/version patterns including parentheses, brackets, braces, dashes, and colons';
COMMENT ON FUNCTION get_base_name IS 'Enhanced base name extraction removing comprehensive discriminant patterns to enable proper grouping';
COMMENT ON FUNCTION extract_edition_discriminant IS 'Specialized function for extracting edition and version discriminants with focused patterns';

-- Create a view to show discriminant extraction results for analysis
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

COMMENT ON VIEW discriminant_analysis IS 'Analysis view showing discriminant extraction results for quality assessment and debugging';

-- Refresh materialized views to include discriminant information
REFRESH MATERIALIZED VIEW mv_release_play_counts;
REFRESH MATERIALIZED VIEW mv_recording_play_counts;

-- Create summary statistics for discriminant usage
CREATE OR REPLACE VIEW discriminant_stats AS
SELECT
    'recordings' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN discriminant IS NOT NULL THEN 1 END) as with_discriminant,
    COUNT(CASE WHEN discriminant IS NULL AND extract_discriminant(name) IS NOT NULL THEN 1 END) as extractable_discriminant,
    ROUND(
        COUNT(CASE WHEN discriminant IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2
    ) as discriminant_percentage
FROM recordings
UNION ALL
SELECT
    'releases' as entity_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN discriminant IS NOT NULL THEN 1 END) as with_discriminant,
    COUNT(CASE WHEN discriminant IS NULL AND extract_discriminant(name) IS NOT NULL THEN 1 END) as extractable_discriminant,
    ROUND(
        COUNT(CASE WHEN discriminant IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2
    ) as discriminant_percentage
FROM releases;

COMMENT ON VIEW discriminant_stats IS 'Statistics showing discriminant usage and extraction potential across entity types';
