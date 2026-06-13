# Teal App TODO

This file is the working handoff for the Teal-native Teal clone. Keep it updated as implementation and QA move forward.

## Current State

- Amethyst has a Teal-branded Teal-native shell with desktop navigation, mobile navigation, Home, searchable Explore, Notifications, Profile, and music detail views.
- Amethyst uses the teal.fm landing-page brand system: DM Sans body type, serif `.fm` accent type, neutral `#262626` text, `#14b8a6` teal accents, pale lavender/ice-blue gradient chrome, and translucent white surfaces across the main shell and feed.
- Aqua exposes Teal XRPC routes for cursor-paginated latest plays, individual plays, actor feeds, profiles, stats, indexed search, artist discographies, and albums with track lists plus cursor-paginated listens.
- Aqua exposes an artist listener leaderboard XRPC, and Amethyst artist pages show top listeners with all-time, 30-day, and 7-day views plus a full paginated listener leaderboard route.
- Cadet consumes Teal records from Jetstream, stores a durable cursor in Redis with file fallback, and ingests create, update, and delete events for profiles and plays.
- The public Amethyst feed uses only live Aqua XRPC data. There is no seeded, mocked, demo, or backup play feed.
- Amethyst Home uses one inline Teal social composer. Signed-in users get their most recent indexed play attached automatically, can click the attached song to change it with recent plays or MusicBrainz search, write rich text, and publish `fm.teal.alpha.feed.social.post` records.
- Teal has a native social graph lexicon, `fm.teal.alpha.graph.follow`, plus Aqua graph summary/followers/follows read APIs and Cadet ingestion for live, CAR, and TAP follow records.
- Amethyst Home has a single inline social composer followed by a Posts/Listens feed toggle without count badges. Posts show only Teal social posts, Listens show only indexed plays, and each tab paginates its own cursor. The global shell top bar shows the early-WIP/database-wipes warning.
- Amethyst profile pages show each actor's recent top-level Teal social posts above recent listening history, with viewer like/repost state hydrated when signed in.
- Amethyst social posts and recent listens merge indexed Teal actor data with Bluesky fallback handle/display-name/avatar data when the appview only has partial profile rows.
- Amethyst profile images use the Bluesky CDN avatar/banner transforms for indexed Teal blob CIDs, and signed-in users can edit their Teal display name, bio, avatar, and banner from their own profile page.
- Amethyst profile headers show display name, handle, bio, images, and current listening only; protocol internals like DID and onboarding status are hidden from the public profile UI.
- Amethyst profile pages show a 10-play recent listening snapshot followed by Last.fm-style Top Artists, Top Albums, and Top Tracks stats with 7/30/90/180/365/all-time period controls and dedicated full-list pages.
- Teal profile records can configure `statsDefaultPeriod`; Cadet indexes it into Postgres and Aqua returns it on profile views, with Amethyst falling back to 90 days when absent.
- Amethyst profile pages show Teal social graph counts, first-page followers/following lists, and signed-in follow/unfollow controls backed by `fm.teal.alpha.graph.follow` records.
- Amethyst profiles show a minimal current-listening row only when an active status exists, including status-backed profiles that have no Teal profile record and render Bluesky identity as a fallback, with album art resolved from release MBID and recording fallback.
- Amethyst listens have stable permalink pages at `/listen/:did/:rkey`; feed cards link their listen timestamps to the activity page while song titles still link to the music page.
- Amethyst resolves Teal AT-URI deep links from `/at://...` to canonical profile, listen, and post pages.
- Amethyst music track pretty URLs resolve from artist/release/track slugs when no play URI query string is present, instead of falling back to the latest global play.
- Cadet has a TAP backfill consumer and `pnpm backfill` command. The command discovers Teal repos with `TAP_SIGNAL_COLLECTION=fm.teal.alpha.feed.play`, filters delivered records with `TAP_COLLECTION_FILTERS=fm.teal.*`, and consumes TAP record events through the existing Teal ingestors. Full-network TAP backfill remains an explicit env override.
- Cadet's Lightrail CAR backfill resolves `did:web` PDS endpoints from the DID document at `https://<host>/.well-known/did.json` and records most-recent failed repo DIDs for quick retry with `pnpm backfill:lightrail:retry`.
- Cadet normalizes historical play MBID fields during ingestion: empty optional MBIDs are treated as missing, and bare MusicBrainz UUIDs are canonicalized to `mbid:<uuid>` before storage.
- Cadet indexes Jetstream identity handle changes into `profiles.handle`; Aqua includes that handle on profile responses, and Amethyst falls back to public Bluesky handles when an existing Teal profile row has not received an identity event yet.
- Live Jetstream ingestion has been verified end-to-end through Cadet, Postgres, Aqua, and the public preview URL.
- Missing Teal profiles fall back to public Bluesky profile data with an in-app disclaimer, and signed-in listeners can publish a Teal profile through the onboarding wizard.
- Development and production Compose files include Amethyst, Aqua, Cadet, Satellite, Postgres, and Garnet.
- Development Compose includes an optional Cloudflare Tunnel profile.
- Current stable UI preview: `https://sigilyph.teal.fm`
  - Cloudflare Tunnel `teal-dev-sigilyph` routes `sigilyph.teal.fm` to the Compose `amethyst:80` service.
  - The ignored local `.env` has `TUNNEL_HOST=sigilyph.teal.fm`, matching `EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_AQUA_URL`, and `CLOUDFLARED_TUNNEL_TOKEN`.
  - Use `pnpm tunnel:up`, `pnpm tunnel:down`, `pnpm tunnel:status`, `pnpm tunnel:logs`, and `pnpm tunnel:verify` for the stable preview.
  - The preview API is pointed at the OrbStack/Docker Postgres and Garnet services so it serves the existing indexed play corpus.
  - Restored on 2026-06-10 by clearing Docker builder cache, building `aqua-api` and `cadet` sequentially to avoid Docker disk exhaustion, starting the named Cloudflare Tunnel stack, and verifying metadata plus latest-play XRPC.

