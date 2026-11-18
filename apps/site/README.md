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
metadata but has to run on `127.0.0.1`: signing in from `localhost` moves
you there first. Elsewhere the PDS reads `/oauth-client-metadata.json`.

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

1. Deploy HappyView with Postgres, following its
   `docker-compose.prod.postgres.yml`. The full network backfill holds about
   8M play records.
2. Sign in to its dashboard (the first account becomes super user) and create
   an API key with lexicon, script, backfill and API client permissions.
3. `HAPPYVIEW_URL=https://… HAPPYVIEW_ADMIN_KEY=hv_… pnpm hv:sync`. Uploading
   the play lexicons for the first time starts the network backfill.
4. `pnpm hv:sync client https://teal.fm`, then store the printed key and secret
   with `wrangler secret put HAPPYVIEW_CLIENT_KEY` and `… HAPPYVIEW_CLIENT_SECRET`.
5. `pnpm hv:sync login-client https://teal.fm`, and set the printed
   `HAPPYVIEW_LOGIN_CLIENT_KEY` as a var (it isn't secret). Set
   `HAPPYVIEW_PUBLIC_URL` too if browsers reach HappyView at another URL.
6. Set `HAPPYVIEW_URL` in `wrangler.jsonc` and run `pnpm deploy`.

Re-run `pnpm hv:sync` whenever a lexicon or script changes. If `play.lua`
changes how it fills `teal_plays`, backfill again to rebuild existing rows.

## Pages

- `/`: the logo, handle search, the leaderboard (today, this week, this month
  or all time), the latest listens, and then the old landing page.
- `/profile/$handle`: someone's listen counts, top artists, tracks and albums
  for a period, and their listens, paged.
- `/listens`: everyone's listens, newest first, paged.
- `/oauth/callback`, `/oauth-client-metadata.json`: sign-in.

Signed in, your own listens get an edit button on every list. The live list
pauses (and drops its Jetstream socket) when you press its Live badge.

If HappyView is down, the home page still renders without the leaderboard.
