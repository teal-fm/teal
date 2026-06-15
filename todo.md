# Teal App TODO

Working handoff for Teal. Keep this file focused on active work only; implementation history belongs in commits and PRs.

Last synced with GitHub and Linear issues: 2026-06-14.

## Current State

- Stable UI preview: `https://sigilyph.teal.fm`
- Cloudflare Tunnel `teal-dev-sigilyph` routes `sigilyph.teal.fm` to the Compose `amethyst:80` service.
- The ignored local `.env` should keep `TUNNEL_HOST=sigilyph.teal.fm`, matching `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_AQUA_URL`, and `CLOUDFLARED_TUNNEL_TOKEN`.
- Use `pnpm tunnel:up`, `pnpm tunnel:down`, `pnpm tunnel:status`, `pnpm tunnel:logs`, and `pnpm tunnel:verify` for the stable preview.
- The public Amethyst feed must use only live Aqua XRPC data. Do not add seeded, mocked, demo, or backup play data.

## Local Open Work

- [ ] Complete ATProto OAuth sign-in and callback QA through `https://sigilyph.teal.fm`.
  - Verified on 2026-06-15 that `https://sigilyph.teal.fm/client-metadata.json` serves the stable-origin `client_id` and callback URI, and that same-origin latest plays XRPC returns live data. Remaining QA requires an interactive ATProto login/callback with a real account session.
- [x] Drain the in-flight CAR import backfill queue for users with stale ingestion from the 2026-06-07 through 2026-06-10 Cadet outage. Redis/Garnet `LLEN car_import_jobs` returned `0` on 2026-06-14, local Cadet was running, and recent Cadet logs showed no CAR import job failures.
- [x] Backfill the `fm.teal.alpha.feed.play` records present in `did:plc:tas6hj2xjrqben5653v5kohk`'s PDS repo but missing from the preview Postgres index. A focused CAR backfill completed on 2026-06-15 via `lightrail-backfill`; the preview index now has 10,215 plays for that DID, up from 10,172 immediately before the run and above the older 10,193-record comparison from 2026-06-11.
- [x] Handle Jetstream account lifecycle events in Cadet, including deletes, takedowns, suspensions, activations, and tombstones. Cadet now tracks upstream account state, purges indexed public profile/social/play rows when an account becomes inactive, treats activation as the gate for future commit ingestion, and ignores legacy tombstone event kinds because modern Jetstream/account-hosting statuses replace them.

## Tracker Issues

- [ ] [#86](https://github.com/teal-fm/teal/issues/86) / [TEAL-31](https://linear.app/tealfm/issue/TEAL-31/log-unique-tracks-and-albums-to-popfeed) Log unique tracks and albums to Popfeed
  - Linear: `Backlog`, no priority
  - Create Popfeed records when a listener plays a track or album for the first time.
  - Consider follow-on flows for completing Popfeed reviews of songs and albums from Teal.
  - Blocked locally: no Popfeed lexicons, service endpoint, auth flow, or record schema are present in this repo yet.
- [x] [#57](https://github.com/teal-fm/teal/issues/57) / [TEAL-30](https://linear.app/tealfm/issue/TEAL-30/top-albums-around-profile-pic) top albums around profile pic
  - Linear: `In Progress`, low priority
  - Labels: `API`, `Frontend`, `Legacy Songish Feature`
  - Assignee: `mmattbtw`
  - Done in Amethyst profile headers: top releases for the profile's default stats period render as linked cover tiles around the avatar, with desktop and mobile visual QA against live preview data.
- [ ] [#29](https://github.com/teal-fm/teal/issues/29) / [TEAL-21](https://linear.app/tealfm/issue/TEAL-21/mass-editing-scrobbles) mass editing scrobbles
  - Linear: `Backlog`, low priority
  - Labels: `Improvement`, `API`
  - Implementation note: Cadet already reindexes updated `fm.teal.alpha.feed.play` records and deletes tombstoned plays. Remaining work is authenticated Amethyst/Aqua product flow for selecting multiple records and writing `putRecord`/`deleteRecord` changes to the user's PDS.
- [ ] [#28](https://github.com/teal-fm/teal/issues/28) / [TEAL-20](https://linear.app/tealfm/issue/TEAL-20/editing-scrobbles) editing scrobbles
  - Linear: `Todo`, medium priority
  - Labels: `Feature`, `API`
  - Implementation note: single-play edits can build on the existing Cadet upsert path; still needs authenticated UI/API design for loading the original record, editing fields, and writing it back to the PDS.
- [x] [#16](https://github.com/teal-fm/teal/issues/16) / [TEAL-16](https://linear.app/tealfm/issue/TEAL-16/live-scrobble-view) Live Scrobble View
  - Linear: `Todo`, low priority
  - Labels: `Frontend`
  - Assignee: `mmattbtw`
  - Done in Amethyst Home: the `Listens` feed uses Aqua `fm.teal.alpha.stats.getLatest`, supports cursor loading, and shows only live indexed records.

## Verification Commands

```bash
pnpm lex:gen-server
SQLX_OFFLINE=true cargo check -p aqua -p cadet
SQLX_OFFLINE=true cargo test -p cadet stores_and_loads_cursor_from_file_when_redis_is_unavailable
pnpm --filter=@teal/amethyst build:web
docker compose -f compose.dev.yml config
docker compose -f compose.yaml config
docker compose -f compose.dev.yml --profile tunnel up
```
