# Amethyst Live Data Chrome Screenshots

Date: 2026-06-03

## Environment

- Aqua was running locally on `http://127.0.0.1:3000`.
- Cadet was running in Jetstream mode and connected to `wss://jetstream1.us-east.bsky.network/subscribe`.
- The Amethyst static export was served on `http://127.0.0.1:4178`.
- The local preview proxied `/xrpc/*` to Aqua on the same origin.
- Aqua latest-play API returned live indexed records, including records created less than one minute before the screenshot pass.

## Captures

- Desktop Chrome viewport, 1280 x 900: `docs/qa/screenshots/amethyst-live-desktop-2026-06-03.png`
- Mobile Chrome viewport, 390 x 844: `docs/qa/screenshots/amethyst-live-mobile-2026-06-03.png`

## Verification

- Both Chrome captures rendered the live global feed with `LIVE INDEX` and `Recently listened`.
- Both captures included latest live items from Aqua, including `Ayla's Theme (Arrange Version)` and `Stereo Love`.
- Both captures included live actor identity text from indexed records, including `@natalie.sh` and `@quasigod.xyz`.
