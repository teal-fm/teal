# Teal web

The teal.fm web app: [TanStack Start](https://tanstack.com/start) on React DOM,
server-rendered, styled with Tailwind v4 on the same design tokens as the
native app ([`apps/amethyst`](../amethyst)).

## Layout

- `src/routes` – file-based routes. Public pages (profiles, posts, listens,
  playlists, artists, albums, songs) load their main query in a loader using the
  component's own query key, so the first HTML carries the content and its
  link-preview tags. Signed-in data loads in the browser.
- `src/ds` – the design system: glass panels, covers, the album-art backdrop.
- `src/components` – feature components, mirroring the native app's.
- `src/lib/auth.ts` – the account store. The OAuth client and agent
  (`authSession.ts`, `@atproto/oauth-client-browser`) load on demand.
- Shared logic (Aqua XRPC, records, MusicBrainz, query hooks) comes from
  [`@teal/client`](../../packages/client).

Music and record links keep the native app's public shape, `/:o/music/…` and
`/at://…`. Vite can't load route files with a colon in their path, so the router
rewrites them onto internal `/music` and `/at` routes (`src/router.tsx`).

## Running

`pnpm dev` at the repository root runs this app behind Caddy at
http://localhost:8081 with Aqua and the services. On its own:

```bash
pnpm --filter=@teal/web dev        # http://localhost:8082, proxies /xrpc to AQUA_URL
pnpm --filter=@teal/web build      # .output/, a self-contained Node server
node apps/web/.output/server/index.mjs
```

| Variable        | Used by                | Default                 |
| --------------- | ---------------------- | ----------------------- |
| `AQUA_URL`      | Server render, dev proxy | `http://localhost:3000` |
| `PUBLIC_ORIGIN` | `/client-metadata.json`, share links on the server | the request's origin |
| `PORT`, `HOST`  | The Node server        | `3000`, all interfaces  |

In production, `compose.yaml` runs this image (`apps/web/Dockerfile`) behind the
`edge` Caddy service, which sends `/xrpc/*` to Aqua and everything else here.
