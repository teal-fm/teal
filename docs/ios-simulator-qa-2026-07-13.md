# Amethyst iOS Simulator QA — 2026-07-13

## Executive summary

Amethyst was built from the current `main` baseline, installed on an iPhone 16 Pro Simulator, and exercised through every reachable unauthenticated path. The app is not ready for an iOS release or a teal.town account walkthrough yet.

Two independent blockers prevent the requested end-to-end test:

1. `teal.town` rejects account creation unless the user completes phone verification. A fresh random handle, email, and password were submitted once to `com.atproto.server.createAccount`; the PDS returned HTTP 400, `Verification is now required on this server.` No account was created, and the generated password was not saved.
2. A known-good teal.town identity resolves in Amethyst, but native sign-in fails before the authorization sheet appears. The app reports `OAuth "use_dpop_nonce" error: Authorization server requires nonce in DPoP proof` and then collapses that into `Could not get login url.`

Authenticated Home, Search, Stamp, Settings, profile, onboarding, write, and logout flows therefore remain untestable through the real app. This is a blocked coverage area, not a pass.

## Test environment

- Branch: `feature/ios-app-qa`
- App: Amethyst / `fm.teal.amethyst`
- Expo: 56.0.4
- React Native: 0.85.3
- Xcode: 26.6 (17F113)
- Simulator: iPhone 16 Pro, iOS 18.4
- App API origin: `https://sigilyph.teal.fm`
- PDS: `https://teal.town`
- Test identity for resolution only: `bailey.teal.town`
- Automation: native XCTest-backed Simulator interaction through Maestro 2.6.1, plus manual screenshot review

The floating gray gear visible in development screenshots is Expo's development-menu control and should not appear in a release build. It is not counted as an Amethyst product defect below.

## Build result

The native build eventually completed and installed, but a clean checkout does not build without modifying generated iOS files.

`expo run:ios` initially generated Pod targets with `IPHONEOS_DEPLOYMENT_TARGET = 15.1`. The Swift compiler then rejected `@atproto/oauth-client-expo` because `ExpoModulesCore` requires iOS 16.4. For this QA run only, the ignored generated `apps/amethyst/ios/Podfile` was patched in `post_install` to force every Pod target to iOS 16.4. After `pod install`, the app built with zero errors and one Expo Dev Launcher warning.

This workaround was not committed. The repository needs to encode the deployment target through Expo/CocoaPods configuration so a clean native build is reproducible.

An earlier build also ran out of disk space while installing Pods. That was an environment issue and is not classified as an app defect.

## Account-creation result

`com.atproto.server.describeServer` currently reports:

```json
{
  "availableUserDomains": [".teal.town", ".luxray.app"],
  "inviteCodeRequired": false,
  "phoneVerificationRequired": true
}
```

The attempted handle was `iosqa-20260713-a7f3.teal.town`. The randomly generated email and password were used only for the single request and are intentionally omitted. The account does not resolve, confirming that it was not created.

The teal.town homepage does not offer a new-account flow. Its “move to town” action sends existing users to a migration service. Amethyst's Sign up flow sends users to Bluesky instead of teal.town, so neither surface explains or satisfies teal.town's verification requirement.

## Tested flows

| Area | Result | Evidence |
| --- | --- | --- |
| Cold launch | Pass with caveat | App launches to the authentication choice after Expo's development overlay is dismissed. |
| Authentication choice | Pass | “Sign in with ATProto” and “Sign up” are visible and tappable. |
| Sign-up explanation | Pass with UX issues | Screen renders and explains PDS at a high level. |
| Sign-up CTA | Pass, wrong provider for request | Opens `bsky.app` in system Safari and returns to Amethyst through the iOS breadcrumb. It never offers teal.town. |
| Invalid handle | Pass with UX issues | `iosqa-20260713-a7f3.teal.town` displays “Couldn't resolve handle.” |
| Valid teal.town handle | Pass | `bailey.teal.town` resolves and displays `PDS: teal.town`. |
| Start OAuth | **Fail** | Fails before browser authorization with the DPoP nonce error. |
| Create teal.town account | **Blocked** | PDS requires phone verification; no account was created. |
| Back navigation from auth screens | **Fail** | No visible back control; a standard left-edge swipe did not return to the previous screen. |
| Keyboard dismissal | **Fail** | No Done control; tapping outside does not dismiss it, and the standard automation dismiss action cannot find a dismiss path. |
| Light appearance | Partial | Main unauthenticated screens render, but several states have contrast and transient rendering issues. |
| Dark appearance | **Fail** | Content becomes black-on-black or disappears while controls retain light-theme colors. |
| Authenticated tabs and actions | **Blocked** | Cannot be reached through a real account/session. |

## Findings, ordered by priority

### P0 — Clean iOS native build is not reproducible

**Observed:** A generated Pod target compiles for iOS 15.1 while ExpoModulesCore requires 16.4, stopping the Swift build in `ExpoAtprotoOAuthClientModule.swift`.

**Improve:** Make Expo prebuild/CocoaPods set 16.4 for all Pod targets, then verify from a deleted `ios` directory with `expo prebuild --clean`, `pod install`, and `expo run:ios`.

### P0 — teal.town account creation cannot be completed from the app

**Observed:** The PDS requires phone verification, teal.town has no public creation UI, and Amethyst only links to Bluesky signup.

