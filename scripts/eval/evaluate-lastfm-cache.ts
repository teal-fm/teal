/**
 * SQLite cache for Last.fm evaluation data
 * Accumulates scrobbles and MBIDs over time, never clears
 */

import Database from "better-sqlite3";
import { createHash } from "crypto";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";

const CACHE_DIR = join(homedir(), ".teal_eval_cache");
const DB_PATH = join(CACHE_DIR, "lastfm_eval.db");

// Bump this when evaluation logic changes in a way that should invalidate cached evaluation results.
const EVALUATION_LOGIC_VERSION = "2026-03-09-v27";

// Ensure cache directory exists
mkdirSync(CACHE_DIR, { recursive: true });

export class LastFMCache {
  private db: Database.Database;
  // Prepared statements for performance (reuse instead of creating each time)
  private stmtGetEvaluationResult: Database.Statement;
  private stmtSetEvaluationResult: Database.Statement;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initSchema();
    // Prepare statements once for reuse
    this.stmtGetEvaluationResult = this.db.prepare(`
      SELECT baseline_pos, improved_pos, baseline_found, improved_found,
             baseline_ndcg, improved_ndcg, failure_mode, duplicate_count,
             improved_top_ids, baseline_top_ids
      FROM evaluation_result_cache
      WHERE result_hash = ?
    `);
    this.stmtSetEvaluationResult = this.db.prepare(`
      INSERT OR REPLACE INTO evaluation_result_cache (
        result_hash, track, artist, album, mbid,
        baseline_pos, improved_pos, baseline_found, improved_found,
        baseline_ndcg, improved_ndcg, failure_mode, duplicate_count, search_config,
        improved_top_ids, baseline_top_ids
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  private initSchema() {
    // Scrobbles table - accumulates over time
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scrobbles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        mbid TEXT,
        timestamp TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, track, artist, timestamp)
      );
      
      CREATE INDEX IF NOT EXISTS idx_scrobbles_username ON scrobbles(username);
      CREATE INDEX IF NOT EXISTS idx_scrobbles_mbid ON scrobbles(mbid);
      CREATE INDEX IF NOT EXISTS idx_scrobbles_timestamp ON scrobbles(timestamp DESC);
    `);

