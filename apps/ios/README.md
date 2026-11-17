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

`TEAL_ORIGIN` (a build setting, default `https://sigilyph.teal.fm`) is the public
origin that serves `/xrpc` and the OAuth client metadata. A `TEAL_ORIGIN`
environment variable in the run scheme overrides it, for example
`http://localhost:8081` to browse a local stack in the simulator.

OAuth needs a public HTTPS origin. The client ID is
`<origin>/ios-client-metadata.json` (served by `apps/web`), and the redirect is
the origin's host reversed as a custom scheme:
`sigilyph.teal.fm` → `fm.teal.sigilyph:/oauth/callback`. To sign in against a
dev stack, run `pnpm dev --proxy` (or a quick tunnel with `DEV_PUBLIC_ORIGIN`)
and build with `TEAL_ORIGIN` set to that origin.

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