**Improve:** Add an explicit PDS selection/account-creation path. For teal.town, either provide an approved phone-verification flow or explain that registration is unavailable and what the user must do. Never present Bluesky as the only signup choice after describing a federated PDS ecosystem.

### P0 — teal.town native OAuth fails on DPoP nonce handling

**Observed:** A valid teal.town handle resolves correctly. Tapping Sign in produces `OAuth "use_dpop_nonce" error: Authorization server requires nonce in DPoP proof` before an authorization browser opens.

**Improve:** Update or fix the Expo OAuth client so it retries the request with the authorization server's DPoP nonce. Preserve the detailed underlying error in logs, but show a short actionable message in the UI.

### P0 — native redirect metadata is inconsistent

**Source audit:** Native client construction uses `https://sigilyph.teal.fm/app-return/fm.teal.amethyst`; `openAuthSessionAsync` is passed `http://127.0.0.1:8081/login`; and the deployed `client-metadata.json` only declares `https://sigilyph.teal.fm/auth/callback` with `application_type: web`.

The DPoP failure occurs first, so this mismatch was not reached in the UI test. It is nevertheless expected to prevent a successful native callback after DPoP is fixed.

**Improve:** Choose one native redirect design, publish that exact URI in client metadata, configure the correct application type, and pass the same URI to both OAuth construction and `openAuthSessionAsync`. Add a native callback integration test.

### P1 — dark mode is unusable

**Observed:** Switching the Simulator to dark appearance makes large portions of the screen and keyboard-adjacent UI black while the app's text remains black. Headings, input contents, link labels, and button labels partially or fully disappear.

**Likely contributing code:** `useTheme()` calls `setColorScheme()` during render. Runtime logs repeatedly warn that shared Reanimated values are read and written during render.

**Improve:** Never mutate the color scheme during render. Apply a stable navigation theme and verify every auth screen in both appearances with screenshot tests.

### P1 — keyboard and animated layout produce broken frames

**Observed:** While the keyboard opens and immediately after Sign in is tapped, screenshots capture large black rectangles over the app and keyboard, clipped content, and temporarily missing glyphs. Runtime logs repeatedly report Reanimated shared-value reads/writes during render.

**Improve:** Remove the manual `bottom: keyboardHeight / 3` positioning, use a native keyboard-aware layout, and correct shared-value access. Test interactively during keyboard transitions rather than only at settled states.

### P1 — auth screens have no dependable iOS back or keyboard-dismiss behavior

**Observed:** Stack headers are hidden on both auth screens, no custom back button is provided, and a standard edge swipe did not pop. The login input autofocuses immediately, but there is no Done toolbar or visible keyboard-dismiss control. Tapping the heading does not dismiss the keyboard.

**Improve:** Use the native stack header/back affordance or add a correctly placed 44-point back button while retaining the interactive pop gesture. Set an appropriate return-key label and supply an explicit keyboard-dismiss action.

### P1 — contrast is weak and state communication is inconsistent

**Observed:** Pink link text on the nearly white background is low contrast. Dark purple labels on saturated blue buttons are also difficult to read. The disabled Sign in button still looks prominent, and its label/arrow have especially weak contrast. Error details appear in a short-lived toast near the keyboard and can be missed.

**Improve:** Validate WCAG contrast for every semantic color pair, reduce disabled emphasis, and place persistent inline errors near the affected control with accessible announcements.

### P2 — the unauthenticated UI feels web-derived rather than native

**Observed:** Screens use very large centered marketing typography, oversized decorative icons, pill CTAs, broad empty vertical space, hidden navigation chrome, and custom animated form panels. The layout resembles a centered responsive webpage rather than a standard iOS onboarding/sign-in flow.

**Improve:** Use a native navigation bar, conventional grouped form spacing, iOS button hierarchy, predictable margins, and less ornamental scale. Keep the teal visual identity in typography and color without replacing navigation and form conventions.

### P2 — signup copy contradicts provider choice

**Observed:** The screen explains that users may choose a PDS, then only offers “To Bluesky.” The login screen likewise says “Sign up for Bluesky.” This is especially confusing for a teal.town user.

**Improve:** Offer provider-neutral language and at least one path to enter/select another PDS. If signup is intentionally Bluesky-only, say so before describing the broader federation model.

## What worked well

- The app respects the top and bottom safe areas in the settled light-mode screens.
- Primary buttons meet a roughly 44-point minimum tap height.
- PDS discovery gives immediate inline feedback and correctly identifies a valid teal.town account.
- Opening Bluesky uses system Safari rather than an embedded web imitation, and iOS provides a working return breadcrumb.
- Invalid-handle feedback is placed directly beneath the input rather than in a detached modal.

## Recommended fix order and retest gate

1. Make a clean generated iOS project build without a Podfile hand edit.
2. Fix DPoP nonce retry and unify native redirect metadata/callback handling.
3. Decide and document the teal.town phone-verification/account-creation experience.
4. Fix dark mode and keyboard animation/render warnings.
5. Restore native back navigation, keyboard dismissal, and accessible colors.
6. Repeat this run with a newly created teal.town account, then test onboarding, Home, Search, Stamp creation, Settings, profile, session restore, offline/error behavior, and logout.

The end-to-end acceptance gate should require a clean build plus a new teal.town user progressing from signup through OAuth, onboarding, one read action, one write action, app relaunch/session restore, and logout on a stock Simulator without source or generated-file edits.
