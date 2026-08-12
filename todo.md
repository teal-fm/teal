# Teal App TODO

Working handoff for Teal. Keep this file focused on active work only; implementation history belongs in commits and PRs.

Last synced with GitHub and Linear issues: 2026-06-14.

## Current State

- Stable UI preview: `https://sigilyph.teal.fm`
- Cloudflare Tunnel `teal-dev-sigilyph` routes `sigilyph.teal.fm` to the Compose `amethyst:80` service.
- Manual listening feature preview: `https://mimikyu.teal.fm` via Cloudflare Tunnel `teal-dev-mimikyu`; the preview container runs alongside the stable stack and routes to the current `codex/manual-listens` build.
- The ignored local `.env` should keep `TUNNEL_HOST=sigilyph.teal.fm`, matching `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_AQUA_URL`, and `CLOUDFLARED_TUNNEL_TOKEN`.
- Use `pnpm tunnel:up`, `pnpm tunnel:down`, `pnpm tunnel:status`, `pnpm tunnel:logs`, and `pnpm tunnel:verify` for the stable preview.
- The public Amethyst feed must use only live Aqua XRPC data. Do not add seeded, mocked, demo, or backup play data.
- Public preview refreshed on 2026-06-15 by rebuilding Amethyst, Aqua, and Cadet images, recreating the Compose preview stack, and verifying `https://sigilyph.teal.fm/client-metadata.json` plus latest plays XRPC.
- Public preview restored on 2026-07-16 after rebuilding the Amethyst, Aqua, and Cadet images; the named Cloudflare tunnel is connected and both public metadata and latest-play XRPC verification pass.
- Sidebar build footer (2026-08-10): the Amethyst sidebar now shows the branch and short commit hash baked into the running image; the local named-tunnel preview is serving `codex/manual-listens` at `https://sigilyph.teal.fm`.
- Dark mode preview refresh (2026-08-11): added the cohesive dark palette across Amethyst shells, feeds, social surfaces, profile/stats views, manual stamping, onboarding, web chrome, and native tab colors. Rebuilt the named Cloudflare preview from `codex/manual-listens` after cherry-picking `07e4af5`; `https://sigilyph.teal.fm` metadata and latest-listens XRPC verification pass.
- Manual theme toggle (2026-08-11): the Teal shell now exposes an accessible light/dark toggle on desktop and mobile; Settings retains the System option, and web theme choices persist via localStorage.
- Sidebar brand asset (2026-08-12): added a standalone SVG wordmark for `teal.fm` at `apps/amethyst/assets/images/teal-fm-logo.svg`.
- Focused code-health pass (2026-07-10): fixed `did:web` path resolution and resolver error handling in Cadet, avoided 10-second Postgres connection churn in Aqua/Cadet/Satellite, returned proper 404s for missing feed plays, and preserved delimiter-containing artist names in Satellite's latest-play response. Verified with targeted Rust checks and Cadet resolver tests.
- Focused Amethyst code-health pass (2026-07-10): moved color-scheme initialization out of render, made Escape handling safe on native clients, kept independent home and right-rail requests visible when a sibling request fails, and migrated linting to ESLint 9 flat config while ignoring generated Expo output. Verified with TypeScript, focused lint, Jest, and a web export built against `https://sigilyph.teal.fm`.
- Dependency refresh (2026-07-10): updated the Rust lockfile, root and standalone lexicon CLI pnpm locks, Expo SDK 57/RN 0.86, AT Protocol clients and lexicon generator, plus current compatible workspace tooling. Regenerated lexicons now normalize TypeScript relative imports for Metro; Amethyst record creation supplies required `$type` fields. Verified with offline Rust tests/checks, TypeScript, Jest, and full workspace builds.
- Cadet live-ingestion recovery (2026-07-11): the preview consumer was repeatedly stalling because every incoming play synchronously refreshed four materialized views. The Compose Cadet service now enables its existing deferred-refresh mode so Jetstream events can drain without blocking for several seconds per play. Follow-up: add a periodic materialized-view refresh path before relying on live aggregate counts.
- Music detail social-link fix (2026-07-11): social-post track links now carry the source post URI instead of an empty play URI, track pages match listens by recording identity with a metadata fallback, and the originating post renders on the track page.
- Music album metadata/dedup fix (2026-07-16): album pages use MusicBrainz release artist metadata, collapse case/recording-ID variants into one track row, preserve canonical release recording IDs, and sum merged listen counts; artist pages now merge duplicate release titles and avoid cross-title MBID collisions.
- Automatic catalog cleanup/discography split (2026-07-16): Cadet now runs catalog consolidation on a six-hour interval, artist responses expose MusicBrainz release-group types, and Amethyst separates Albums from Singles. Audited the top 12 artists in the preview; none had duplicate album titles after normalization.
- Discography count fix (2026-07-16): Aqua now paginates the complete MusicBrainz release classification instead of stopping at 100 releases, and Amethyst counts only true album release types while separating EPs, singles, and other releases.
- Slug-only music artist links (2026-07-16): artist and listener pages now derive lookups from the route slug, while Aqua accepts normalized artist slugs alongside existing names and MBIDs.
- Notification post navigation (2026-07-16): like and repost notifications now navigate to their original post through the indexed subject URI while preserving actor profile links.
- Notification context refinement (2026-07-16): Amethyst notifications now group same-post likes/reposts, stack linked actor avatars, use compact relative timestamps, and load the referenced post text plus track preview; follow and badge activity remain lightweight rows.
- Playlist track lookup (2026-07-16): playlist editors can search their own indexed listening history or MusicBrainz and add matching tracks directly to a playlist.
- Manual album listening entry (2026-07-18): Amethyst now has a protected `/manual-listens` page in the desktop/mobile navigation, MusicBrainz release and track selection, duration-aware timestamp previews, atomic `applyWrites` submission, and a fresh-origin logged-out redirect. The hero copy is kept focused on the album action without the extra listening-record label, and timestamp choices explain their effect using plain language and local-time guidance. Cadet now persists failed play events in a Postgres retry queue with exponential backoff and dead-letter tracking. TypeScript, Amethyst tests, Biome, and the web export pass; authenticated preview QA remains.
- Manual-listen review fixes (2026-08-11): Cadet retry jobs now collapse by logical record, preserve commit ordering, serialize replay with live record commits, reset attempts when newer revisions replace queued retries, recheck account activity, and conditionally complete stale jobs; duplicate-CID retries repair artist links and aggregates, and reverse timeline backfills use the preceding track duration. Focused Rust, TypeScript, Biome, and migration checks pass.
- Cadet account/retry race fix (2026-08-11): account lifecycle state updates and purges now share a per-DID transaction advisory lock with the final play write, which rechecks account activity atomically before committing replayed data. Added an inactive-account replay regression test.
- Teal identity alignment (2026-08-12): the authenticated desktop sidebar and freshly-created social post cards now use the logged-in Teal profile directly from Aqua and never fall back to Bluesky name/avatar metadata for the viewer. Verify with authenticated browser QA after the next preview rebuild.
- Comprehensive code-health fixes (2026-08-11): actor-scoped search now validates DIDs, escapes and bounds query input, filters every music result category, and keeps title-only recordings distinct by artist; playlist additions preserve full multi-artist metadata, use the playlist item count for ordering, serialize local adds, and surface MusicBrainz failures; Aqua/Cadet CAR fetches block private endpoints, redirects, and oversized responses, while unimplemented Aqua CAR queue endpoints no longer claim work was queued; account lifecycle updates ignore stale events; Satellite global counts, latest-play ordering, and concurrent materialized-view refreshes are corrected. Verified with offline Rust checks, Aqua/Cadet/Satellite tests, Clippy, Amethyst TypeScript/tests, lexicon validation, and web export.

