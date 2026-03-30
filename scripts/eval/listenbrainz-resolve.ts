/**
 * Resolve 404 MBIDs via ListenBrainz ACR (Artist Credit Recording) lookup.
 *
 * Last.fm stores MBIDs that have since been deleted from MusicBrainz (~72% of
 * all MBIDs in our corpus return HTTP 404). ListenBrainz maintains a canonical
 * mapping that can resolve (artist, track) pairs to current recording MBIDs.
 *
 * This script:
 * 1. Finds all scrobbles whose Last.fm MBID returns 404 from MusicBrainz
 * 2. Batch-resolves them via the ListenBrainz labs ACR lookup endpoint
 * 3. Stores resolved MBIDs in mbid_cache with source "listenbrainz_acr"
 * 4. Updates scrobble rows with the new MBID + source
 *
 * The ACR endpoint is public (no auth), supports batch POST, and is fast
 * (~0.7s per 100 items). Rate limit appears generous but we cap at 100/batch.
 *
 * Usage: npx tsx scripts/eval/listenbrainz-resolve.ts [--dry-run] [--limit N]
 */

import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";

const CACHE_DIR = join(homedir(), ".teal_eval_cache");
const DB_PATH = join(CACHE_DIR, "lastfm_eval.db");

const ACR_ENDPOINT = "https://labs.api.listenbrainz.org/acr-lookup/json";
const BATCH_SIZE = 100;
// Pause between batches to be a good citizen
const BATCH_DELAY_MS = 500;

interface ACRRequest {
  artist_credit_name: string;
  recording_name: string;
}

interface ACRResponse {
  index: number;
  artist_credit_arg: string;
  recording_arg: string;
  artist_credit_name?: string;
  recording_name?: string;
  recording_mbid?: string;
  release_name?: string;
  release_mbid?: string;
  artist_credit_id?: number;
  artist_mbids?: string[];
}

async function acrLookupBatch(items: ACRRequest[]): Promise<ACRResponse[]> {
  const res = await fetch(ACR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ACR lookup failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Find unique (track, artist) pairs where the Last.fm MBID is 404
  // and we don't already have a listenbrainz_acr result cached
  const query = `
    SELECT DISTINCT s.track, s.artist
    FROM scrobbles s
    JOIN mbid_validation_cache v ON s.mbid = v.mbid
    WHERE v.http_status = 404
      AND s.track <> ''
      AND s.artist <> ''
      AND NOT EXISTS (
        SELECT 1 FROM mbid_cache mc
        WHERE mc.track = s.track AND mc.artist = s.artist
        AND mc.mbid_source = 'listenbrainz_acr'
      )
    ${limit ? `LIMIT ${limit}` : ""}
  `;

  const pairs = db.prepare(query).all() as Array<{ track: string; artist: string }>;
  console.log(`Found ${pairs.length} unique (track, artist) pairs with 404 MBIDs to resolve`);

  if (pairs.length === 0) {
    console.log("Nothing to resolve.");
    db.close();
    return;
  }

  if (dryRun) {
    console.log("Dry run -- would resolve these pairs:");
    for (const p of pairs.slice(0, 20)) {
      console.log(`  ${p.artist} - ${p.track}`);
    }
    if (pairs.length > 20) console.log(`  ... and ${pairs.length - 20} more`);
    db.close();
    return;
  }

  // Prepare statement -- store in mbid_cache only (not scrobbles).
  // The eval harness reads mbid_cache as a fallback for 404 MBIDs.
  // We don't mutate scrobbles because the original Last.fm MBID is
  // still useful for diagnostics.
  const upsertMbidCache = db.prepare(`
    INSERT OR REPLACE INTO mbid_cache (track, artist, mbid, mbid_source)
    VALUES (?, ?, ?, 'listenbrainz_acr')
  `);

  let totalResolved = 0;
  let totalMissed = 0;
  let totalBatches = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    totalBatches++;

    const requests: ACRRequest[] = batch.map(p => ({
      artist_credit_name: p.artist,
      recording_name: p.track,
    }));

    try {
      const results = await acrLookupBatch(requests);

      // Build a map from (artist, track) -> recording_mbid
      const resolvedMap = new Map<string, string>();
      for (const r of results) {
        if (r.recording_mbid) {
          const key = `${r.artist_credit_arg}\0${r.recording_arg}`;
          resolvedMap.set(key, r.recording_mbid);
        }
      }

      // Apply results in a transaction
      const applyBatch = db.transaction(() => {
        for (const p of batch) {
          const key = `${p.artist}\0${p.track}`;
          const mbid = resolvedMap.get(key);

          if (mbid) {
            upsertMbidCache.run(p.track, p.artist, mbid);
            totalResolved++;
          } else {
            // Cache the miss so we don't retry
            upsertMbidCache.run(p.track, p.artist, null);
            totalMissed++;
          }
        }
      });
      applyBatch();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const progress = Math.min(i + BATCH_SIZE, pairs.length);
      const rate = totalResolved / (parseFloat(elapsed) || 1);
      console.log(
        `Batch ${totalBatches}: ${progress}/${pairs.length} processed, ` +
        `${totalResolved} resolved, ${totalMissed} missed ` +
        `(${elapsed}s, ${rate.toFixed(1)}/s)`
      );
    } catch (err) {
      console.error(`Batch ${totalBatches} failed:`, err instanceof Error ? err.message : err);
      // Continue with next batch
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < pairs.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const resolveRate = pairs.length > 0
    ? ((totalResolved / pairs.length) * 100).toFixed(1)
    : "0";

  console.log("\n--- ListenBrainz ACR Resolution Summary ---");
  console.log(`Total pairs:    ${pairs.length}`);
  console.log(`Resolved:       ${totalResolved} (${resolveRate}%)`);
  console.log(`Missed:         ${totalMissed}`);
  console.log(`Batches:        ${totalBatches}`);
  console.log(`Time:           ${totalTime}s`);

  // Show how many scrobbles now have ground truth
  const newGroundTruth = db.prepare(`
    SELECT COUNT(DISTINCT track || '|' || artist) as count
    FROM mbid_cache
    WHERE mbid_source = 'listenbrainz_acr' AND mbid IS NOT NULL
  `).get() as { count: number };
  console.log(`\nNew ground-truth pairs (listenbrainz_acr): ${newGroundTruth.count}`);

  db.close();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
