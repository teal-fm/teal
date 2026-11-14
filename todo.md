# Teal TODO

- Aqua: add recording-scoped listening history across album editions.
- Aqua: normalize artist aliases in rankings without merging distinct identities.
- Web: test ATProto OAuth sign-in and signed-in flows (reactions, follow, compose, stamp, edit profile, sign-out) in a browser signed into Bluesky; QA in `.codex-run/web-ux-notes.md` had no account.
- Web: point production DNS/deploy at the `web` + `edge` services in `compose.yaml` (the old `amethyst` static container is gone) and set `PUBLIC_ORIGIN`.
- Amethyst: remove dead `Platform.OS === "web"` branches and the `react-native-web`/`react-dom` dependencies now that it ships to iOS and Android only.
- Amethyst: `expo export --platform ios` fails on `global.entry.css` ("failed to deserialize ... Specifier"); already broken on `obbpr`.
- Client: top tracks fire one MusicBrainz lookup per row and hit HTTP 503s; queue `getRecordingCoverArtUrl` to MusicBrainz's 1 req/s.
- Client: Explore People hides a failed Bluesky actor search; say results are partial and offer a retry.
- Aqua: merge album track-list title variants (`Spaceship` vs `Spaceship (feat. Sheck Wes)`) and song results that differ only in artist credit order.