## Local Open Work

- [ ] Add a periodic refresh job for Cadet's play-count materialized views now that live ingestion defers per-play refreshes.
- [ ] Complete ATProto OAuth sign-in and callback QA through `https://sigilyph.teal.fm`.
  - Verified again on 2026-06-15 that `pnpm tunnel:verify` validates the stable-origin `client_id`, callback URI, `client_uri`, DPoP setting, and latest plays XRPC response. Browser preflight on 2026-06-15 loaded the stable preview, started sign-in for `matt.evil.gay`, resolved the PDS as `evil.gay`, and reached the provider password page at `/oauth/authorize` with `client_id=https://sigilyph.teal.fm/client-metadata.json` plus a PAR `request_uri`. Amethyst now persists the resolved OAuth issuer and reconstructs callback/restore clients from the callback `iss` so non-`bsky.social` PDS sessions do not fall back to the initial client after redirect. Remaining QA requires entering a real account password/approval and confirming the callback returns to `/auth/callback`, creates a session, and restores after refresh.
- [ ] Verify `/manual-listens` end-to-end through the stable preview with a logged-in account, including MusicBrainz lookup, release selection, atomic record creation, and Aqua/PDSls visibility.
- [x] Drain the in-flight CAR import backfill queue for users with stale ingestion from the 2026-06-07 through 2026-06-10 Cadet outage. Redis/Garnet `LLEN car_import_jobs` returned `0` on 2026-06-14, local Cadet was running, and recent Cadet logs showed no CAR import job failures.
- [x] Backfill the `fm.teal.alpha.feed.play` records present in `did:plc:tas6hj2xjrqben5653v5kohk`'s PDS repo but missing from the preview Postgres index. A focused CAR backfill completed on 2026-06-15 via `lightrail-backfill`; the preview index now has 10,215 plays for that DID, up from 10,172 immediately before the run and above the older 10,193-record comparison from 2026-06-11.
- [x] Handle Jetstream account lifecycle events in Cadet, including deletes, takedowns, suspensions, activations, and tombstones. Cadet now tracks upstream account state, purges indexed public profile/social/play rows when an account becomes inactive, treats activation as the gate for future commit ingestion, and ignores legacy tombstone event kinds because modern Jetstream/account-hosting statuses replace them.

