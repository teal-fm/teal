# Teal TODO

- Aqua: add recording-scoped listening history across album editions.
- Aqua: normalize artist aliases in rankings without merging distinct identities.
- Web: test ATProto OAuth sign-in and signed-in flows (reactions, follow, compose, stamp, edit profile, sign-out) in a browser signed into Bluesky; QA in `.codex-run/web-ux-notes.md` had no account.
- Web: point production DNS/deploy at the `web` + `edge` services in `compose.yaml` (the old `amethyst` static container is gone) and set `PUBLIC_ORIGIN`.
- Amethyst: `useLayout()` sidebar/rail layouts and `PageTitle` only ever applied on the web; decide whether wide Android screens get them or remove the branches (27 call sites).
- Amethyst: `expo export --platform android` fails on `global.entry.css` ("failed to deserialize ... Specifier"), so the `build-android` CI job on main fails; same error the iOS export had on `obbpr`.
- Amethyst: verify public-origin sign-in on a device with `EXPO_PUBLIC_BASE_URL` set (native client at `/android-client-metadata.json`, reversed-host redirect scheme); check Expo Router doesn't also route the `/oauth/callback` deep link.
- iOS: finish OAuth sign-in with a real account against a public origin and test signed-in flows (reactions, follow, post, reply, log listens, playlists, edit profile, sign-out); verified up to the PDS password page.
- iOS: not yet ported from Android: bulk-editing listens, saved-but-unindexed listens in history, playlist editing and collaborators, the onboarding flow (Edit profile covers setup), Today's collapse strip, and iPad rail layouts.
- iOS: before TestFlight, set the signing team, confirm the `fm.teal.amethyst` bundle ID and the production `TEAL_ORIGIN`, and replace the placeholder app icon (shared with Android).
- Client: top tracks fire one MusicBrainz lookup per row and hit HTTP 503s; queue `getRecordingCoverArtUrl` to MusicBrainz's 1 req/s.
- Client: Explore People hides a failed Bluesky actor search; say results are partial and offer a retry.
- Aqua: merge album track-list title variants (`Spaceship` vs `Spaceship (feat. Sheck Wes)`) and song results that differ only in artist credit order.