## Next: Public Demo And OAuth

- [x] Reserve a stable Cloudflare Tunnel hostname for development OAuth testing: `sigilyph.teal.fm`.
- [x] Route the stable public hostname to Amethyst and expose Aqua through the same-origin Amethyst reverse proxy.
- [x] Build Amethyst with `EXPO_PUBLIC_BASE_URL=https://sigilyph.teal.fm` and `EXPO_PUBLIC_AQUA_URL=https://sigilyph.teal.fm`.
- [x] Serve `/client-metadata.json` with `redirect_uris=["https://sigilyph.teal.fm/auth/callback"]`.
- [ ] Complete ATProto OAuth sign-in and callback QA through the stable public hostname.
- [x] Document the stable tunnel token or named-tunnel setup without committing secrets.

## Next: Current User-Reported Fixes

- [x] Use the signed-in viewer's Teal profile display name and images in the bottom-left desktop account control instead of the viewer's Bluesky profile data.
- [x] Add standalone permalink pages for Teal social posts so posts can be linked directly.
- [x] Fix persisted post liked-state hydration so posts already liked by the signed-in viewer still render as liked after refresh.
- [x] Fix cover art rendering on social posts, including posts whose attached tracks only have MusicBrainz IDs or legacy track metadata.
- [x] Prune Docker builder cache and redeploy the stable preview with rebuilt Aqua and Amethyst containers.
- [x] Add artist listener leaderboards to Aqua and Amethyst artist pages.
- [x] Redeploy the stable preview and QA artist listener leaderboards against live indexed data.
- [x] Add profile listening stats for top artists, albums, and tracks with configurable default period and dedicated More pages.
- [x] Recover cadet jetstream cursor after Garnet restarts: initialise `Some(now_us)` on a fresh start so `rocketman::handler` can advance it, mirror to a persistent file in `/var/lib/cadet`, and clamp stale stored cursors so we don't try to replay history jetstream no longer retains.
- [x] Record the manually applied `20241220000014_deduplicate_plays` migration in `_sqlx_migrations` so future `pnpm db:migrate` runs do not re-create the existing `uq_plays_did_cid` constraint.
- [x] Deduplicate logical play duplicates created by users running multiple scrobblers (same did + played_time + track_name, different CIDs): removed 5,709 duplicate `plays` rows and 5,989 extended artist joins from the preview Postgres on 2026-06-11.
- [x] Repair the Leroy artist over-attribution on the preview database: moved 2,192 name-only `leroy` joins for `did:plc:tas6hj2xjrqben5653v5kohk` from MusicBrainz MBID `4c3cebc5-ee75-4934-92f2-66bd5e05d392` to a synthetic artist row, leaving the exact-MBID page at 24 total plays and 1 play for `matt.evil.gay`.
- [x] Fixed slow stable-preview appview latest feed on 2026-06-13: added feed pagination indexes, changed Aqua `getLatest` to page plays before artist/profile joins, rebuilt Aqua, and verified `https://sigilyph.teal.fm/xrpc/fm.teal.alpha.stats.getLatest?limit=5` at ~206ms through the public tunnel.
- [x] Prevent future name-only artist records from being auto-matched onto MusicBrainz artists by name alone in Cadet ingestion.
- [x] Fix PR CI setup by moving the shared GitHub Actions Node runtime to 22 for pnpm 11 compatibility, skipping duplicate postinstall lexicon generation in CI, approving required pnpm dependency build scripts, and committing regenerated Rust lexicon bindings. Added a lexicon CLI post-process step that canonicalizes jacquard-generated Rust builder state ordering so `pnpm lex:gen && git diff --exit-code` is stable across repeated CI/Linux runs. Updated Amethyst tests to invoke the package-local Jest binary instead of a pnpm-layout-sensitive root `node_modules` path.
- [ ] Drain the in-flight CAR import backfill queue for users with stale ingestion (93 jobs enqueued after the 6/7\u20136/10 cadet outage). Track via Redis `LLEN car_import_jobs` and cadet logs.
- [ ] Backfill the 381 current `fm.teal.alpha.feed.play` records present in `did:plc:tas6hj2xjrqben5653v5kohk`'s PDS repo but missing from the preview Postgres index; URI-set comparison on 2026-06-11 showed 10,193 repo records, 9,812 indexed DB rows, and no stale extra DB URIs.

