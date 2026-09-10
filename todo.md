# Teal App TODO

This file is the working handoff for the Teal-native Teal clone. Keep it updated as implementation and QA move forward.

## Current State

- Amethyst has a Teal-branded Teal-native shell with desktop navigation, mobile navigation, Home, searchable Explore, Notifications, Profile, and music detail views.
- Amethyst uses a cleaned editorial utility UI system with compact rails, consistent surfaces, responsive center content, and restrained Teal identity across browsing, authentication, onboarding, settings, and manual stamping flows.
- Aqua exposes Teal XRPC routes for cursor-paginated latest plays, individual plays, actor feeds, profiles, stats, indexed search, artist discographies, and albums with track lists plus cursor-paginated listens.
- Cadet consumes Teal records from Jetstream, stores a durable cursor in Redis with file fallback, and ingests create, update, and delete events for profiles and plays.
- The public Amethyst feed uses only live Aqua XRPC data. There is no seeded, mocked, demo, or backup play feed.
- Live Jetstream ingestion has been verified end-to-end through Cadet, Postgres, Aqua, and the public preview URL.
- Missing Teal profiles fall back to public Bluesky profile data with an in-app disclaimer, and signed-in listeners can publish a Teal profile through the onboarding wizard.
- Development and production Compose files include Amethyst, Aqua, Cadet, Satellite, Postgres, and Garnet.
- Development Compose includes an optional Cloudflare Tunnel profile.
- Current temporary UI preview: `https://directory-extensive-viewer-agreement.trycloudflare.com`
  - This is an account-less Cloudflare quick tunnel. It remains available while the local tunnel process is running and its hostname will change after restart.
  - The preview serves the current Amethyst export and proxies `/xrpc/*` to the locally running Aqua API through the same public hostname.
  - The current preview build embeds `EXPO_PUBLIC_BASE_URL=https://directory-extensive-viewer-agreement.trycloudflare.com` and serves a matching `/client-metadata.json` OAuth redirect.
  - OAuth callback testing still requires the stable-host work below.

## Next: Public Demo And OAuth

- [ ] Reserve a stable Cloudflare Tunnel hostname for development OAuth testing. Quick tunnels are useful for UI previews but their random hostnames change after restart.
- [ ] Route the stable public hostname to Amethyst and expose Aqua through a public HTTPS origin or a same-origin reverse proxy.
- [ ] Build Amethyst with `EXPO_PUBLIC_BASE_URL=https://<tunnel-host>` and `EXPO_PUBLIC_AQUA_URL=https://<public-aqua-host>`.
- [ ] Serve `/client-metadata.json` with `redirect_uris=["https://<tunnel-host>/auth/callback"]`.
- [ ] Complete ATProto OAuth sign-in and callback QA through the stable public hostname.
- [x] Document the stable tunnel token or named-tunnel setup without committing secrets.

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
- [ ] Add Amethyst compose/publish flows for Teal social posts with `trackView`, replies, tags, langs, and `fm.teal.alpha.richtext.facet` mention/link rendering.
- [ ] Add Amethyst like and repost actions with optimistic viewer state, counts, undo/delete behavior, and signed-out affordances.
- [ ] Add Amethyst playlist creation, playlist editing, playlist detail routes, ordered playlist item management, cover uploads, and collaborator-author handling.
- [ ] Add Amethyst badge display on profiles plus badge definition and assignment management for authorized creators/admin flows.
- [ ] Replace placeholder Notifications copy with real social notifications for likes, reposts, replies, badge assignments, playlist collaboration, and relevant status/profile events.
- [ ] Render profile status/current-listening surfaces in Home, Profile, and actor hover/profile cards, including expired and missing-status states.
- [ ] Normalize `feed.social.defs#trackView` into existing play/music UI models while preserving deprecated `artistMbIds` and new `artists` arrays.
- [ ] Add rich-text facet parsing/rendering shared by profile descriptions, social posts, playlist descriptions, and badge descriptions.
- [ ] Regenerate and commit Rust and TypeScript lexicon bindings after the new implementation work, then run `pnpm lex:validate`.
- [ ] Add Cadet ingestion tests, Aqua route/repository tests, Amethyst interaction tests, SQLx prepare updates, and final Chrome QA for the new social/profile-status flows.

## Next: Firehose Ingestion

- [x] Add Cadet create, update, and delete integration tests for `fm.teal.alpha.feed.play`.
- [x] Add profile create, update, and delete ingestion integration tests for `fm.teal.alpha.actor.profile`.
- [x] Verify Jetstream filtering against `wantedCollections=fm.teal.alpha.feed.play` in a live environment.
- [x] Verify Cadet cursor recovery after restart with Garnet enabled.
- [x] Verify delete handling removes the play URI from `plays`, `play_to_artists`, and `play_to_artists_extended`.
- [x] Add a `subscribeRepos` CBOR adapter only if relay-level firehose sync becomes necessary.
- [x] Keep CAR import as a backfill path and add regression tests for it.

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
