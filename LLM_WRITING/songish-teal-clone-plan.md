# Teal Songish Clone With ATProto Firehose Ingestion

## Summary

Build the Teal-branded Songish-style UI in `apps/amethyst`, backed by Teal lexicons and Rust services. The feed will show real `fm.teal.alpha.feed.play` records ingested from the ATProto network stream, not direct social posts.

ATProto docs confirm that appviews commonly consume repo events from `com.atproto.sync.subscribeRepos`, and that Jetstream is the lower-bandwidth JSON stream built on the firehose with collection filtering. Sources: [Streaming Data](https://atproto.com/guides/streaming-data), [Sync Spec](https://atproto.com/specs/sync).

## Firehose Ingestion

- Make `services/cadet` the canonical Rust ingestion service for new plays.
- Keep Jetstream as the default ingestion transport because Cadet already uses it and it supports `wanted_collections=["fm.teal.alpha.feed.play"]`.
- Add a clear config boundary:
  - `CADET_STREAM_MODE=jetstream` default.
  - `JETSTREAM_URL=wss://jetstream1.us-east.bsky.network/subscribe` default.
  - Reserve `CADET_STREAM_MODE=subscribeRepos` for a later full-CBOR firehose adapter if strict relay-level sync is required.
- Cadet must ingest:
  - creates/updates for `fm.teal.alpha.feed.play` into `plays` and artist join tables.
  - deletes by removing the correct play URI, fixing the current delete path if it deletes by DID instead of URI.
  - profiles from `fm.teal.alpha.actor.profile`.
- Persist stream cursor durably:
  - Use Redis or Postgres cursor storage instead of only `cursor.txt`.
  - Keep file cursor as local fallback.
- Remove `POST /api/plays/ingest` as the primary ingestion path.
- Add only a dev-only seed path if needed:
  - `POST /api/dev/plays/seed`, guarded by `TEAL_DEV_SEED_TOKEN`, disabled unless `ENABLE_DEV_SEED_ENDPOINT=true`.

## App And API Changes

- Amethyst:
  - Clone Songish’s layout: desktop left rail, mobile bottom nav, translucent center feed, right stats rail.
  - Home feed calls `fm.teal.alpha.stats.getLatest`.
  - Profile pages call `getProfile` and `getActorFeed`.
  - Music pages render from play fields, MusicBrainz IDs, and Cover Art Archive.
  - Notifications/Explore render Songish-like empty or signed-out states; social features remain deferred.
- Aqua:
  - Align routes with lexicons, especially `fm.teal.alpha.feed.getActorFeed`.
  - Extend `playView` with optional `uri`, `cid`, `authorDid`, and `rkey`.
  - Populate those fields from existing DB columns.
  - Keep CAR import endpoints as backfill tools, not primary live ingestion.
- Lexicons:
  - No new social lexicons in v1.
  - Regenerate generated Rust/TS types after `playView` additions.

## Docker And Tunnel

- Fix `apps/amethyst/Dockerfile` so it copies all required workspace files, including `tools/lexicon-cli`.
- Production compose:
  - `amethyst`, `aqua-api`, `cadet`, `satellite`, `postgres`, `garnet`.
  - Cadet runs continuously as the firehose/Jetstream consumer.
- Development compose:
  - Same core services plus bind mounts where useful.
  - Add optional `cloudflared` profile for public OAuth testing.
- Cloudflare Tunnel:
  - Route public tunnel host to Amethyst.
  - Set `EXPO_PUBLIC_BASE_URL=https://<tunnel-host>`.
  - Generate `/client-metadata.json` with redirect `https://<tunnel-host>/auth/callback`.
  - Use this public URL for ATProto login testing.

## Test Plan

- Backend:
  - `pnpm lex:gen-server`
  - `pnpm test:rust`
  - Add Cadet ingestion tests for create/update/delete `fm.teal.alpha.feed.play`.
  - Add cursor persistence tests.
  - Add CAR backfill regression tests.
- Docker:
  - `docker compose -f compose.dev.yml --profile tunnel up`
  - Verify Cadet ingests live play records into Postgres.
  - Verify Aqua returns the ingested records through stats/feed XRPCs.
  - Verify production compose builds cleanly.
- Browser:
  - Use the Codex Chrome skill for final visual and OAuth QA.
  - Test desktop and mobile Home, Profile, Music Detail, Explore, Notifications, Sign In.
  - Test ATProto login through the Cloudflare Tunnel callback URL.
  - Capture final screenshots from Chrome after implementation.

## Assumptions

- “Firehose ingestion” means Cadet consumes the ATProto network event stream; Jetstream is acceptable for v1 because it is the official app-developer-friendly firehose fanout with collection filtering.
- No direct trusted play POST is part of production ingestion.
- Social features are deferred until new Teal social lexicons are explicitly designed.