## Next: New Lexicon Implementation

- [x] Add Cadet Jetstream collection filters and ingestors for `fm.teal.alpha.actor.profileStatus`, `fm.teal.alpha.feed.social.post`, `like`, `repost`, `playlist`, `playlistItem`, `badge`, and `badgeAssignment`.
- [x] Extend CAR import/backfill to process the new profile-status and social record collections, including creates, updates, deletes, and validation failures.
- [x] Add database migrations for profile onboarding status, social posts, post reply refs, likes, reposts, playlists, playlist items, badge definitions, badge assignments, rich-text facets, blob CIDs, and derived count/index tables.
- [x] Implement delete handling for each new indexed record so primary rows, join rows, counters, and notification rows stay consistent.
- [x] Finish `fm.teal.alpha.actor.status` indexing semantics: pick the latest status per actor, respect `expiry` with the 10-minute default, omit expired statuses from profile responses, and add regression tests.
- [x] Index `fm.teal.alpha.actor.profileStatus` so onboarding state can be read from Aqua instead of only direct PDS `getRecord` calls.
- [x] Update Aqua `getProfile`/`getProfiles` responses to include indexed actor status and profile onboarding status from the appview.
- [x] Complete `fm.teal.alpha.stats.getUserTopArtists` and `getUserTopReleases` to honor `period`, `cursor`, handle-to-DID resolution, limit bounds, and lexicon response shapes.
- [x] Add Aqua social read APIs or lexicons for post feeds, post detail, replies, likes, reposts, playlists, playlist items, badge catalogs, actor badges, and notifications.
- [x] Add Amethyst compose/publish flows for Teal social posts with `trackView`, replies, tags, langs, and `fm.teal.alpha.richtext.facet` mention/link rendering.
- [x] Add Amethyst like and repost actions with optimistic viewer state, counts, undo/delete behavior, and signed-out affordances.
- [x] Add Teal social graph follow lexicon, migration, Cadet ingestion, and Aqua graph summary/list APIs.
- [x] Add Amethyst profile follow/unfollow controls plus followers/following list surfaces.
- [x] Add Amethyst playlist creation, playlist editing, playlist detail routes, ordered playlist item management, cover uploads, and collaborator-author handling.
- [x] Add Amethyst badge display on profiles plus badge definition and assignment management for authorized creators/admin flows.
- [x] Replace placeholder Notifications copy with real social notifications for likes, reposts, replies, badge assignments, playlist collaboration, and relevant status/profile events.
- [x] Render profile status/current-listening surfaces in Home, Profile, and actor hover/profile cards, including expired and missing-status states.
- [x] Normalize `feed.social.defs#trackView` into existing play/music UI models while preserving deprecated `artistMbIds` and new `artists` arrays.
- [x] Add rich-text facet parsing/rendering shared by profile descriptions, social posts, playlist descriptions, and badge descriptions.
- [x] Regenerate and commit Rust and TypeScript lexicon bindings after the new implementation work, then run `pnpm lex:validate`.
- [x] Add Cadet ingestion tests, Aqua route/repository tests, Amethyst interaction tests, SQLx prepare updates, and final Chrome QA for the new social/profile-status flows.

