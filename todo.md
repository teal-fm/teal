# Teal working handoff

## Current state

- iOS Simulator QA was run on 2026-07-13 against Amethyst on an iPhone 16 Pro / iOS 18.4.
- Full notes are in `docs/ios-simulator-qa-2026-07-13.md`.
- No teal.town account was created: `com.atproto.server.createAccount` now requires phone verification.
- A valid teal.town handle resolves in Amethyst, but native OAuth stops on the authorization server's DPoP nonce requirement.

## Next steps

- Amethyst build: persist iOS 16.4 across all generated Pod targets and verify a clean `expo prebuild` plus `expo run:ios`.
- Amethyst auth: handle `use_dpop_nonce`, then align the native redirect used by `lib/atp/oauth.tsx`, `openAuthSessionAsync`, and public client metadata.
- Amethyst signup: add a teal.town/provider-neutral account path and explain phone verification.
- Amethyst native UI: fix dark mode, Reanimated render-time warnings, keyboard dismissal, back navigation, and auth color contrast.
- Retest authenticated onboarding, Home, Search, Stamp, Settings, profile, session restore, offline/error states, and logout with a newly created teal.town account.
