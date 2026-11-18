# Teal app QA notes

Date: 2026-07-16
Environment: Chrome on macOS, stable preview at `https://sigilyph.teal.fm`
Target PDS: `https://teal.town`

## Status

Account creation completed after the hCaptcha was solved by the user. The test handle is `codexqa716.teal.town`. No password is recorded here. Teal OAuth was approved, the Teal profile was created, and the authenticated session survived navigation and a browser reload.

## Findings

### P0 — Signup depends on an interactive hCaptcha

- Reproduction: open the app's `Sign in with ATProto` flow, follow `Sign up for Bluesky`, choose `Custom`, enter `https://teal.town`, fill the account details, and continue through handle selection.
- Result: the flow reaches `Step 3 of 3 — Complete the challenge` and embeds an hCaptcha hosted by `newassets.hcaptcha.com`.
- Impact: unattended QA cannot complete account creation; a human must solve the challenge.
- Improvement: document this dependency in the QA/setup flow and provide a clearly supported test-PDS path or test-environment bypass for authorized automated testing.

### P1 — The app's signup link points to a stale Bluesky URL

- The app links to `https://bsky.app/signup`, which returned HTTP 404 in Chrome.
- Navigating to `https://bsky.app` then surfaced the create-account flow successfully.
- Improvement: update the signup link to the current Bluesky signup entry point and add a link smoke test.

### P1 — PDS selection is indirect and confusing

- The app's sign-in page asks for an existing ATProto handle; account creation is delegated to Bluesky's signup UI.
- To use teal.town, the tester must discover `Bluesky Social → Custom → Server address → https://teal.town`.
- The teal.town homepage itself only exposes a plain-text landing page and a `PDS MOOver` migration tool, which does not present a new-account path.
- Improvement: provide a first-party “Create a teal.town account” path or clearly explain the supported signup flow from the app.

### P2 — Public app is usable but visibly early-stage

- Logged-out home loads live posts, listens, top artists, and releases.
- The UI shows a prominent “early early work in progress” warning and several disabled engagement controls; each post repeats “Sign in to like or repost Teal social posts.”
- Improvement: make the preview warning less visually dominant, consolidate logged-out sign-in prompts, and ensure disabled controls communicate why they are unavailable.

### P2 — teal.town landing page has very little onboarding context

- `https://teal.town` renders mostly plain text/ASCII art, with links to legal pages, neighbors, and PDS MOOver.
- Improvement: add concise onboarding copy explaining what the PDS is, how to create an account, and how it connects to Teal.

### P1 — Teal OAuth consent is broad and arrives without app-specific context

- Teal correctly resolved `codexqa716.teal.town` to the teal.town PDS and redirected to `teal.town/oauth/authorize`.
- The consent screen says `https://sigilyph.teal.fm/client-metadata.json` requests profile, posts, likes, follows, repository writes, and authenticated actions.
- Improvement: make the consent handoff explain Teal's intended capabilities in plain language, minimize requested scopes where possible, and provide a clear return path if the user denies access.

### P1 — Teal profile setup is required for a complete first-run experience

- After OAuth, the account profile falls back to the Bluesky profile and shows “This listener has not created a Teal profile yet.”
- The onboarding flow has three steps: display name, optional liner note, and optional avatar/banner artwork.
- The final step exposes `Create profile`; no Teal profile exists until that action is submitted.
- Improvement: explain earlier that the account can authenticate without a Teal profile but that posting and playlist identity may be incomplete until setup is finished.

### P1 — Profile bio save reports a fetch failure

- Reproduction: open the authenticated profile, choose `Edit profile`, enter `Testing Teal from a teal.town account.`, and choose `Save profile`.
- Result: the editor displayed `Failed to fetch` and remained open; the public profile did not visibly show the new bio.
- Improvement: surface the underlying API error, keep the form state recoverable, and verify the profile record before closing the editor.

### P1 — Notifications do not reflect successful self activity

- The test post was successfully liked, reposted, and replied to, with the post detail showing counts of 1, 1, and 1 respectively.
- Opening `/notifications` immediately afterward showed `No notifications yet.`
- This may be intentional for self-actions, but the UI provides no explanation and gives no way to distinguish “no notifications” from delayed indexing.
- Improvement: document self-notification semantics and show indexing/loading status or a last-updated indicator.

### P1 — Playlist track management is blocked for a selected composer track

- A playlist was created as `Teal QA Playlist`, then edited successfully to `Teal QA Playlist Edited` with an updated description.
- The playlist remained at `0 tracks`; its `Add current track` control was disabled even while the composer had `Creep Liam Lynch` selected.
- The page displayed `No indexed playlist items yet.`
- Improvement: allow adding the selected track, or explain why it is unavailable (for example, missing indexed play data) instead of presenting a disabled action with no rationale.

### P2 — Composer song search is usable but needs clearer feedback

- `Choose a song` opened the picker and initially showed `No indexed recent plays found.`
- Searching `Creep` returned indexed song results and allowed selecting `Creep Liam Lynch`; selecting a track enabled the post composer.
- A first search entry did not visibly update until the field was retried with a broader query.
- Improvement: show explicit search progress/errors, make selected-track state more prominent, and make the empty recent-plays state actionable.

### P2 — Music detail routes can appear empty

- The selected song link opened the expected music route, but the visible page still showed the global feed/profile shell and `Waiting for plays.` rather than a clear track detail view.
- Improvement: provide a dedicated loading/empty state explaining whether metadata is missing, indexing is delayed, or the route failed to render its detail content.

## Flows reached

- Stable preview home: loaded successfully with live feed data.
- Teal sign-in page: loaded successfully and exposed a handle field plus PDS-resolution status.
- Bluesky custom-provider signup: accepted `https://teal.town`, validated the handle, reached hCaptcha, and completed account creation after the user solved the challenge.
- Bluesky onboarding: completed without avatar, interest, suggested-follow, or starter-pack selections.
- Teal sign-in: resolved `codexqa716.teal.town` to `teal.town`, authenticated successfully, and reached OAuth consent.
- Teal OAuth authorization: approved successfully; returned to the app as `Codex QA @ codexqa716.teal.town`.
- Teal profile onboarding: created a profile with display name `Codex QA`; optional liner note and artwork were skipped.
- Composer: selected `Creep Liam Lynch`, published `teal QA test post — hello from codexqa716`, and verified it in the global feed and profile.
- Social actions: liked, reposted, and replied to the test post. Final counts were 1 like, 1 repost, and 1 reply. Reply text was `Replying to my first Teal QA post.`
- Post detail: loaded the post permalink and displayed the conversation reply.
- Explore/search: searched `Creep`; returned 12 matching people/songs/artists/albums and song result links.
- Notifications: loaded successfully but showed no notifications after the test account's activity.
- Playlists: created and edited a playlist successfully; adding the selected track was unavailable and the playlist remained empty.
- Profile editing: editor opened, but saving a bio produced `Failed to fetch` and did not visibly persist the bio.
- Social graph: Followers loaded with `No indexed followers yet.`; Following loaded with `No indexed follows yet.`
- Session persistence: the authenticated post detail remained available after a browser reload.

## Next QA steps

- Investigate the profile bio `Failed to fetch` response and verify authenticated profile writes against the teal.town PDS.
- Implement or clarify playlist track indexing/addition so a selected composer track can be added.
- Define and expose notification/indexing semantics for self-generated activity.
- Add a real track-detail loading/empty state for routes that currently end at `Waiting for plays.`
