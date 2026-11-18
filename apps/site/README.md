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

The browser only talks to the Worker, apart from Bluesky's public typeahead in
the search box and cover art from the Cover Art Archive.

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

# The site's API client; paste the output into .dev.vars (see .dev.vars.example).
pnpm hv:sync client http://localhost:3005
pnpm dev
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
5. Set `HAPPYVIEW_URL` in `wrangler.jsonc` and run `pnpm deploy`.

Re-run `pnpm hv:sync` whenever a lexicon or script changes. If `play.lua`
changes how it fills `teal_plays`, backfill again to rebuild existing rows.

## Pages

- `/`: the logo, handle search, the leaderboard (today, this week, this month
  or all time), the latest listens, and then the old landing page.
- `/profile/$handle`: someone's listen counts, top artists, tracks and albums
  for a period, and their listens, paged.
- `/listens`: everyone's listens, newest first, paged.

If HappyView is down, the home page still renders without the leaderboard.