## Next: Firehose Ingestion

- [ ] Handle Jetstream account lifecycle events in Cadet, including deletes, takedowns, suspensions, activations, and tombstones, and decide how each state should affect indexed profiles, social records, and plays.
- [x] Add Cadet create, update, and delete integration tests for `fm.teal.alpha.feed.play`.
- [x] Add profile create, update, and delete ingestion integration tests for `fm.teal.alpha.actor.profile`.
- [x] Verify Jetstream filtering against `wantedCollections=fm.teal.alpha.feed.play` in a live environment.
- [x] Verify Cadet cursor recovery after restart with Garnet enabled.
- [x] Verify delete handling removes the play URI from `plays`, `play_to_artists`, and `play_to_artists_extended`.
- [x] Add a `subscribeRepos` CBOR adapter only if relay-level firehose sync becomes necessary.
- [x] Keep CAR import as a backfill path and add regression tests for it.
- [x] Add TAP backfill setup for signal-collection `fm.teal.*` sync and a repeatable `pnpm backfill` command.

## Next: Aqua And Lexicons

- [x] Add pagination support for `fm.teal.alpha.feed.getActorFeed` cursor and limit parameters.
- [x] Add keyset pagination and infinite scrolling for the global latest-play feed.
- [x] Run SQLx prepare against the development Postgres instance and commit refreshed query cache data.
- [x] Resolve the existing Satellite SQLx offline-cache gap so `pnpm turbo run test:rust` passes without a live Docker hostname.
- [x] Decide whether the legacy `play_to_artists` join table can be removed after Aqua reads move fully to `play_to_artists_extended`.
- [x] Validate the Teal lexicons and regenerate Rust and TypeScript bindings before each PR.

## Next: Amethyst UI

- [x] Add Explore search for users, songs, artists, and albums.
- [x] Add album-cover preview controls only after Teal has a real audio preview source and playback behavior.
- [x] Finish profile avatar and banner blob URL rendering.
- [x] Add artist and release detail routes in addition to track detail.
- [x] Refresh the shared UI system and apply it across feed, search, profiles, music pages, sign-in, onboarding, settings, and manual stamping.
- [x] Select a dedicated artist-image source. Artist pages currently use representative Cover Art Archive release artwork.
- [x] Enrich album track ordering from MusicBrainz release media. Teal currently lists the tracks observed in indexed plays alphabetically.
- [x] Render real Cover Art Archive images for recordings with MusicBrainz IDs and polished fallbacks for missing art.
- [x] Exercise empty, loading, error, signed-out, and populated feed states at desktop and mobile widths.
- [x] Fix populated desktop feed-card text collisions for long DIDs, track titles, and artist names.
- [x] Verify SPA fallback routing in the production Caddy image for Home, Explore, Notifications, Profile, music detail, and OAuth callback routes.
- [x] Capture final Chrome screenshots after Aqua and Cadet are running with live ingested data.

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