## Tracker Issues

- [x] [#57](https://github.com/teal-fm/teal/issues/57) / [TEAL-30](https://linear.app/tealfm/issue/TEAL-30/top-albums-around-profile-pic) top albums around profile pic
  - Linear: `In Progress`, low priority
  - Labels: `API`, `Frontend`, `Legacy Songish Feature`
  - Assignee: `mmattbtw`
  - Done in Amethyst profile headers: top releases for the profile's default stats period render as linked cover tiles around the avatar, with desktop and mobile visual QA against live preview data.
- [x] [#29](https://github.com/teal-fm/teal/issues/29) / [TEAL-21](https://linear.app/tealfm/issue/TEAL-21/mass-editing-scrobbles) mass editing scrobbles
  - Linear: `Backlog`, low priority
  - Labels: `Improvement`, `API`
  - Done in Amethyst self-profile recent plays: logged-in users can enter selection mode, select visible recent play records, bulk-apply shared artist/release metadata with `com.atproto.repo.putRecord`, or bulk-delete selected records with `com.atproto.repo.deleteRecord`. Browser QA verified the logged-out controls stay hidden on desktop and mobile while public profile data still renders from live XRPC.
- [x] [#28](https://github.com/teal-fm/teal/issues/28) / [TEAL-20](https://linear.app/tealfm/issue/TEAL-20/editing-scrobbles) editing scrobbles
  - Linear: `Todo`, medium priority
  - Labels: `Feature`, `API`
  - Done in Amethyst listen detail pages: logged-in record owners can fetch the source `fm.teal.alpha.feed.play` record from their PDS, edit track, artists, release, and played time, save via `com.atproto.repo.putRecord`, or delete via `com.atproto.repo.deleteRecord`. Public logged-out listen pages continue to render without showing edit controls.
- [x] [#16](https://github.com/teal-fm/teal/issues/16) / [TEAL-16](https://linear.app/tealfm/issue/TEAL-16/live-scrobble-view) Live Scrobble View
  - Linear: `Todo`, low priority
  - Labels: `Frontend`
  - Assignee: `mmattbtw`
  - Done in Amethyst Home: the `Listens` feed uses Aqua `fm.teal.alpha.stats.getLatest`, supports cursor loading, and shows only live indexed records.

## Verification Commands

```bash
pnpm lex:gen-server
pnpm typecheck
SQLX_OFFLINE=true cargo check -p aqua -p cadet
SQLX_OFFLINE=true cargo test -p cadet stores_and_loads_cursor_from_file_when_redis_is_unavailable
pnpm --filter=@teal/amethyst build:web
docker compose -f compose.dev.yml config
docker compose -f compose.yaml config
docker compose -f compose.dev.yml --profile tunnel up
```

Additional Amethyst verification for scrobble editing:

```bash
EXPO_PUBLIC_AQUA_URL=https://sigilyph.teal.fm pnpm --filter=@teal/amethyst build:web
pnpm --filter=@teal/amethyst exec tsc --noEmit
```
- Lexicon tooling migration (2026-07-16): `@atproto/lex` now validates Teal schemas on every TypeScript generation, and the old custom CLI no longer depends on `@atproto/lex-cli`. The legacy `gen-server` compatibility output remains isolated in `packages/lexicons` pending Aqua's XRPC binding migration.
