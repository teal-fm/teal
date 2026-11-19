# teal.fm site

The public teal.fm website: the landing page plus a leaderboard, everyone's
recent listens, and anyone's top artists, tracks and albums. It's a small
TanStack Start app on Cloudflare Workers that reads from a
[HappyView](https://happyview.dev) instance indexing teal plays.

```
browser ──▶ Worker (TanStack Start, SSR + server functions)
              ├─▶ HappyView  /xrpc/fm.teal.site.*   plays, leaderboards, stats
              ├─▶ Slingshot  resolveMiniDoc         handle → DID
              └─▶ Bluesky    app.bsky.actor.*       names and avatars
```

The browser talks to the Worker, plus a few public services: Bluesky's
typeahead in the search box, cover art from the Cover Art Archive, and
Jetstream for the live "Just played" list. Signing in is the exception that
talks to HappyView directly (see below).

## Signing in

People sign in with their atproto account to edit or delete their own
listens. The browser runs the OAuth flow with `@happyview/oauth-client-browser`
against a *public* HappyView API client, so the session (a DPoP key and
tokens) stays in that browser. It asks for `atproto` plus write access to the
two play collections only. Edits and deletes call two HappyView procedures,
`fm.teal.site.updatePlay` and `fm.teal.site.deletePlay`. Their scripts check
that the play is the caller's, write to the caller's PDS (both twins, when a
play is in both collections), and update `teal_plays` straight away.

Locally the site is an atproto loopback client, which needs no published
metadata but has to run on `127.0.0.1` (signing in from `localhost` moves you
there first) and comes back to `/` rather than `/oauth/callback`. Elsewhere
the PDS reads `/oauth-client-metadata.json`.

## HappyView

`happyview/` holds everything HappyView needs:

- `lexicons/`: both play collections (`fm.teal.feed.play` and the older
  `fm.teal.alpha.feed.play`) plus the site's three queries.
- `scripts/play.lua`: a record script on both play collections. It copies each
  play into a narrow `teal_plays` table: one row per play (the stable copy wins
  over an alpha twin), with a normalized UTC `played_at`. HappyView stores
  records as JSON text, which is far too slow to aggregate directly.
- `scripts/fm.teal.site.*.lua`: the query handlers, plain SQL over `teal_plays`.
  Leaderboards are cached in `teal_site_cache` for 2 to 60 minutes, depending
  on the period.
- `scripts/fm.teal.site.updatePlay.lua`, `scripts/fm.teal.site.deletePlay.lua`:
  the procedures behind editing and deleting your own listens.
- `scripts/prelude.lua`: helpers shared by all of the above. `sync.ts`
  prepends it to each script, since the sandbox has no `require`.

The scripts create their tables and indexes the first time they need them, so
there's no SQL to run by hand.

### Local

```sh
docker compose -f happyview/compose.yaml up -d
docker compose -f happyview/compose.yaml exec -T postgres psql -U happyview < happyview/dev-admin.sql
export HAPPYVIEW_ADMIN_KEY=hv_local_development_only

# Scripts and lexicons, without crawling the whole network…
pnpm hv:sync --no-backfill
# …then a few accounts' history.
pnpm hv:sync backfill alice.bsky.social did:plc:...

# The site's API client and its sign-in client; paste the output into .dev.vars
# (see .dev.vars.example).
pnpm hv:sync client http://localhost:3005
pnpm hv:sync login-client http://localhost:3005
pnpm dev   # http://127.0.0.1:3005
```

### Production

- **Site:** the `teal-site` Worker on Cloudflare, serving `teal.fm` (a custom
  domain in `wrangler.jsonc`) with Smart Placement.
- **Deploys:** Workers Builds deploys every push to `main` that touches
  `apps/site/` or `pnpm-lock.yaml`. It installs only this app
  (`SKIP_DEPENDENCY_INSTALL=1`, then `pnpm install --filter "@teal/site..."
  --ignore-scripts`), builds it, runs `node happyview/sync.ts --no-backfill`
  against `view.teal.fm`, then `wrangler deploy`. Its `HAPPYVIEW_ADMIN_KEY`
  build secret is a key that can only change lexicons and scripts. Build logs
  are under the Worker's Deployments tab in the Cloudflare dashboard. To deploy
  by hand, run `pnpm deploy`, deleting `dist/server/.dev.vars` first (the Vite
  plugin copies it there for `vite preview`).
- **HappyView:** the `teal-happyview` Railway project, at `https://view.teal.fm`.
  It runs the pinned `ghcr.io/gamesgamesgamesgamesgames/happyview:2.17.6`
  image (the loopback sign-in fix relies on how this version builds client
  IDs) against Railway Postgres, which has daily and weekly backups. Railway
  Postgres allows 100 connections, so HappyView's pools are sized to fit:
  `DATABASE_MAX_CONNECTIONS=24` and `BACKFILL_CONCURRENT_RESOLUTION=30`, for a
  64-connection backfill pool.
- **Keys:** the super user is the site owner's DID, and the sync API key is in
  `.prod.vars` (gitignored). Sync against production with
  `set -a; . ./.prod.vars; set +a; pnpm hv:sync`. The Worker's
  `HAPPYVIEW_CLIENT_KEY` and `HAPPYVIEW_CLIENT_SECRET` are Worker secrets; the
  public `HAPPYVIEW_LOGIN_CLIENT_KEY` is a var in `wrangler.jsonc`.
- **Rollback:** the old landing page is still the `teal-landing` Pages project.
  Detach `teal.fm` from the Worker and point it back there.

Re-run `pnpm hv:sync` whenever a lexicon or script changes. If `play.lua`
changes how it fills `teal_plays`, backfill again to rebuild existing rows.

## Pages

- `/`: the logo, handle search, the leaderboard (today, this week, this month
  or all time), the latest listens, and then the old landing page.
- `/profile/$handle`: someone's listen counts, top artists, tracks and albums
  for a period, and their listens, paged.
- `/listens`: everyone's listens, newest first, paged.
- `/listen/$actor/$rkey`: one listen, by the listener's handle or DID and the
  play's record key, so anything can link to a listen. It reads the record from
  the listener's repo through Slingshot (stable collection first, then alpha),
  so it works before HappyView has indexed the play. Every list's timestamps
  link here.
- `/oauth/callback`, `/oauth-client-metadata.json`: sign-in.

Signed in, your own listens get an edit button on every list. The live list
pauses (and drops its Jetstream socket) when you press its Live badge.

If HappyView is down, the home page still renders without the leaderboard.
