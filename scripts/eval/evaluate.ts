#!/usr/bin/env node
/**
 * Evaluate MusicBrainz matching using Last.fm scrobbles
 *
 * PURPOSE:
 * - Measure if improved matching (cleaning + multi-stage) finds correct MBIDs better than baseline
 * - Addresses original problem: "funny search string" and "song disambiguation is the hardest part"
 * - Tests real-world scenarios: featuring artists, remixes, live versions, typos
 *
 * Usage:
 *   pnpm tsx scripts/eval/evaluate.ts [--limit N] [--all] [--username USER] [--auth-only]
 *
 * Options:
 *   --limit N              Number of scrobbles to evaluate (default: 1000)
 *   --all                  Evaluate using all cached scrobbles for the user
 *   --username USER        Use public API for username (skips OAuth)
 *   --auth-only            Perform OAuth and cache the session key, then exit
 *   --no-cleaning          Disable name cleaning
 *   --no-fuzzy             Disable fuzzy matching
 *   --no-multistage        Disable multi-stage search
 *   --no-parallel          Disable parallel evaluation (parallel enabled by default)
 *   --concurrency N        Parallel concurrency (default: 5)
 *   --refresh-scrobbles    Force refresh cache (re-fetch scrobbles; still accumulates)
 *   --use-additional-apis  Allow extra API calls to backfill missing MBIDs (slower)
 *
 * Caching:
 *   SQLite cache at ~/.teal_eval_cache/lastfm_eval.db accumulates over time
 */

import { join } from "path";
import { config } from "dotenv";
import {
  type SearchConfig,
  type EvaluationCase,
  type MBIDSource,
  GROUND_TRUTH_SOURCES,
  MUSICBRAINZ_BASE_URL,
  USER_AGENT,
  RATE_LIMIT_DELAY,
  formatTime,
  calculateETA,
  createAPIMetrics,
} from "./types.js";
import { getLastFMSession } from "./auth.js";
import { getRecentTracks } from "./lastfm-api.js";
import { getTrackMBID, validateMBID, areRecordingsWorkEquivalent } from "./mbid-resolution.js";
import { baselineSearch, improvedSearchWithConfig } from "./search.js";
import { ndcg } from "./statistics.js";
import { categorizeFailureMode, classifyHardness, reportResults } from "./reporting.js";
import { LastFMCache } from "./evaluate-lastfm-cache.js";

// Load .env from repo root
const SCRIPT_DIR = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const envResult = config({ path: join(REPO_ROOT, ".env") });
if (envResult.error) {
  console.warn(`Warning: Could not load .env file: ${envResult.error.message}`);
  console.warn(`  Expected at: ${join(REPO_ROOT, ".env")}`);
  console.warn(`  Copy .env.template to .env and fill in your values.\n`);
}

// Proxy support: route all fetch calls through a proxy when PROXY_URL is set.
function setupProxy() {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`Proxy enabled: ${proxyUrl.replace(/\/\/[^@]+@/, "//***@")}`);
  } catch (e) {
    console.warn(`Proxy setup failed: ${e instanceof Error ? e.message : e}`);
    console.warn("Continuing without proxy.\n");
  }
}
setupProxy();

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_SECRET = process.env.LASTFM_API_SECRET;

