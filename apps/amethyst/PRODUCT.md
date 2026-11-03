# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One Expo / React Native codebase shipping to iOS, Android, and web. It must feel native on iOS and Android, and phone and desktop-web layouts are designed to the same standard.

## Users

There is no single dominant group yet. Design serves three groups equally:

- **Atmosphere scrobblers:** people already on Bluesky / AT Protocol whose plays arrive automatically from scrobbler clients writing `fm.teal.feed.play` records to their PDS.
- **Stats-minded listeners:** long-time scrobblers (often ex-Last.fm) who care about history, charts, and depth.
- **Casual social listeners:** people who mainly want to see what friends are playing and share their own listening.

The job for all three is to keep a record of what they listen to and to feel connected to their community, and their own circle, through music.

## Product Purpose

teal.fm is a social music-tracking app built on AT Protocol. It records plays, turns them into stats and charts, and makes listening social through follows, posts, playlists, reactions, and presence. Success means people open teal to see what their community is into, not just to check their own numbers.

## Positioning

Your listening is yours. Plays live in the user's own AT Protocol repo. teal is one view over open, portable data that any app can read, and users can leave with everything. A centralized neighbor such as Last.fm, stats.fm, or Airbuds cannot truthfully make that claim.

## Operating Context

- Data flow: scrobbler or manual log → user's PDS → Jetstream → Cadet → Postgres → Aqua XRPC → Amethyst.
- Identity and sign-in use AT Protocol OAuth with the user's existing Atmosphere/Bluesky account.
- Listens can be logged manually, one at a time or in bulk, through MusicBrainz search.

## Capabilities and Constraints

- Existing capabilities: the play feed and listen detail; profiles with stats, ranked artists, albums and tracks, and a topster export; artist, release, and track pages with listeners; text posts with replies, likes, and reposts; playlists; follows; notifications; manual listen logging.
- Planned (2026-11 redesign): a "Today" community zine home; reactions on listens (a curated set plus any emoji); now-playing presence via `fm.teal.actor.status`; taste match between profiles; new Aqua endpoints for timeline, trending, and circle-scoped charts.
- MusicBrainz is canonical: artist, release, and recording identity is MBID-keyed.
- Never show seeded, mocked, backup, or demo play data. When Aqua is unavailable, show an error state. When nothing is indexed yet, show an empty state.
- `/xrpc/*` stays same-origin on web.
- Undecided: whether teal ever plays audio, or only links out through `originUrl`.
- Never add ratings or reviews (stars, scores, or review records). Song posts are the only way to say something about music (user decision, 2026-11-03).
- Manual listen logging stays available but secondary; it is not a headline feature.

## Brand Commitments

- Name: teal.fm ("teal"). The teal hue is a brand anchor that the redesign keeps and evolves.
- Fonts in the repo: DM Sans, Fraunces, Crimson Pro, and IBM Plex Mono (`assets/fonts/`).
- Quality bar (user-named, 2026-11-03): teal sits alongside Apple Music / native iOS, Are.na, and Airbuds. Clean, calm, native, never busy; no themed metaphors (radio, record-label, poster, signage costumes were rejected). Album art and people's faces carry the energy. Calm base, playful moments: Are.na-calm structure for browsing and stats; Airbuds-style colour floods and stickers for social moments, but always fast (no story timers, no one-at-a-time gating).

## Evidence on Hand

- Real play, profile, and social data comes from the live Aqua index (preview at `https://sigilyph.teal.fm`).
- Cover art comes from the Cover Art Archive by MBID.
- There are no testimonials, user counts, or press. Do not fabricate them.

## Product Principles

1. Song posts lead: a post (a track plus what someone says about it) is the primary unit of the feed; listens are woven around posts as context and presence, never the headline.
2. People first: listening is shown as something people do, not as rows of data.
3. Open by default: never obscure that the data belongs to the user and lives in their repo.
4. Celebrate, don't audit: stats should feel like a moment worth sharing, not a ledger.
5. Honest states: real data or a clear empty or error state, never filler.
6. Native everywhere: each platform gets its own idioms, with no lowest common denominator.

## Accessibility & Inclusion

WCAG 2.2 AA throughout. This covers contrast, including colors derived from album art, which must be clamped to meet it. It also covers visible focus, screen-reader labels, and respecting reduced-motion settings.
