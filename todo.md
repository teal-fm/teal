# Teal TODO

- Aqua: add recording-scoped listening history across album editions.
- Aqua: normalize artist aliases in rankings without merging distinct identities.
- Web: run `pnpm dev --proxy` end to end with live Aqua data and ATProto OAuth sign-in; blocked locally because the `postgres_db` volume is Postgres 17 and `compose.dev.yml` runs 16.
- Web: point production DNS/deploy at the `web` + `edge` services in `compose.yaml` (the old `amethyst` static container is gone) and set `PUBLIC_ORIGIN`.
- Amethyst: remove dead `Platform.OS === "web"` branches and the `react-native-web`/`react-dom` dependencies now that it ships to iOS and Android only.
- Amethyst: `expo export --platform ios` fails on `global.entry.css` ("failed to deserialize ... Specifier"); already broken on `obbpr`.