const HAS_LASTFM_KEYS = !!(LASTFM_API_KEY && LASTFM_API_SECRET);
if (!HAS_LASTFM_KEYS) {
  console.warn("Warning: LASTFM_API_KEY/LASTFM_API_SECRET not found in environment");
  console.warn("Will attempt to run from cached scrobbles only.\n");
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  const limitArg = args.findIndex((a) => a === "--limit");
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) || 1000 : 1000;
  const useAll = args.includes("--all");
  const authOnly = args.includes("--auth-only");

  const cache = new LastFMCache();

  const usernameArg = args.findIndex((a) => a === "--username");
  const username = usernameArg >= 0 ? args[usernameArg + 1] : undefined;

  const apiMetrics = createAPIMetrics();

  // Feature flags
  const noCleaning = args.includes("--no-cleaning");
  const noFuzzy = args.includes("--no-fuzzy");
  const noMultiStage = args.includes("--no-multistage");
  const parallel = !args.includes("--no-parallel");
  const concurrency = parallel
    ? (args.findIndex((a) => a === "--concurrency") >= 0
      ? parseInt(args[args.findIndex((a) => a === "--concurrency") + 1]) || 5
      : 5)
    : 1;
  const useAdditionalAPIs = args.includes("--use-additional-apis");

  const searchConfig: SearchConfig = {
    enableCleaning: !noCleaning,
    enableFuzzy: !noFuzzy,
    enableMultiStage: !noMultiStage,
  };

  console.log("=".repeat(60));
  console.log("MusicBrainz Matching Evaluation");
  console.log("=".repeat(60));
  console.log();

  if (noCleaning || noFuzzy || noMultiStage || parallel || useAdditionalAPIs || useAll) {
    console.log("CONFIGURATION:");
    console.log(`  Cleaning: ${searchConfig.enableCleaning ? "enabled" : "disabled"}`);
    console.log(`  Fuzzy matching: ${searchConfig.enableFuzzy ? "enabled" : "disabled"}`);
    console.log(`  Multi-stage: ${searchConfig.enableMultiStage ? "enabled" : "disabled"}`);
    if (parallel) {
      console.log(`  Parallel: enabled (concurrency: ${concurrency})`);
    } else {
      console.log(`  Parallel: disabled (--no-parallel)`);
    }
    if (useAdditionalAPIs) {
      console.log(`  Additional APIs: enabled (MusicBrainz ISRC lookup for MBID resolution)`);
    }
    if (useAll) {
      console.log(`  Dataset: all cached scrobbles`);
    }
    console.log();
  }

  // ── Scrobble types (with provenance) ──────────────────────────────

  let scrobbles: Array<{
    track: string;
    artist: string;
    album?: string;
    mbid: string | null;
    mbid_source: MBIDSource | null;
  }> = [];

  let validScrobbles: typeof scrobbles = [];

  // ── Authentication ────────────────────────────────────────────────

  let sessionKey: string | undefined;
  let targetUsername = username;

  if (HAS_LASTFM_KEYS) {
    if (!username) {
      console.log("No username provided - using OAuth authentication\n");
      try {
        sessionKey = await getLastFMSession(LASTFM_API_KEY!, LASTFM_API_SECRET!);
      } catch (error: unknown) {
        console.error(`\n  OAuth Error: ${error instanceof Error ? error.message : String(error)}`);
        console.log("\nTo use public API instead, set LASTFM_USERNAME in .env or use --username USER");
        process.exit(1);
      }
    } else {
      console.log(`Using public API for username: ${username}\n`);
    }

    if (authOnly) {
      console.log("\nAuthenticated. Session key is cached locally.");
      cache.close();
      return;
    }

    if (sessionKey && !targetUsername) {
      console.log("Using authenticated session (no username lookup needed)...");
      targetUsername = "";
    }
  } else {
    if (authOnly) {
      console.error("Error: --auth-only requires LASTFM_API_KEY and LASTFM_API_SECRET");
      process.exit(1);
    }
    targetUsername = targetUsername || "authenticated";
    console.log(`Running in cache-only mode (no Last.fm API keys). Using cached user: "${targetUsername}"\n`);
  }

  if (!targetUsername && !sessionKey) {
    throw new Error("No username available. Provide --username or authenticate via OAuth.");
  }

  const cacheUsername = targetUsername || (sessionKey ? "authenticated" : "");

  // Show cache stats
  const stats = cache.getStats(cacheUsername);
  console.log("CACHE STATS (All accumulate over time, never cleared):");
  console.log(`  Total scrobbles: ${stats.totalScrobbles}`);
  console.log(`  With MBIDs: ${stats.scrobblesWithMBID}`);
  console.log(`  Cached MBID lookups: ${stats.cachedMBIDs}`);
  console.log(`  Cached MusicBrainz searches: ${stats.cachedSearches}`);
  console.log(`  Cached MBID validations: ${stats.cachedValidations}\n`);

  const desiredLimit = useAll ? stats.totalScrobbles : limit;

  // ── Fetch scrobbles ───────────────────────────────────────────────

  const cachedScrobbles = cache.getScrobbles(cacheUsername, desiredLimit);
  const refresh = args.includes("--refresh-scrobbles");

  let fromCache = 0;
  let fetched = 0;
  let added = 0;

  if (!refresh && cachedScrobbles.length >= desiredLimit) {
    scrobbles = cachedScrobbles.slice(0, desiredLimit).map((s) => ({
      track: s.track,
      artist: s.artist,
      album: s.album,
      mbid: s.mbid,
      mbid_source: (s.mbid_source as MBIDSource) || null,
    }));
    fromCache = scrobbles.length;
    console.log(`Using ${fromCache} scrobbles from cache (${stats.totalScrobbles} total available)\n`);
  } else {
    if (!HAS_LASTFM_KEYS) {
      if (cachedScrobbles.length > 0) {
        console.warn(`Only ${cachedScrobbles.length} cached scrobbles available (requested ${desiredLimit}).`);
        console.log(`Falling back to ${cachedScrobbles.length} cached scrobbles (no Last.fm API keys).\n`);
        scrobbles = cachedScrobbles.map((s) => ({
          track: s.track,
          artist: s.artist,
          album: s.album,
          mbid: s.mbid,
          mbid_source: (s.mbid_source as MBIDSource) || null,
        }));
        fromCache = scrobbles.length;
      } else {
        console.error("Error: No cached scrobbles and no Last.fm API keys. Set LASTFM_API_KEY and LASTFM_API_SECRET.");
        process.exit(1);
      }
    } else {
      const needCount = useAll
        ? Number.MAX_SAFE_INTEGER
        : (refresh ? desiredLimit : Math.max(0, desiredLimit - cachedScrobbles.length));

      if (needCount > 0) {
        if (refresh) {
          console.log(`Fetching ${needCount} fresh scrobbles (--refresh flag)...\n`);
        } else {
          console.log(`Fetching ${needCount} additional scrobbles (${cachedScrobbles.length} already cached)...\n`);
        }

        const pagesNeeded = useAll ? Number.MAX_SAFE_INTEGER : Math.ceil(needCount / 200);
        const allTracks: Array<{
          name: string;
          artist: { "#text": string; mbid?: string };
          album?: { "#text": string };
          mbid?: string;
          "@attr"?: { nowplaying?: string };
          date?: { "#text": string; uts: string };
        }> = [];

        const fetchStartTime = Date.now();
        for (let page = 1; page <= pagesNeeded && allTracks.length < needCount; page++) {
          const pageLimit = Math.min(200, needCount - allTracks.length);
          const pageStartTime = Date.now();
          const pageTracks = await getRecentTracks(
            LASTFM_API_KEY!,
            LASTFM_API_SECRET!,
            targetUsername || "",
            pageLimit,
            sessionKey,
            page,
          );
          if (useAll && pageTracks.length === 0) break;
          allTracks.push(...pageTracks);
          fetched += pageTracks.length;

          const pageElapsed = Date.now() - pageStartTime;
          const totalElapsed = Date.now() - fetchStartTime;
          const avgTimePerPage = totalElapsed / page;
          const remainingPages = useAll ? 0 : (pagesNeeded - page);
          const etaMs = avgTimePerPage * remainingPages;

          if (!useAll) {
            console.log(`  Page ${page}/${pagesNeeded}: ${fetched}/${needCount} scrobbles (${formatTime(pageElapsed)}, ETA: ${formatTime(etaMs)})`);
          } else if (page % 25 === 0) {
            console.log(`  Page ${page}: fetched=${fetched} (${formatTime(pageElapsed)})`);
          }

          if (page < pagesNeeded) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        const fetchElapsed = Date.now() - fetchStartTime;
        console.log(`Downloaded ${fetched} scrobbles in ${formatTime(fetchElapsed)}\n`);

        // ── Resolve MBIDs with provenance tracking ──────────────────

        if (sessionKey) {
          console.log("Resolving MBIDs (using cache + parallel fetching)...");

          const scrobblesToAdd: Array<{
            track: string;
            artist: string;
            album?: string;
            mbid: string | null;
            mbid_source: MBIDSource | null;
            timestamp: string;
          }> = [];

          // First pass: check cache and extract from track data
          // FIX: Only use track.mbid (recording MBID), NOT track.artist.mbid
          // The artist MBID is NOT a recording MBID -- using it would store wrong data.
          const tracksNeedingMBID: Array<{
            track: typeof allTracks[0];
            mbid: string | null;
            mbid_source: MBIDSource | null;
          }> = [];
          let cacheHits = 0;

          for (const track of allTracks) {
            // Check provenance-aware cache first
            const cached = cache.getMBIDWithSource(track.name, track.artist["#text"]);

            if (cached !== undefined) {
              cacheHits++;
              tracksNeedingMBID.push({
                track,
                mbid: cached.mbid,
                mbid_source: (cached.source as MBIDSource) || null,
              });
            } else if (track.mbid) {
              // Track's own MBID (from Last.fm scrobble data) -- independent ground truth
              cache.setMBIDWithSource(track.name, track.artist["#text"], track.mbid, "track_data");
              tracksNeedingMBID.push({ track, mbid: track.mbid, mbid_source: "track_data" });
            } else {
              tracksNeedingMBID.push({ track, mbid: null, mbid_source: null });
            }
          }

          if (cacheHits > 0) {
            console.log(`  ${cacheHits}/${allTracks.length} MBIDs found in cache`);
          }

          const alreadyHaveMBID = tracksNeedingMBID.filter((t) => t.mbid).length;
          const needMBID = tracksNeedingMBID.filter((t) => !t.mbid);

          console.log(`  ${alreadyHaveMBID}/${allTracks.length} have MBIDs (from cache or track data)`);

          if (needMBID.length > 0) {
            console.log(`  Fetching MBIDs for ${needMBID.length} tracks in parallel (concurrency: ${concurrency})...`);
            if (useAdditionalAPIs) {
              console.log(`  Additional APIs enabled: MusicBrainz ISRC lookup (fallback if Last.fm fails)`);
            }

            const mbidChunks: Array<typeof needMBID> = [];
            for (let i = 0; i < needMBID.length; i += concurrency) {
              mbidChunks.push(needMBID.slice(i, i + concurrency));
            }

            const mbidFetchStartTime = Date.now();
            for (let chunkIdx = 0; chunkIdx < mbidChunks.length; chunkIdx++) {
              const chunk = mbidChunks[chunkIdx];
              const chunkStartTime = Date.now();
              const mbidPromises = chunk.map(async (item) => {
                const result = await getTrackMBID(
                  item.track.name,
                  item.track.artist["#text"],
                  LASTFM_API_KEY!,
                  LASTFM_API_SECRET!,
                  sessionKey!,
                  cache,
                  useAdditionalAPIs,
                  apiMetrics,
                );
                return { ...item, mbid: result.mbid, mbid_source: result.source };
              });

              const results = await Promise.all(mbidPromises);
              for (const result of results) {
                const idx = tracksNeedingMBID.findIndex((t) => t.track === result.track);
                if (idx >= 0) {
                  tracksNeedingMBID[idx].mbid = result.mbid;
                  tracksNeedingMBID[idx].mbid_source = result.mbid_source;
                }
              }

              const chunkElapsed = Date.now() - chunkStartTime;
              const totalElapsed = Date.now() - mbidFetchStartTime;
              const fetchedCount = tracksNeedingMBID.filter((t) => t.mbid).length;

              if (chunkIdx % 5 === 0 || chunkIdx === mbidChunks.length - 1) {
                const avgTimePerChunk = totalElapsed / (chunkIdx + 1);
                const remainingChunks = mbidChunks.length - (chunkIdx + 1);
                const etaMs = avgTimePerChunk * remainingChunks;
                const progress = ((fetchedCount / allTracks.length) * 100).toFixed(1);
                console.log(`  Batch ${chunkIdx + 1}/${mbidChunks.length}: ${fetchedCount}/${allTracks.length} MBIDs (${progress}%, ${formatTime(chunkElapsed)}, ETA: ${formatTime(etaMs)})`);
              }

              if (chunkIdx < mbidChunks.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }

            const mbidFetchElapsed = Date.now() - mbidFetchStartTime;
            const finalFetched = tracksNeedingMBID.filter((t) => t.mbid).length;
            console.log(`  MBID resolution complete: ${finalFetched}/${allTracks.length} in ${formatTime(mbidFetchElapsed)}`);
          }

          // Convert to scrobbles format and add to cache (with provenance)
          for (const item of tracksNeedingMBID) {
            const timestamp = item.track.date?.["#text"] || new Date().toISOString();
            scrobblesToAdd.push({
              track: item.track.name,
              artist: item.track.artist["#text"],
              album: item.track.album?.["#text"],
              mbid: item.mbid || null,
              mbid_source: item.mbid_source || null,
              timestamp,
            });
          }

          added = cache.addScrobbles(cacheUsername, scrobblesToAdd);
          console.log(`  Added ${added} new scrobbles to cache (${scrobblesToAdd.length - added} were duplicates)\n`);

          const mbidCount = tracksNeedingMBID.filter((t) => t.mbid).length;
          console.log(`  ${mbidCount}/${allTracks.length} scrobbles have MBIDs (${(mbidCount / allTracks.length * 100).toFixed(1)}%)\n`);
        } else {
          // Public API path -- use track.mbid only (not artist MBID)
          const scrobblesToAdd = allTracks.map((track) => ({
            track: track.name,
            artist: track.artist["#text"],
            album: track.album?.["#text"],
            mbid: track.mbid || null,
            mbid_source: (track.mbid ? "track_data" : null) as MBIDSource | null,
            timestamp: track.date?.["#text"] || new Date().toISOString(),
          }));
          added = cache.addScrobbles(cacheUsername, scrobblesToAdd);
          console.log(`  Added ${added} new scrobbles to cache\n`);
        }
      }

      // Get final scrobbles from cache (now includes newly added)
      const finalScrobbles = cache.getScrobbles(cacheUsername, desiredLimit);
      scrobbles = finalScrobbles.map((s) => ({
        track: s.track,
        artist: s.artist,
        album: s.album,
        mbid: s.mbid,
        mbid_source: (s.mbid_source as MBIDSource) || null,
      }));
      fromCache = finalScrobbles.length;

      if (added > 0) {
        console.log(`Cache updated: ${added} new scrobbles added, ${fromCache} total available\n`);
      }
    } // end HAS_LASTFM_KEYS else
  }

  // ── Ground-truth filtering ────────────────────────────────────────
  // CRITICAL FIX: Only use MBIDs with ground-truth-safe provenance.
  // MBIDs obtained via MusicBrainz search are circular (we'd measure
  // whether search finds the same result that search found).

  console.log("Evaluating matching performance...\n");

  if (validScrobbles.length === 0) {
    validScrobbles = scrobbles.filter((s) => {
      if (!s.mbid) return false;
      // If we have provenance info, enforce ground-truth safety
      if (s.mbid_source) {
        return GROUND_TRUTH_SOURCES.has(s.mbid_source);
      }
      // Legacy data without provenance: allow (conservative -- these are
      // pre-existing cache entries from before provenance tracking)
      return true;
    });
  }

  if (validScrobbles.length === 0) {
    console.error("Error: No scrobbles with MBIDs found for evaluation");
    console.error("  For Last.fm: Ensure you're authenticated (OAuth) to get MBIDs");
    process.exit(1);
  }

  // ── MBID validation ───────────────────────────────────────────────

  if (useAdditionalAPIs && validScrobbles.length > 0) {
    console.log(`Validating ${validScrobbles.length} MBIDs against MusicBrainz (ensuring ground truth quality)...`);
    const validationStartTime = Date.now();
    let validatedCount = 0;
    let invalidCount = 0;

    const validationChunks: Array<typeof validScrobbles> = [];
    const validationConcurrency = 3;
    for (let i = 0; i < validScrobbles.length; i += validationConcurrency) {
      validationChunks.push(validScrobbles.slice(i, i + validationConcurrency));
    }

    const validScrobblesSet = new Set<typeof validScrobbles[0]>();

    for (let chunkIdx = 0; chunkIdx < validationChunks.length; chunkIdx++) {
      const chunk = validationChunks[chunkIdx];
      const validationPromises = chunk.map(async (s) => {
        const isValid = await validateMBID(s.mbid!, cache, apiMetrics);
        return { scrobble: s, isValid };
      });

      const results = await Promise.all(validationPromises);
      for (const result of results) {
        if (result.isValid) {
          validatedCount++;
          validScrobblesSet.add(result.scrobble);
        } else {
          invalidCount++;
        }
      }

      if (chunkIdx % 50 === 0 || chunkIdx === validationChunks.length - 1) {
        const progress = ((chunkIdx + 1) / validationChunks.length * 100).toFixed(1);
        console.log(`  Validated ${chunkIdx + 1}/${validationChunks.length} chunks (${progress}%): ${validatedCount} valid, ${invalidCount} invalid`);
      }
    }

    validScrobbles = Array.from(validScrobblesSet);

    const validationElapsed = Date.now() - validationStartTime;
    console.log(`MBID validation complete: ${validatedCount} valid, ${invalidCount} invalid (removed from evaluation) in ${formatTime(validationElapsed)}`);
    if (invalidCount > 0) {
      console.log(`  (Removed ${invalidCount} invalid MBIDs to ensure ground truth quality)\n`);
    } else {
      console.log();
    }
  }

  if (validScrobbles.length === 0 && scrobbles.length > 0) {
    validScrobbles = scrobbles.filter((s) => s.mbid);
  }

  // Pre-validate all MBIDs
  if (validScrobbles.length > 0) {
    console.log("Pre-validating MBIDs (ensures ground truth quality)...");
    const preValidationStartTime = Date.now();

    const validationStats = cache.getMBIDValidationStats();
    if (validationStats.length > 0) {
      console.log("  Validation cache breakdown:");
      for (const row of validationStats) {
        const status = row.http_status === null ? "unknown" : String(row.http_status);
        const validity = row.is_valid ? "valid" : "invalid";
        console.log(`    HTTP ${status} (${validity}): ${row.count}`);
      }
    }

    const staleCount = cache.countStaleValidations();
    if (staleCount > 0) {
      const cleared = cache.clearStaleValidations();
      console.log(`  Cleared ${cleared} stale validation entries (503/error) for re-validation`);
    }

    const mbidsToValidate = new Set<string>();
    const mbidsConfirmedValid = new Set<string>();
    const mbidsConfirmedInvalid = new Set<string>();

    for (const s of validScrobbles) {
      if (s.mbid) {
        const cached = cache.getMBIDValidationDetailed(s.mbid);
        if (cached === undefined) {
          mbidsToValidate.add(s.mbid);
        } else if (cached.httpStatus === 200 || cached.httpStatus === 301) {
          mbidsConfirmedValid.add(s.mbid);
        } else if (cached.httpStatus === 404) {
          mbidsConfirmedInvalid.add(s.mbid);
        } else {
          mbidsToValidate.add(s.mbid);
        }
      }
    }

    const uniqueMBIDsToValidate = Array.from(mbidsToValidate);
    console.log(`  ${mbidsConfirmedValid.size} confirmed valid (HTTP 200)`);
    console.log(`  ${mbidsConfirmedInvalid.size} confirmed invalid (HTTP 404)`);
    console.log(`  ${uniqueMBIDsToValidate.length} need validation`);

    if (uniqueMBIDsToValidate.length > 0) {
      console.log(`  Validating ${uniqueMBIDsToValidate.length} unique MBIDs (concurrency: ${concurrency})...`);

      const validationChunks: string[][] = [];
      for (let i = 0; i < uniqueMBIDsToValidate.length; i += concurrency) {
        validationChunks.push(uniqueMBIDsToValidate.slice(i, i + concurrency));
      }

      let validatedCount = 0;
      let invalidCount = 0;

      for (let chunkIdx = 0; chunkIdx < validationChunks.length; chunkIdx++) {
        const chunk = validationChunks[chunkIdx];
        const validationPromises = chunk.map(async (mbid) => {
          const isValid = await validateMBID(mbid, cache, apiMetrics);
          return { mbid, isValid };
        });

        const results = await Promise.all(validationPromises);
        for (const { isValid } of results) {
          if (isValid) validatedCount++;
          else invalidCount++;
        }

        if (chunkIdx % 50 === 0 || chunkIdx === validationChunks.length - 1) {
          const progress = ((chunkIdx + 1) / validationChunks.length * 100).toFixed(1);
          console.log(`  Validated ${chunkIdx + 1}/${validationChunks.length} chunks (${progress}%): ${validatedCount} valid, ${invalidCount} invalid`);
        }
      }

      const preValidationElapsed = Date.now() - preValidationStartTime;
      console.log(`Pre-validation: ${validatedCount} valid, ${invalidCount} invalid in ${formatTime(preValidationElapsed)}`);
    } else {
      console.log(`  All MBIDs already validated (cached)\n`);
    }

    // Detect merged recordings (HTTP 200 entries that are actually 301 redirects).
    // Old code followed redirects transparently; new code uses redirect:"manual".
    // Re-check valid MBIDs that lack canonical_mbid to catch merges.
    const mbidsNeedingMergeCheck = new Set<string>();
    for (const s of validScrobbles) {
      if (!s.mbid) continue;
      const cached = cache.getMBIDValidationDetailed(s.mbid);
      if (cached?.httpStatus === 200 && !cache.hasMergeCheckResult(s.mbid)) {
        // HTTP 200 but never merge-checked with redirect:"manual"
        mbidsNeedingMergeCheck.add(s.mbid);
      }
    }

    if (mbidsNeedingMergeCheck.size > 0) {
      const mergeCheckMBIDs = Array.from(mbidsNeedingMergeCheck);
      console.log(`Checking ${mergeCheckMBIDs.length} valid MBIDs for merged recordings...`);
      let mergeCount = 0;

      const mergeChunks: string[][] = [];
      for (let i = 0; i < mergeCheckMBIDs.length; i += concurrency) {
        mergeChunks.push(mergeCheckMBIDs.slice(i, i + concurrency));
      }

      for (let ci = 0; ci < mergeChunks.length; ci++) {
        const chunk = mergeChunks[ci];
        const promises = chunk.map(async (mbid) => {
          const delay = RATE_LIMIT_DELAY;
          await new Promise((resolve) => setTimeout(resolve, delay));

          const lookupUrl = `${MUSICBRAINZ_BASE_URL}/recording/${mbid}?fmt=json`;
          try {
            const res = await fetch(lookupUrl, {
              headers: { "User-Agent": USER_AGENT },
              redirect: "manual",
            });
            if (apiMetrics) apiMetrics.musicbrainzCalls++;

            if (res.status === 301) {
              const location = res.headers.get("location");
              let canonicalMbid: string | undefined;
              if (location) {
                const match = location.match(/\/recording\/([0-9a-f-]{36})/);
                if (match) canonicalMbid = match[1];
              }
              if (canonicalMbid) {
                cache.setMBIDValidation(mbid, true, 301, `merged -> ${canonicalMbid}`, canonicalMbid);
                return true; // was merged
              }
            } else if (res.status === 200) {
              // Confirmed not merged -- store self-reference so we don't re-check
              cache.setMBIDValidation(mbid, true, 200, null, mbid);
            }
          } catch {
            // Skip on error, keep existing cache entry
          }
          return false;
        });

        const results = await Promise.all(promises);
        mergeCount += results.filter(Boolean).length;

        if (ci % 100 === 0 || ci === mergeChunks.length - 1) {
          const progress = ((ci + 1) / mergeChunks.length * 100).toFixed(1);
          console.log(`  ${ci + 1}/${mergeChunks.length} chunks (${progress}%): ${mergeCount} merges found`);
        }
      }
      console.log(`  Merge detection complete: ${mergeCount} merged recordings resolved\n`);
    }

    // Filter to only confirmed-valid MBIDs (HTTP 200 or 301 merged)
    const invalidScrobbles: typeof validScrobbles = [];
    validScrobbles = validScrobbles.filter((s) => {
      if (!s.mbid) return false;
      const cached = cache.getMBIDValidationDetailed(s.mbid);
      const valid = cached !== undefined && (cached.httpStatus === 200 || cached.httpStatus === 301);
      if (!valid && s.mbid) invalidScrobbles.push(s);
      return valid;
    });
    console.log(`  Filtered to ${validScrobbles.length} scrobbles with confirmed-valid MBIDs`);

    // Recover 404-MBID scrobbles via ListenBrainz ACR fallback.
    // The listenbrainz-resolve.ts script populates mbid_cache with
    // source="listenbrainz_acr" for tracks whose Last.fm MBID is 404.
    if (invalidScrobbles.length > 0) {
      let recovered = 0;
      for (const s of invalidScrobbles) {
        const lbResult = cache.getMBIDWithSource(s.track, s.artist);
        if (lbResult?.mbid && lbResult.source === "listenbrainz_acr") {
          validScrobbles.push({
            ...s,
            mbid: lbResult.mbid,
            mbid_source: "listenbrainz_acr" as MBIDSource,
          });
          recovered++;
        }
      }
      if (recovered > 0) {
        console.log(`  Recovered ${recovered} scrobbles via ListenBrainz ACR fallback`);
      }
    }
    console.log();
  }

  // ── No ground truth mode ──────────────────────────────────────────

  if (validScrobbles.length === 0) {
    console.log("No scrobbles with MBIDs found. Evaluating without ground truth...\n");
    console.log("(This mode compares result counts, not accuracy)\n");

    let baselineCount = 0;
    let improvedCount = 0;
    let baselineTotalResults = 0;
    let improvedTotalResults = 0;

    for (let i = 0; i < scrobbles.length; i++) {
      const s = scrobbles[i];
      if (i % 10 === 0 || i === scrobbles.length - 1) {
        console.log(`  Evaluating ${i + 1}/${scrobbles.length}: "${s.track}" by ${s.artist}...`);
      }
      const baselineRes = await baselineSearch(s.track, s.artist, s.album, cache, apiMetrics);
      const improvedRes = await improvedSearchWithConfig(s.track, s.artist, s.album, searchConfig, cache, apiMetrics);
      if (baselineRes.length > 0) baselineCount++;
      if (improvedRes.length > 0) improvedCount++;
      baselineTotalResults += baselineRes.length;
      improvedTotalResults += improvedRes.length;
    }

    console.log("\nBASELINE (Simple Query):");
    console.log(`  Found results: ${baselineCount}/${scrobbles.length} (${(baselineCount / scrobbles.length * 100).toFixed(1)}%)`);
    console.log(`  Avg results per query: ${(baselineTotalResults / scrobbles.length).toFixed(1)}`);
    console.log("\nIMPROVED (Cleaning + Multi-Stage):");
    console.log(`  Found results: ${improvedCount}/${scrobbles.length} (${(improvedCount / scrobbles.length * 100).toFixed(1)}%)`);
    console.log(`  Avg results per query: ${(improvedTotalResults / scrobbles.length).toFixed(1)}`);
    console.log(`\nIMPROVEMENT: +${improvedCount - baselineCount} scrobbles (${((improvedCount - baselineCount) / scrobbles.length * 100).toFixed(1)}%)`);
    cache.close();
    return;
  }

  // ── Evaluation with ground truth ──────────────────────────────────

  // Deduplicate scrobbles by (track, artist, mbid)
  const deduplicationKey = (s: typeof validScrobbles[0]) =>
    `${s.track.toLowerCase().trim()}::${s.artist.toLowerCase().trim()}::${s.mbid}`;

  const seen = new Map<string, typeof validScrobbles[0] & { count: number }>();
  for (const s of validScrobbles) {
    const key = deduplicationKey(s);
    if (seen.has(key)) {
      seen.get(key)!.count++;
    } else {
      seen.set(key, { ...s, count: 1 });
    }
  }

  const uniqueScrobbles = Array.from(seen.values());
  const duplicateStats = {
    total: validScrobbles.length,
    unique: uniqueScrobbles.length,
    duplicates: validScrobbles.length - uniqueScrobbles.length,
    maxDuplicates: Math.max(...uniqueScrobbles.map((s) => s.count)),
  };

  console.log(`\nDEDUPLICATION:`);
  console.log(`  Total scrobbles: ${duplicateStats.total}`);
  console.log(`  Unique (track+artist+mbid): ${duplicateStats.unique}`);
  console.log(`  Duplicates removed: ${duplicateStats.duplicates} (${(duplicateStats.duplicates / duplicateStats.total * 100).toFixed(1)}%)`);
  console.log(`  Max duplicates per track: ${duplicateStats.maxDuplicates}`);
  console.log(`  Evaluation will use ${uniqueScrobbles.length} unique cases\n`);

  // Expand with track-only searches
  const expandedCases: Array<typeof uniqueScrobbles[0] & { fieldCombination: string }> = [];

  for (const scrobble of uniqueScrobbles) {
    expandedCases.push({ ...scrobble, fieldCombination: "track+artist" });
    if (scrobble.track && scrobble.track.trim().length >= 3) {
      expandedCases.push({
        ...scrobble,
        artist: "",
        fieldCombination: "track_only",
      });
    }
  }

  console.log(`INPUT SPACE EXPANSION:`);
  console.log(`  Original cases: ${uniqueScrobbles.length} (track+artist)`);
  console.log(`  Expanded cases: ${expandedCases.length} (includes track-only searches)`);
  console.log(`  Track-only cases: ${expandedCases.filter((c) => c.fieldCombination === "track_only").length}\n`);

  // ── Evaluation loop ───────────────────────────────────────────────

  const cases: EvaluationCase[] = [];
  const evaluationStartTime = Date.now();
  let lastLogTime = evaluationStartTime;

  async function evaluateCase(
    s: typeof expandedCases[0],
    index: number,
    total: number,
  ): Promise<EvaluationCase> {
    const caseStartTime = Date.now();
    const logInterval = total > 200 ? 50 : total > 50 ? 25 : 10;

    const fieldCombo = s.fieldCombination || (s.artist ? "track+artist" : "track_only");
    const cachedResult = cache.getEvaluationResult(
      s.track,
      s.artist || "",
      s.album,
      s.mbid!,
      searchConfig,
      fieldCombo,
    );

    if (cachedResult) {
      const now = Date.now();
      const shouldLog = index % logInterval === 0 || index === total - 1 || (now - lastLogTime) > 2000;
      if (shouldLog) {
        const progress = ((index + 1) / total * 100).toFixed(1);
        const elapsed = now - evaluationStartTime;
        const dupInfo = s.count > 1 ? ` (${s.count}x)` : "";
        console.log(`  ${index + 1}/${total} (${progress}%): "${s.track}" by ${s.artist}${dupInfo} [evaluation cached] [ETA: ${calculateETA(elapsed, index + 1, total)}]`);
        lastLogTime = now;
      }

      const hardness = classifyHardness(
        s.track,
        s.artist || "",
        cachedResult.failureMode || "standard",
        cachedResult.baselinePos,
        cachedResult.baselineFound,
      );
      return {
        track: s.track,
        artist: s.artist,
        album: s.album,
        mbid: s.mbid!,
        baselinePos: cachedResult.baselinePos,
        improvedPos: cachedResult.improvedPos,
        baselineFound: cachedResult.baselineFound,
        improvedFound: cachedResult.improvedFound,
        baselineNDCG: cachedResult.baselineNDCG,
        improvedNDCG: cachedResult.improvedNDCG,
        failureMode: cachedResult.failureMode,
        hardness,
        duplicateCount: cachedResult.duplicateCount,
        fieldCombination: fieldCombo,
        workEquivalentPos: -1,
        workEquivalentSource: null,
        baselineCacheHit: true,
        improvedCacheHit: true,
        apiCallsImproved: 0,
        improvedTopIds: cachedResult.improvedTopIds,
        baselineTopIds: cachedResult.baselineTopIds,
      };
    }

    // Not cached -- run search
    const baselineCached = cache.getSearchResults(s.track, s.artist || undefined, s.album, false, false, false) !== null;
    const baselineRes = await baselineSearch(s.track, s.artist || "", s.album, cache, apiMetrics);

    const mbCallsBefore = apiMetrics.musicbrainzCalls;
    const improvedRes = await improvedSearchWithConfig(s.track, s.artist || "", s.album, searchConfig, cache, apiMetrics);
    const apiCallsImproved = apiMetrics.musicbrainzCalls - mbCallsBefore;

    const now = Date.now();
    const caseElapsed = now - caseStartTime;
    const shouldLog = index % logInterval === 0 || index === total - 1 || (now - lastLogTime) > 2000;
    if (shouldLog) {
      const progress = ((index + 1) / total * 100).toFixed(1);
      const elapsed = now - evaluationStartTime;
      const dupInfo = s.count > 1 ? ` (${s.count}x)` : "";
      const cacheInfo = baselineCached ? " [partial]" : "";
      console.log(`  ${index + 1}/${total} (${progress}%): "${s.track}" by ${s.artist}${dupInfo}${cacheInfo} [${formatTime(caseElapsed)}/case, ETA: ${calculateETA(elapsed, index + 1, total)}]`);
      lastLogTime = now;
    }

    const baselineIds = baselineRes.slice(0, 25).map((r) => r.id).filter((id): id is string => !!id);
    const improvedIds = improvedRes.slice(0, 25).map((r) => r.id).filter((id): id is string => !!id);

    // Use canonical MBID (follows 301 merges) for comparison
    const targetMbid = cache.getCanonicalMBID(s.mbid!);

    const baselinePos = baselineIds.indexOf(targetMbid);
    const improvedPos = improvedIds.indexOf(targetMbid);
    const baselineFoundAnywhere = baselinePos >= 0;
    const improvedFoundAnywhere = improvedPos >= 0;

    const baselineRelevance = baselineIds.map((id) => id === targetMbid ? 1 : 0);
    const improvedRelevance = improvedIds.map((id) => id === targetMbid ? 1 : 0);
    const baselineNDCG = ndcg(baselineRelevance, 25);
    const improvedNDCG = ndcg(improvedRelevance, 25);

    const failureMode = s.artist ? categorizeFailureMode(s.track, s.artist) : "track_only";
    const hardness = classifyHardness(s.track, s.artist || "", failureMode, baselinePos, baselineFoundAnywhere);

    const result: EvaluationCase = {
      track: s.track,
      artist: s.artist || "",
      album: s.album,
      mbid: s.mbid!,
      baselinePos,
      improvedPos,
      baselineFound: baselineFoundAnywhere,
      improvedFound: improvedFoundAnywhere,
      workEquivalentPos: -1,
      workEquivalentSource: null,
      baselineNDCG,
      improvedNDCG,
      failureMode,
      hardness,
      duplicateCount: s.count,
      fieldCombination: fieldCombo,
      baselineCacheHit: baselineCached,
      improvedCacheHit: false,
      apiCallsImproved,
      improvedTopIds: improvedIds.slice(0, 5),
      baselineTopIds: baselineIds.slice(0, 5),
    };

    cache.setEvaluationResult(
      s.track,
      s.artist,
      s.album,
      s.mbid!,
      searchConfig,
      {
        baselinePos,
        improvedPos,
        baselineFound: baselineFoundAnywhere,
        improvedFound: improvedFoundAnywhere,
        baselineNDCG,
        improvedNDCG,
        failureMode,
        duplicateCount: s.count,
        improvedTopIds: improvedIds.slice(0, 5),
        baselineTopIds: baselineIds.slice(0, 5),
      },
      fieldCombo,
    );

    return result;
  }

  // ── Execute evaluation (parallel or sequential) ───────────────────

  let baselineCacheHits = 0;
  let improvedCacheHits = 0;
  let evaluationResultCacheHits = 0;
  let totalSearches = 0;

  if (parallel && concurrency > 1) {
    console.log(`  Using parallel evaluation (concurrency: ${concurrency})...\n`);
    const chunks: Array<typeof expandedCases[0]>[] = [];
    for (let i = 0; i < expandedCases.length; i += concurrency) {
      chunks.push(expandedCases.slice(i, i + concurrency));
    }

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const chunkCases = await Promise.all(
        chunk.map((s, idx) => evaluateCase(s, chunkIdx * concurrency + idx, expandedCases.length)),
      );

      for (const caseResult of chunkCases) {
        if (caseResult.baselineCacheHit) baselineCacheHits++;
        if (caseResult.improvedCacheHit) improvedCacheHits++;
        if (caseResult.baselineCacheHit && caseResult.improvedCacheHit) {
          evaluationResultCacheHits++;
        }
        totalSearches += 2;

        const hardness = classifyHardness(
          caseResult.track,
          caseResult.artist,
          caseResult.failureMode || "standard",
          caseResult.baselinePos,
          caseResult.baselineFound,
        );
        cases.push({ ...caseResult, hardness });
      }
    }
  } else {
    for (let i = 0; i < expandedCases.length; i++) {
      const caseResult = await evaluateCase(expandedCases[i], i, expandedCases.length);
      if (caseResult.baselineCacheHit) baselineCacheHits++;
      if (caseResult.improvedCacheHit) improvedCacheHits++;
      if (caseResult.baselineCacheHit && caseResult.improvedCacheHit) {
        evaluationResultCacheHits++;
      }
      totalSearches += 2;

      const hardness = classifyHardness(
        caseResult.track,
        caseResult.artist,
        caseResult.failureMode || "standard",
        caseResult.baselinePos,
        caseResult.baselineFound,
      );
      cases.push({ ...caseResult, hardness });
    }
  }

  const evaluationElapsed = Date.now() - evaluationStartTime;
  const avgTimePerCase = cases.length > 0 ? evaluationElapsed / cases.length : 0;
  console.log(`\nEvaluation complete: ${cases.length} cases in ${formatTime(evaluationElapsed)} (avg: ${formatTime(avgTimePerCase)}/case)\n`);

  // ── Work-equivalence post-processing ──────────────────────────────

  const unmatchableForWorkCheck = cases.filter((c) => !c.improvedFound || !c.baselineFound);
  if (unmatchableForWorkCheck.length > 0) {
    console.log(`Work-equivalence post-processing: checking ${unmatchableForWorkCheck.length} unmatchable cases...`);
    let workEquivFound = 0;
    let workChecksPerformed = 0;
    const workStartTime = Date.now();

    for (let i = 0; i < unmatchableForWorkCheck.length; i++) {
      const c = unmatchableForWorkCheck[i];

      if (!c.improvedFound && c.improvedTopIds && c.improvedTopIds.length > 0) {
        for (let j = 0; j < c.improvedTopIds.length; j++) {
          workChecksPerformed++;
          const equiv = await areRecordingsWorkEquivalent(c.mbid, c.improvedTopIds[j], cache, apiMetrics);
          if (equiv) {
            c.workEquivalentPos = j;
            c.workEquivalentSource = "improved";
            workEquivFound++;
            break;
          }
        }
      }

      if (c.workEquivalentPos < 0 && !c.baselineFound && c.baselineTopIds && c.baselineTopIds.length > 0) {
        for (let j = 0; j < c.baselineTopIds.length; j++) {
          workChecksPerformed++;
          const equiv = await areRecordingsWorkEquivalent(c.mbid, c.baselineTopIds[j], cache, apiMetrics);
          if (equiv) {
            c.workEquivalentPos = j;
            c.workEquivalentSource = "baseline";
            workEquivFound++;
            break;
          }
        }
      }

      if ((i + 1) % 100 === 0 || i === unmatchableForWorkCheck.length - 1) {
        const elapsed = Date.now() - workStartTime;
        console.log(`  ${i + 1}/${unmatchableForWorkCheck.length} checked, ${workEquivFound} work-equivalent found (${workChecksPerformed} API checks, ${formatTime(elapsed)})`);
      }
    }

    const workElapsed = Date.now() - workStartTime;
    console.log(`Work-equivalence complete: ${workEquivFound} disambiguation cases found in ${formatTime(workElapsed)} (${workChecksPerformed} recording-work lookups)\n`);
  }

  // ── Duplicate distribution ────────────────────────────────────────

  const duplicateDistribution: Record<number, number> = {};
  for (const c of cases) {
    const count = c.duplicateCount || 1;
    duplicateDistribution[count] = (duplicateDistribution[count] || 0) + 1;
  }

  // ── Report results ────────────────────────────────────────────────

  reportResults({
    cases,
    scrobblesTotal: scrobbles.length,
    validScrobblesCount: validScrobbles.length,
    duplicateStats,
    duplicateDistribution,
    searchConfig,
    apiMetrics,
    startTime,
    evaluationStartTime,
    baselineCacheHits,
    improvedCacheHits,
    evaluationResultCacheHits,
    totalSearches,
  });

  // Show final cache stats
  const finalStats = cache.getStats(cacheUsername);
  console.log("\nFINAL CACHE STATS (All accumulate over time, never cleared):");
  console.log(`  Total scrobbles: ${finalStats.totalScrobbles}`);
  console.log(`  With MBIDs: ${finalStats.scrobblesWithMBID}`);
  console.log(`  Cached MBID lookups: ${finalStats.cachedMBIDs}`);
  console.log(`  Cached MusicBrainz searches: ${finalStats.cachedSearches}`);
  console.log(`  Cached MBID validations: ${finalStats.cachedValidations}`);
  console.log(`  Cached evaluation results: ${finalStats.cachedEvaluationResults} (enables instant re-runs)`);

  const totalElapsedFinal = Date.now() - startTime;
  console.log(`\nTotal execution time: ${formatTime(totalElapsedFinal)}`);
  console.log(`  Average: ${formatTime(totalElapsedFinal / cases.length)} per evaluation case`);

  cache.close();
}

main().catch(console.error);