    // MBID lookups cache - avoid re-fetching MBIDs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mbid_cache (
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        mbid TEXT,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (track, artist)
      );
      
      CREATE INDEX IF NOT EXISTS idx_mbid_cache_mbid ON mbid_cache(mbid);
    `);

    // MusicBrainz search results cache - avoid re-searching same queries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mb_search_cache (
        query_hash TEXT PRIMARY KEY,
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        results TEXT NOT NULL, -- JSON array of search results
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_mb_search_track_artist ON mb_search_cache(track, artist);
    `);

    // MBID validation cache - avoid re-validating same MBIDs
    // Since evaluation has no time constraints, we can cache validation results
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mbid_validation_cache (
        mbid TEXT PRIMARY KEY,
        is_valid INTEGER NOT NULL, -- 1 = valid, 0 = invalid
        validated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        http_status INTEGER, -- Store HTTP status for debugging
        error_message TEXT, -- Store error details if any
        canonical_mbid TEXT -- If 301 redirect, the target MBID
      );

      CREATE INDEX IF NOT EXISTS idx_mbid_validation_valid ON mbid_validation_cache(is_valid);
    `);

    // Add canonical_mbid column (non-destructive migration)
    try {
      this.db.exec(`ALTER TABLE mbid_validation_cache ADD COLUMN canonical_mbid TEXT`);
    } catch (_) { /* column already exists */ }

    // Evaluation result cache - cache final evaluation results per scrobble+config
    // Key: hash of (track, artist, album, mbid, searchConfig)
    // This makes re-runs truly instant when nothing has changed
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS evaluation_result_cache (
        result_hash TEXT PRIMARY KEY,
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        mbid TEXT NOT NULL,
        baseline_pos INTEGER NOT NULL,
        improved_pos INTEGER NOT NULL,
        baseline_found INTEGER NOT NULL, -- 1 = found, 0 = not found
        improved_found INTEGER NOT NULL,
        baseline_ndcg REAL NOT NULL,
        improved_ndcg REAL NOT NULL,
        failure_mode TEXT,
        duplicate_count INTEGER,
        search_config TEXT NOT NULL, -- JSON of search config for cache invalidation
        evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_eval_result_track_artist ON evaluation_result_cache(track, artist);
      CREATE INDEX IF NOT EXISTS idx_eval_result_mbid ON evaluation_result_cache(mbid);
    `);

    // Add top-ID columns for work-equivalence checks (non-destructive migration)
    try {
      this.db.exec(`ALTER TABLE evaluation_result_cache ADD COLUMN improved_top_ids TEXT`);
    } catch (_) { /* column already exists */ }
    try {
      this.db.exec(`ALTER TABLE evaluation_result_cache ADD COLUMN baseline_top_ids TEXT`);
    } catch (_) { /* column already exists */ }

    // Track correction cache - cache Last.fm track corrections
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS track_correction_cache (
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        corrected_track TEXT,
        corrected_artist TEXT,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (track, artist)
      );
      
      CREATE INDEX IF NOT EXISTS idx_track_correction_corrected ON track_correction_cache(corrected_track, corrected_artist);
    `);

    // Artist info cache - cache Last.fm artist information (MBID, aliases)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artist_info_cache (
        artist TEXT PRIMARY KEY,
        mbid TEXT,
        aliases_json TEXT, -- JSON array of aliases
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Album info cache - cache Last.fm album information (MBID)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS album_info_cache (
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        mbid TEXT,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (artist, album)
      );
    `);

    // Loved tracks table - accumulates over time
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS loved_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        mbid TEXT,
        date TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, track, artist)
      );
      
      CREATE INDEX IF NOT EXISTS idx_loved_tracks_username ON loved_tracks(username);
      CREATE INDEX IF NOT EXISTS idx_loved_tracks_mbid ON loved_tracks(mbid);
      CREATE INDEX IF NOT EXISTS idx_loved_tracks_date ON loved_tracks(date DESC);
    `);

    // Recording work cache - maps recording MBIDs to their work IDs
    // Used for disambiguation: two recordings of the same work are equivalent
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recording_work_cache (
        recording_mbid TEXT PRIMARY KEY,
        work_id TEXT, -- null = no work relation found
        work_title TEXT,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Non-destructive migration: add mbid_source columns to track MBID provenance.
    // Prevents ground-truth circularity: only MBIDs from independent sources
    // (lastfm_track_info, lastfm_search, track_data) are safe for eval ground truth.
    // MBIDs from "musicbrainz_search" are circular and must be excluded.
    try {
      this.db.exec(`ALTER TABLE scrobbles ADD COLUMN mbid_source TEXT`);
    } catch (_) { /* column already exists */ }
    try {
      this.db.exec(`ALTER TABLE mbid_cache ADD COLUMN mbid_source TEXT`);
    } catch (_) { /* column already exists */ }
  }

  /**
   * Get scrobbles for a user, up to limit
   * Returns most recent first
   */
  getScrobbles(username: string, limit: number): Array<{
    track: string;
    artist: string;
    album?: string;
    mbid: string | null;
    mbid_source: string | null;
    timestamp: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT track, artist, album, mbid, mbid_source, timestamp
      FROM scrobbles
      WHERE username = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(username, limit) as Array<{
      track: string;
      artist: string;
      album?: string;
      mbid: string | null;
      mbid_source: string | null;
      timestamp: string;
    }>;
  }

  /**
   * Get loved tracks for a user, up to limit
   * Returns most recent first (by date added)
   */
  getLovedTracks(username: string, limit: number): Array<{
    track: string;
    artist: string;
    mbid: string | null;
    date: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT track, artist, mbid, date
      FROM loved_tracks
      WHERE username = ?
      ORDER BY date DESC
      LIMIT ?
    `);
    return stmt.all(username, limit) as Array<{
      track: string;
      artist: string;
      mbid: string | null;
      date: string;
    }>;
  }

  /**
   * Add loved tracks (idempotent - ignores duplicates)
   */
  addLovedTracks(
    username: string,
    tracks: Array<{
      track: string;
      artist: string;
      mbid: string | null;
      date: string;
    }>
  ): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO loved_tracks (username, track, artist, mbid, date)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    let added = 0;
    const insert = this.db.transaction((tracks) => {
      for (const t of tracks) {
        const info = stmt.run(username, t.track, t.artist, t.mbid || null, t.date);
        if (info.changes > 0) added++;
      }
    });
    
    insert(tracks);
    return added;
  }

  /**
   * Get count of scrobbles for a user
   */
  getScrobbleCount(username: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM scrobbles
      WHERE username = ?
    `);
    const result = stmt.get(username) as { count: number };
    return result.count;
  }

  /**
   * Add scrobbles (idempotent - ignores duplicates).
   * Now accepts optional mbid_source for provenance tracking.
   */
  addScrobbles(
    username: string,
    scrobbles: Array<{
      track: string;
      artist: string;
      album?: string;
      mbid: string | null;
      mbid_source?: string | null;
      timestamp: string;
    }>
  ): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO scrobbles (username, track, artist, album, mbid, mbid_source, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let added = 0;
    const insert = this.db.transaction((scrobbles) => {
      for (const s of scrobbles) {
        const info = stmt.run(username, s.track, s.artist, s.album || null, s.mbid || null, s.mbid_source || null, s.timestamp);
        if (info.changes > 0) added++;
      }
    });

    insert(scrobbles);
    return added;
  }

  /**
   * Get MBID from cache
   */
  getMBID(track: string, artist: string): string | null | undefined {
    const stmt = this.db.prepare(`
      SELECT mbid FROM mbid_cache WHERE track = ? AND artist = ?
    `);
    const result = stmt.get(track, artist) as { mbid: string | null } | undefined;
    return result?.mbid;
  }

  /**
   * Cache MBID lookup (null means we tried and it doesn't exist)
   */
  setMBID(track: string, artist: string, mbid: string | null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mbid_cache (track, artist, mbid)
      VALUES (?, ?, ?)
    `);
    stmt.run(track, artist, mbid);
  }

  /**
   * Get MBID with source provenance from cache.
   * Returns undefined if not cached.
   */
  getMBIDWithSource(track: string, artist: string): { mbid: string | null; source: string | null } | undefined {
    const stmt = this.db.prepare(`
      SELECT mbid, mbid_source FROM mbid_cache WHERE track = ? AND artist = ?
    `);
    const result = stmt.get(track, artist) as { mbid: string | null; mbid_source: string | null } | undefined;
    if (result === undefined) return undefined;
    return { mbid: result.mbid, source: result.mbid_source };
  }

  /**
   * Cache MBID lookup with source provenance.
   */
  setMBIDWithSource(track: string, artist: string, mbid: string | null, source: string | null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mbid_cache (track, artist, mbid, mbid_source)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(track, artist, mbid, source);
  }

  /**
   * Get cached Last.fm track correction.
   * - undefined: not cached
   * - null: cached "no correction"
   * - object: corrected values
   */
  getTrackCorrection(
    track: string,
    artist: string
  ): { correctedTrack: string; correctedArtist: string } | null | undefined {
    const stmt = this.db.prepare(`
      SELECT corrected_track, corrected_artist
      FROM track_correction_cache
      WHERE track = ? AND artist = ?
    `);
    const row = stmt.get(track, artist) as
      | { corrected_track: string | null; corrected_artist: string | null }
      | undefined;
    if (!row) return undefined;
    if (!row.corrected_track || !row.corrected_artist) return null;
    return { correctedTrack: row.corrected_track, correctedArtist: row.corrected_artist };
  }

  setTrackCorrection(
    track: string,
    artist: string,
    correctedTrack: string | null,
    correctedArtist: string | null
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO track_correction_cache (track, artist, corrected_track, corrected_artist)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(track, artist, correctedTrack, correctedArtist);
  }

  /**
   * Get cached Last.fm artist info.
   * - undefined: not cached
   * - null: cached "no info"
   * - object: info
   */
  getArtistInfo(artist: string): { mbid: string | null; aliases?: string[] } | null | undefined {
    const stmt = this.db.prepare(`
      SELECT mbid, aliases_json
      FROM artist_info_cache
      WHERE artist = ?
    `);
    const row = stmt.get(artist) as { mbid: string | null; aliases_json: string | null } | undefined;
    if (!row) return undefined;
    if (!row.mbid && !row.aliases_json) return null;
    let aliases: string[] | undefined;
    if (row.aliases_json) {
      try {
        const parsed = JSON.parse(row.aliases_json);
        if (Array.isArray(parsed)) aliases = parsed.filter((x) => typeof x === "string");
      } catch {
        // ignore parse errors; treat as no aliases
      }
    }
    return { mbid: row.mbid, aliases };
  }

  setArtistInfo(artist: string, info: { mbid: string | null; aliases?: string[] } | null): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO artist_info_cache (artist, mbid, aliases_json)
      VALUES (?, ?, ?)
    `);
    if (!info) {
      stmt.run(artist, null, null);
      return;
    }
    stmt.run(artist, info.mbid, info.aliases ? JSON.stringify(info.aliases) : null);
  }

  /**
   * Get cached Last.fm album info.
   * - undefined: not cached
   * - null: cached "no info"
   * - object: info
   */
  getAlbumInfo(artist: string, album: string): { mbid: string | null } | null | undefined {
    const stmt = this.db.prepare(`
      SELECT mbid
      FROM album_info_cache
      WHERE artist = ? AND album = ?
    `);
    const row = stmt.get(artist, album) as { mbid: string | null } | undefined;
    if (!row) return undefined;
    if (!row.mbid) return null;
    return { mbid: row.mbid };
  }

  setAlbumInfo(artist: string, album: string, info: { mbid: string | null } | null): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO album_info_cache (artist, album, mbid)
      VALUES (?, ?, ?)
    `);
    stmt.run(artist, album, info?.mbid ?? null);
  }

  /**
   * Get cached MusicBrainz search results
   * Cache key includes search configuration to ensure idempotency across config changes
   */
  /**
   * Get cached MusicBrainz search results.
   * Cache key is (track, artist, album, strategy) -- the actual API query params.
   * Config flags are NOT part of the key; the caller passes already-cleaned values.
   * Legacy overload accepts extra boolean flags (ignored in hash).
   */
  getSearchResults(
    track: string,
    artist: string,
    album?: string,
    _enableCleaning?: boolean,
    _enableFuzzy?: boolean,
    _enableMultiStage?: boolean,
    strategy?: string
  ): any[] | null {
    const queryHash = this.hashSearchQuery(track, artist, album, strategy);
    const stmt = this.db.prepare(`
      SELECT results FROM mb_search_cache WHERE query_hash = ?
    `);
    const result = stmt.get(queryHash) as { results: string } | undefined;
    if (result) {
      return JSON.parse(result.results);
    }
    return null;
  }

  /**
   * Cache MusicBrainz search results.
   * Key: (track, artist, album, strategy) -- the actual values sent to MB API.
   */
  setSearchResults(
    track: string,
    artist: string,
    album: string | undefined,
    results: any[],
    _enableCleaning?: boolean,
    _enableFuzzy?: boolean,
    _enableMultiStage?: boolean,
    strategy?: string
  ) {
    const queryHash = this.hashSearchQuery(track, artist, album, strategy);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mb_search_cache (query_hash, track, artist, album, results)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(queryHash, track, artist, album || null, JSON.stringify(results));
  }

  /**
   * Hash search query for cache key.
   * Key is (track, artist, album, strategy) -- the actual MB API request params.
   * This means changing pipeline logic (adding/removing stages) doesn't invalidate
   * cached per-stage API responses, only the "combined" final result.
   */
  private hashSearchQuery(
    track: string,
    artist: string,
    album?: string,
    strategy?: string
  ): string {

    const normalizedTrack = (track || "").toLowerCase().trim();
    const normalizedArtist = (artist || "").toLowerCase().trim();
    const normalizedAlbum = (album || "").toLowerCase().trim();
    const stratStr = strategy || "default";
    const str = `${normalizedTrack}|${normalizedArtist}|${normalizedAlbum}|${stratStr}`;
    return createHash("md5").update(str).digest("hex");
  }

  /**
   * Get MBID validation result from cache (boolean only, for backward compat)
   */
  getMBIDValidation(mbid: string): boolean | undefined {
    const stmt = this.db.prepare(`
      SELECT is_valid FROM mbid_validation_cache WHERE mbid = ?
    `);
    const result = stmt.get(mbid) as { is_valid: number } | undefined;
    return result !== undefined ? result.is_valid === 1 : undefined;
  }

  /**
   * Get MBID validation result with HTTP status (for distinguishing confirmed vs assumed)
   */
  getMBIDValidationDetailed(mbid: string): { isValid: boolean; httpStatus: number | null } | undefined {
    const stmt = this.db.prepare(`
      SELECT is_valid, http_status FROM mbid_validation_cache WHERE mbid = ?
    `);
    const result = stmt.get(mbid) as { is_valid: number; http_status: number | null } | undefined;
    if (result === undefined) return undefined;
    return { isValid: result.is_valid === 1, httpStatus: result.http_status };
  }

  /**
   * Get MBID validation stats by HTTP status (for diagnostics)
   */
  getMBIDValidationStats(): Array<{ http_status: number | null; count: number; is_valid: number }> {
    return this.db.prepare(`
      SELECT http_status, is_valid, COUNT(*) as count
      FROM mbid_validation_cache
      GROUP BY http_status, is_valid
      ORDER BY count DESC
    `).all() as Array<{ http_status: number | null; count: number; is_valid: number }>;
  }

  /**
   * Count stale validation entries (503/error that need re-validation)
   */
  countStaleValidations(): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM mbid_validation_cache
      WHERE http_status IS NULL OR http_status NOT IN (200, 301, 404)
    `).get() as { count: number };
    return result.count;
  }

  /**
   * Clear stale validation entries (503/error) so they get re-validated
   */
  clearStaleValidations(): number {
    const result = this.db.prepare(`
      DELETE FROM mbid_validation_cache
      WHERE http_status IS NULL OR http_status NOT IN (200, 301, 404)
    `).run();
    return result.changes;
  }

  /**
   * Cache MBID validation result
   */
  setMBIDValidation(mbid: string, isValid: boolean, httpStatus?: number, errorMessage?: string, canonicalMbid?: string) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mbid_validation_cache (mbid, is_valid, http_status, error_message, canonical_mbid)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(mbid, isValid ? 1 : 0, httpStatus || null, errorMessage || null, canonicalMbid || null);
  }

  /**
   * Get the canonical MBID for a potentially-merged recording.
   * Returns the canonical ID if a 301 redirect was followed, otherwise the input MBID.
   */
  getCanonicalMBID(mbid: string): string {
    const stmt = this.db.prepare(`
      SELECT canonical_mbid FROM mbid_validation_cache WHERE mbid = ?
    `);
    const result = stmt.get(mbid) as { canonical_mbid: string | null } | undefined;
    return result?.canonical_mbid || mbid;
  }

  /** Check if this MBID has been merge-checked (canonical_mbid stored, even if self-referencing) */
  hasMergeCheckResult(mbid: string): boolean {
    const stmt = this.db.prepare(`
      SELECT canonical_mbid FROM mbid_validation_cache WHERE mbid = ?
    `);
    const result = stmt.get(mbid) as { canonical_mbid: string | null } | undefined;
    return result?.canonical_mbid != null;
  }

  /**
   * Get statistics
   */
  getStats(username: string): {
    totalScrobbles: number;
    scrobblesWithMBID: number;
    cachedMBIDs: number;
    cachedSearches: number;
    cachedValidations: number;
    cachedEvaluationResults: number;
  } {
    const scrobbleCount = this.getScrobbleCount(username);
    const withMBID = this.db
      .prepare(`SELECT COUNT(*) as count FROM scrobbles WHERE username = ? AND mbid IS NOT NULL`)
      .get(username) as { count: number };
    
    const mbidCacheCount = this.db
      .prepare(`SELECT COUNT(*) as count FROM mbid_cache`)
      .get() as { count: number };
    
    const searchCacheCount = this.db
      .prepare(`SELECT COUNT(*) as count FROM mb_search_cache`)
      .get() as { count: number };

    const validationCacheCount = this.db
      .prepare(`SELECT COUNT(*) as count FROM mbid_validation_cache`)
      .get() as { count: number };

    const evaluationResultCacheCount = this.db
      .prepare(`SELECT COUNT(*) as count FROM evaluation_result_cache`)
      .get() as { count: number };

    return {
      totalScrobbles: scrobbleCount,
      scrobblesWithMBID: withMBID.count,
      cachedMBIDs: mbidCacheCount.count,
      cachedSearches: searchCacheCount.count,
      cachedValidations: validationCacheCount.count,
      cachedEvaluationResults: evaluationResultCacheCount.count,
    };
  }

  /**
   * Hash evaluation case for cache key
   * Includes track, artist, album, mbid, and search config
   * Uses same normalization as hashQuery for consistency
   */
  private hashEvaluationCase(
    track: string,
    artist: string,
    album: string | undefined,
    mbid: string,
    searchConfig: { enableCleaning: boolean; enableFuzzy: boolean; enableMultiStage: boolean },
    fieldCombination: string
  ): string {

    // Use same normalization as hashQuery for consistency
    const normalizedTrack = (track || "").toLowerCase().trim();
    const normalizedArtist = (artist || "").toLowerCase().trim();
    const normalizedAlbum = (album || "").toLowerCase().trim();
    const normalizedMBID = (mbid || "").toLowerCase().trim();
    const configStr = `${searchConfig.enableCleaning ? "1" : "0"}|${searchConfig.enableFuzzy ? "1" : "0"}|${searchConfig.enableMultiStage ? "1" : "0"}`;
    // Include fieldCombination in hash to distinguish track-only vs track+artist
    const str = `${normalizedTrack}|${normalizedArtist}|${normalizedAlbum}|${normalizedMBID}|${configStr}|${fieldCombination}|${EVALUATION_LOGIC_VERSION}`;
    return createHash("md5").update(str).digest("hex");
  }

  /**
   * Get cached evaluation result
   * Returns null if not cached
   */
  getEvaluationResult(
    track: string,
    artist: string,
    album: string | undefined,
    mbid: string,
    searchConfig: { enableCleaning: boolean; enableFuzzy: boolean; enableMultiStage: boolean },
    fieldCombination: string
  ): {
    baselinePos: number;
    improvedPos: number;
    baselineFound: boolean;
    improvedFound: boolean;
    baselineNDCG: number;
    improvedNDCG: number;
    failureMode?: string;
    duplicateCount?: number;
    improvedTopIds?: string[];
    baselineTopIds?: string[];
  } | null {
    try {
      const resultHash = this.hashEvaluationCase(track, artist, album, mbid, searchConfig, fieldCombination);
      const result = this.stmtGetEvaluationResult.get(resultHash) as {
        baseline_pos: number;
        improved_pos: number;
        baseline_found: number;
        improved_found: number;
        baseline_ndcg: number;
        improved_ndcg: number;
        failure_mode: string | null;
        duplicate_count: number | null;
        improved_top_ids: string | null;
        baseline_top_ids: string | null;
      } | undefined;

      if (result) {
        return {
          baselinePos: result.baseline_pos,
          improvedPos: result.improved_pos,
          baselineFound: result.baseline_found === 1,
          improvedFound: result.improved_found === 1,
          baselineNDCG: result.baseline_ndcg,
          improvedNDCG: result.improved_ndcg,
          failureMode: result.failure_mode ?? undefined,
          duplicateCount: result.duplicate_count ?? undefined,
          improvedTopIds: result.improved_top_ids ? JSON.parse(result.improved_top_ids) : undefined,
          baselineTopIds: result.baseline_top_ids ? JSON.parse(result.baseline_top_ids) : undefined,
        };
      }
      return null;
    } catch (error) {
      // If cache read fails, return null (graceful degradation)
      console.warn(`Cache read error for evaluation result: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Cache evaluation result
   */
  setEvaluationResult(
    track: string,
    artist: string,
    album: string | undefined,
    mbid: string,
    searchConfig: { enableCleaning: boolean; enableFuzzy: boolean; enableMultiStage: boolean },
    result: {
      baselinePos: number;
      improvedPos: number;
      baselineFound: boolean;
      improvedFound: boolean;
      baselineNDCG: number;
      improvedNDCG: number;
      failureMode?: string;
      duplicateCount?: number;
      improvedTopIds?: string[];
      baselineTopIds?: string[];
    },
    fieldCombination: string
  ) {
    try {
      const resultHash = this.hashEvaluationCase(track, artist, album, mbid, searchConfig, fieldCombination);
      this.stmtSetEvaluationResult.run(
        resultHash,
        track,
        artist,
        album || null,
        mbid,
        result.baselinePos,
        result.improvedPos,
        result.baselineFound ? 1 : 0,
        result.improvedFound ? 1 : 0,
        result.baselineNDCG,
        result.improvedNDCG,
        result.failureMode ?? null,
        result.duplicateCount ?? null,
        JSON.stringify(searchConfig),
        result.improvedTopIds ? JSON.stringify(result.improvedTopIds) : null,
        result.baselineTopIds ? JSON.stringify(result.baselineTopIds) : null,
      );
    } catch (error) {
      // If cache write fails, log warning but don't fail evaluation
      console.warn(`Cache write error for evaluation result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear evaluation result cache (useful when search logic changes)
   */
  clearEvaluationResultCache() {
    try {
      const stmt = this.db.prepare(`DELETE FROM evaluation_result_cache`);
      stmt.run();
    } catch (error) {
      console.warn(`Error clearing evaluation result cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get cached work ID for a recording MBID
   */
  getRecordingWork(recordingMbid: string): { workId: string | null; workTitle: string | null } | undefined {
    const result = this.db.prepare(`
      SELECT work_id, work_title FROM recording_work_cache WHERE recording_mbid = ?
    `).get(recordingMbid) as { work_id: string | null; work_title: string | null } | undefined;
    if (result === undefined) return undefined;
    return { workId: result.work_id, workTitle: result.work_title };
  }

  /**
   * Cache recording -> work mapping
   */
  setRecordingWork(recordingMbid: string, workId: string | null, workTitle: string | null) {
    this.db.prepare(`
      INSERT OR REPLACE INTO recording_work_cache (recording_mbid, work_id, work_title)
      VALUES (?, ?, ?)
    `).run(recordingMbid, workId, workTitle);
  }

  close() {
    this.db.close();
  }
}


