# TAP Backfill

Teal can backfill the network through Bluesky's `tap` service and Cadet's TAP
consumer:

```bash
pnpm backfill
```

The command:

- installs `tap` with `go install github.com/bluesky-social/indigo/cmd/tap@latest`
  when `tap` is not already on `PATH`
- starts TAP with `TAP_FULL_NETWORK=true`
- filters TAP record delivery to `TAP_COLLECTION_FILTERS=fm.teal.*`, so only Teal
  records reach Cadet after TAP enumerates repos
- stores TAP state and logs under `.teal-tap/`
- runs `cargo run -p cadet --bin tap-backfill`

The Cadet consumer converts TAP record events into the same ingestor event shape
used by the Jetstream path. Historical TAP records are delivered with
`live: false`; after each repo's backfill catches up, TAP delivers live records
with `live: true`.

## Re-Backfill

To force TAP to forget its local state and backfill again:

```bash
TEAL_TAP_RESET=1 pnpm backfill
```

Useful environment overrides:

```bash
DATABASE_URL=postgres://teal:teal@127.0.0.1:5432/teal
TAP_HOST=127.0.0.1
TAP_PORT=2480
TAP_CHANNEL_URL=ws://127.0.0.1:2480/channel
TAP_FULL_NETWORK=true
TAP_COLLECTION_FILTERS=fm.teal.*
TEAL_TAP_DIR=.teal-tap
```

Full-network mode is intentionally the default so Teal can discover records
across every `fm.teal.*` lexicon, including repos that may not have a
`fm.teal.alpha.feed.play` signal record. For a narrower run that only tracks
repos with Teal play records, use TAP's signal-collection mode:

```bash
TAP_FULL_NETWORK=false TAP_SIGNAL_COLLECTION=fm.teal.alpha.feed.play pnpm backfill
```

Keep Postgres running and migrated before starting the backfill. The command is
intended to keep running after historical backfill so Teal continues to receive
live TAP events.
