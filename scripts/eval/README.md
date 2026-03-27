# MusicBrainz Matching Evaluation

Measures how well our MusicBrainz search pipeline (cleaner, ranking,
multi-stage orchestrator) finds the correct recording given a track
name, artist, and album. Uses your own Last.fm scrobble history as
ground truth (scrobbles carry MBIDs we can validate against). Results
vary by listening habits -- the numbers in the PR reflect one person's
library and are not universal benchmarks.

## Quick Start

```bash
# 1. Add Last.fm API credentials to .env (see .env.template)
#    Get a key at https://www.last.fm/api/account/create
#    LASTFM_API_KEY=...
#    LASTFM_API_SECRET=...

# 2. Authenticate once (opens browser for Last.fm OAuth)
pnpm eval:auth

# 3. Run evaluation (1000 scrobbles is a good starting sample)
pnpm eval:run -- --limit 1000

# 4. Expand ground truth via ListenBrainz (recovers ~75% of 404 MBIDs)
pnpm eval:resolve-lb

# 5. Run on full cached history
pnpm eval:run -- --all
```

## Full Workflow (for reliable results)

```bash
# First time: authenticate + fetch scrobbles + resolve ground truth
pnpm eval:auth
pnpm eval:run -- --all --use-additional-apis   # fetches scrobbles, resolves MBIDs
pnpm eval:resolve-lb                            # batch-resolve 404 MBIDs via ListenBrainz

# Re-run after code changes (uses cached searches, fast)
pnpm eval:run -- --all

# With a rotating proxy (faster MB API calls)
MB_RATE_LIMIT_MS=200 pnpm eval:run -- --all --concurrency 5
```

## What It Measures

Each scrobble with a valid MBID becomes a test case. The eval searches
MusicBrainz using both a **baseline** (single Lucene query, 1 API call)
and the **improved** pipeline (multi-stage search with cleaning and
ranking, ~4.5 API calls/case on average). It checks whether the correct
recording MBID appears in the results and at what position.

Metrics reported: P@1, P@5, P@10, MRR, NDCG, win/loss ratio, and
per-category breakdowns (remixes, featuring artists, CJK, etc.).

## Ground Truth Sources

MBIDs come from four independent sources (not from our own search):

| Source | How obtained | Independence |
|--------|-------------|--------------|
| `track_data` | Last.fm scrobble's `.mbid` field | Independent |
| `lastfm_track_info` | Last.fm `track.getInfo` API | Independent |
| `lastfm_search` | Last.fm `track.search` API | Semi-independent |
| `listenbrainz_acr` | ListenBrainz ACR canonical mapping | Independent |

The `listenbrainz_acr` source is critical: ~72% of Last.fm MBIDs
return HTTP 404 from MusicBrainz (deleted recordings). ListenBrainz's
canonical mapping resolves ~75% of these to current recording MBIDs,
nearly tripling the eval set. Run `pnpm eval:resolve-lb` to populate.

## Options

```
--limit N              Evaluate N scrobbles (default: 1000)
--all                  Evaluate all cached scrobbles
--username USER        Use public API for username (skips OAuth)
--auth-only            Perform OAuth only, then exit
--no-cleaning          Disable name cleaning
--no-fuzzy             Disable fuzzy matching
--no-multistage        Disable multi-stage search
--no-parallel          Disable parallel evaluation
--concurrency N        Parallel concurrency (default: 5)
--refresh-scrobbles    Force re-fetch scrobbles from Last.fm
--use-additional-apis  Backfill missing MBIDs via extra API calls
```

## Files

| File | Purpose |
|------|---------|
| `evaluate.ts` | Main orchestrator |
| `types.ts` | Shared types, MBIDSource provenance, GROUND_TRUTH_SOURCES |
| `search.ts` | Baseline + improved search (mirrors production pipeline) |
| `evaluate-lastfm-cache.ts` | SQLite cache (scrobbles, searches, validations) |
| `mbid-resolution.ts` | MBID resolution with provenance tracking |
| `listenbrainz-resolve.ts` | Batch 404 MBID resolution via ListenBrainz |
| `reporting.ts` | Metrics computation + JSON output |
| `statistics.ts` | Bootstrap CI, McNemar, Cohen's h, NDCG |
| `lastfm-api.ts` | Last.fm API functions |
| `auth.ts` | Last.fm OAuth + signature generation |

## Caching

SQLite cache at `~/.teal_eval_cache/lastfm_eval.db` with three layers:

- **`mb_search_cache`**: Raw MB API responses. Keyed by (track, artist,
  album, strategy). Never invalidated -- API responses don't change
  with our code.
- **`evaluation_result_cache`**: Eval outcomes per case. Keyed by
  (track, artist, album, mbid, config, field_combo, VERSION). Bump
  `EVALUATION_LOGIC_VERSION` in `evaluate-lastfm-cache.ts` after
  ranking/search code changes.
- **`mbid_validation_cache`**: MBID validity + canonical mapping for
  merged recordings. Rarely invalidated.

First run is slow (fills the search cache via MusicBrainz API at 1
req/s). Expect ~3-4 hours per 10k cases. Subsequent runs are fast
(seconds for 22k+ cases when fully cached).

To speed up the initial cache fill, use a residential proxy to avoid
the MB rate limit:

```bash
# In .env:
PROXY_URL=http://user:pass@proxy-host:port

# Then run with lower rate limit and higher concurrency:
MB_RATE_LIMIT_MS=200 pnpm eval:run -- --all --concurrency 5
```

## Notes

- Session key: `scripts/eval/.lastfm_session_key` (gitignored).
- Results: `scripts/eval/results/archive/YYYY-MM-DD/` (gitignored).
- Default MB rate limit: 1 req/s. Set `MB_RATE_LIMIT_MS=N` to override.
- Proxy support: set `PROXY_URL` in `.env` for a residential/rotating proxy.
