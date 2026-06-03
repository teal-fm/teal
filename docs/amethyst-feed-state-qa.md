# Amethyst Feed State QA

Date: 2026-06-03

Build verified:

```bash
pnpm --filter=@teal/amethyst build:web
```

QA method:

- Served the production web export from `apps/amethyst/build`.
- Used local QA-only `/xrpc/fm.teal.alpha.stats.getLatest` responses to exercise feed states without adding seeded or backup feed data to the app.
- Checked desktop viewport at `1280x900`.
- Checked mobile viewport at `390x844`.

Observed states:

| State | Viewport | Evidence |
| --- | --- | --- |
| Error feed | Desktop | Home rendered the app shell, signed-out rail, and `Could not load the Teal play feed`. |
| Empty feed | Desktop | Home rendered the app shell, signed-out rail, and `No plays indexed yet.` |
| Populated feed | Desktop | Home rendered a live-shaped play card with long track and artist text. |
| Empty feed | Mobile | Home rendered at `390px` width with desktop rail hidden and `No plays indexed yet.` visible. |
| Populated feed | Mobile | Home rendered at `390px` width with long play-card text present. |
| Loading phase | Mobile | Before the delayed feed response resolved, the final empty/error states were absent. |
| Signed-out | Desktop | The sign-in affordance `Sign in` / `with ATProto` was visible in the left rail. |

Screenshot note:

The in-app browser route verification worked, but screenshot capture timed out in the browser backend. Final live screenshots are still tracked separately because they should be captured after Aqua and Cadet are running with live ingested data.

