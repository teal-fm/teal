# Teal App TODO

Working handoff for Teal. Keep this file focused on active work only; implementation history belongs in commits and PRs.

Last synced with GitHub issues: 2026-06-14.

## Current State

- Stable UI preview: `https://sigilyph.teal.fm`
- Cloudflare Tunnel `teal-dev-sigilyph` routes `sigilyph.teal.fm` to the Compose `amethyst:80` service.
- The ignored local `.env` should keep `TUNNEL_HOST=sigilyph.teal.fm`, matching `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_AQUA_URL`, and `CLOUDFLARED_TUNNEL_TOKEN`.
- Use `pnpm tunnel:up`, `pnpm tunnel:down`, `pnpm tunnel:status`, `pnpm tunnel:logs`, and `pnpm tunnel:verify` for the stable preview.
- The public Amethyst feed must use only live Aqua XRPC data. Do not add seeded, mocked, demo, or backup play data.

## Local Open Work

- [ ] Complete ATProto OAuth sign-in and callback QA through `https://sigilyph.teal.fm`.
- [ ] Drain the in-flight CAR import backfill queue for users with stale ingestion from the 2026-06-07 through 2026-06-10 Cadet outage. Track via Redis `LLEN car_import_jobs` and Cadet logs.
- [ ] Backfill the 381 current `fm.teal.alpha.feed.play` records present in `did:plc:tas6hj2xjrqben5653v5kohk`'s PDS repo but missing from the preview Postgres index. URI-set comparison on 2026-06-11 showed 10,193 repo records, 9,812 indexed DB rows, and no stale extra DB URIs.
- [ ] Handle Jetstream account lifecycle events in Cadet, including deletes, takedowns, suspensions, activations, and tombstones. Decide how each state should affect indexed profiles, social records, and plays.

## GitHub Issues

- [ ] [#86 Log unique tracks and albums to Popfeed](https://github.com/teal-fm/teal/issues/86)
  - Create Popfeed records when a listener plays a track or album for the first time.
  - Consider follow-on flows for completing Popfeed reviews of songs and albums from Teal.
- [ ] [#57 top albums around profile pic](https://github.com/teal-fm/teal/issues/57)
  - Labels: `API`, `Frontend`, `Legacy Songish Feature`
  - Assignee: `mmattbtw`
- [ ] [#29 mass editing scrobbles](https://github.com/teal-fm/teal/issues/29)
  - Labels: `Improvement`, `API`
- [ ] [#28 editing scrobbles](https://github.com/teal-fm/teal/issues/28)
  - Labels: `Feature`, `API`
- [ ] [#16 Live Scrobble View](https://github.com/teal-fm/teal/issues/16)
  - Labels: `Frontend`
  - Assignee: `mmattbtw`
  - Build a live feed of scrobbles from everyone.

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
