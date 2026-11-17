# teal for iOS

The native iOS app, in SwiftUI. Android stays on React Native in
[`apps/amethyst`](../amethyst); the web app is [`apps/web`](../web).

- iOS 26 and later, Swift 6, Liquid Glass. No third-party packages.
- Reads from Aqua's `fm.teal.*` XRPC and the public Bluesky AppView; writes go
  straight to the signed-in account's PDS.
- Sign-in is ATProto OAuth as a native public client: PAR, PKCE, and DPoP
  (CryptoKit P-256), through `ASWebAuthenticationSession`. Tokens and the DPoP
  key live in the Keychain, on this device only.

## Run it

```bash
brew install xcodegen
pnpm dev:ios          # generates Teal.xcodeproj and opens it
```

The project is generated from [`project.yml`](project.yml); `Teal.xcodeproj` is
not checked in. Run `pnpm ios:project` after adding or removing files.

## Which server

`TEAL_ORIGIN` is the origin that serves `/xrpc` and the OAuth client metadata.
Debug builds use the local stack (`pnpm dev`, `http://localhost:8081`); Release
builds use `https://sigilyph.teal.fm` (see [`Config/`](Config)). A gitignored
`Config/Local.xcconfig` overrides it for Debug, and a `TEAL_ORIGIN` environment
variable in the run scheme overrides both.

OAuth needs a public HTTPS origin on the default port; PDSes reject client IDs
with a custom port. The client ID is `<origin>/ios-client-metadata.json` (served
by `apps/web`), and the redirect is the origin's host reversed as a custom
scheme: `sigilyph.teal.fm` → `fm.teal.sigilyph:/oauth/callback`. To sign in
against a dev stack, expose the edge publicly, for example with Tailscale Funnel:

```bash
tailscale funnel --bg --https=443 http://127.0.0.1:8081
DEV_PUBLIC_ORIGIN=https://<machine>.<tailnet>.ts.net pnpm dev
echo 'TEAL_ORIGIN = https:/$()/<machine>.<tailnet>.ts.net' > apps/ios/Config/Local.xcconfig
```

## Layout

- `App`: the tab shell and routing (`Route`; teal web links open in the app).
- `Auth`: OAuth, DPoP, the Keychain session, and the PDS client.
- `Networking`: Aqua, MusicBrainz, Cover Art Archive, and record writes.
- `DesignSystem`: colour tokens, glass panels, covers, and the drifting cover backdrop.
- `Screens`: one file per area.

## Test

```bash
cd apps/ios && xcodebuild test -project Teal.xcodeproj -scheme Teal \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro'
```
