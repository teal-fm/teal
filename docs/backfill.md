# Backfill

Teal backfills every Teal record with [tab](https://tangled.org/pds.dad/tab)
and Cadet's tab consumer:

```bash
pnpm backfill
```

The command:

- installs `tab` with `go install tangled.org/pds.dad/tab/cmd/tab@latest` when it
  is not already on `PATH`
- asks Lightrail (`https://lightrail.microcosm.blue`) for every repo with a Teal
  play, profile or status record, in both the `fm.teal.*` and legacy
  `fm.teal.alpha.*` namespaces
- has tab fetch each of those repos from its PDS and deliver every `fm.teal.*`
  record, then follow live changes through Jetstream
- stores tab's state and log under `.teal-tab/`
- runs `cargo run -p cadet --bin tab-backfill`, which stores records through the
  same ingestors as Cadet's Jetstream consumer

The consumer acknowledges each event after storing it, so stopping and rerunning
`pnpm backfill` resumes. Records are stored by a pool of workers
(`TAB_BACKFILL_WORKERS`, default 16); tab holds each repo's live events until
its earlier events are acknowledged, so a repo's changes still apply in order.
Play counts update on Cadet's materialized-view refresh, so keep Cadet running
(`pnpm dev` does).

Keep Postgres running and migrated before starting.

## Legacy plays

Plays from `fm.teal.alpha.feed.play` are stored under the stable
`fm.teal.feed.play` URI. When a listen exists in both collections, as when a
client scrobbled it live to the alpha collection and a later import wrote it
again as a stable record, Cadet keeps the stable record: an alpha play is
dropped when the same account has a stable play of the same track within 10
minutes, and an alpha record never overwrites or deletes a stable row.

Some older alpha plays used bare MusicBrainz UUIDs where the lexicons now expect
`mbid:<uuid>`. Cadet normalizes those and drops empty optional MBIDs before
parsing.

## Re-backfill

To make tab forget its state and backfill every repo again:

```bash
TEAL_TAB_RESET=1 pnpm backfill
```

Useful overrides:

```bash
DATABASE_URL=postgres://teal:teal@127.0.0.1:5432/teal
TAB_HOST=127.0.0.1
TAB_PORT=2480
TAB_LIGHT_RAIL_SIGNAL_COLLECTIONS=fm.teal.feed.play,fm.teal.alpha.feed.play
TAB_COLLECTION_FILTERS=fm.teal.*
TAB_JETSTREAM_URL=wss://jetstream1.us-east.bsky.network
TAB_BACKFILL_WORKERS=16
TEAL_TAB_DIR=.teal-tab
```
