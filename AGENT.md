# Teal Clone Agent Workflow

This file is the operational addendum for work on the Songish-style Teal clone. Read `AGENTS.md` first for the full repository development guidelines.

## Keep The Handoff Current

- Read `todo.md` before starting work.
- Update `todo.md` whenever implementation state, blockers, public preview URLs, or next steps change.
- Keep future work concrete: name the service, route, test, or deployment action that remains.
- Do not commit secrets, tunnel tokens, OAuth codes, or private credentials.

## Commit As You Go

- Work on a feature branch. Do not push directly to `main`.
- Create focused checkpoint commits after each meaningful, verified unit of work.
- Use the repository commit format: `type(scope): description`.
- Before committing, inspect `git status --short` and leave unrelated user files unstaged.
- Do not wait until the end of a long task to make the first commit.
- Report the commit hash after each checkpoint.

## Public Preview Workflow

- Use OrbStack for local Docker services when available.
- Start Postgres and Garnet before Aqua and Cadet:

```bash
open -a OrbStack
docker compose -f compose.dev.yml up -d postgres garnet
DATABASE_URL=postgres://teal:teal@127.0.0.1:5432/teal pnpm db:migrate
```

- Aqua should run against local Postgres and Garnet.
- Cadet should run continuously with Jetstream ingestion enabled:

```bash
DATABASE_URL=postgres://teal:teal@127.0.0.1:5432/teal \
REDIS_URL=redis://127.0.0.1:6379 \
CADET_STREAM_MODE=jetstream \
JETSTREAM_URL=wss://jetstream1.us-east.bsky.network/subscribe \
SQLX_OFFLINE=true cargo run -p cadet
```

- Serve Amethyst and proxy `/xrpc/*` to Aqua through the same public hostname.
- For temporary demos, a Cloudflare quick tunnel is acceptable. Record the active URL in `todo.md`.
- Treat quick-tunnel URLs as ephemeral. A tunnel restart changes the hostname.

## OAuth Tunnel Rule

- Before testing ATProto OAuth, rebuild Amethyst with the active public origin:

```bash
EXPO_PUBLIC_BASE_URL=https://<tunnel-host> \
pnpm --filter=@teal/amethyst build:web
```

- Serve `/client-metadata.json` from the same public hostname.
- Ensure the metadata uses:

```text
client_id=https://<tunnel-host>/client-metadata.json
redirect_uris=["https://<tunnel-host>/auth/callback"]
```

- Verify the deployed web bundle contains the active tunnel hostname.
- Verify `/client-metadata.json` publicly before initiating login.
- Never test public OAuth with a bundle that falls back to `localhost` or `127.0.0.1`.

## Live Feed Rule

- The production data path is Cadet Jetstream ingestion into Postgres, surfaced by Aqua XRPC.
- Keep `/xrpc/*` same-origin through the Amethyst reverse proxy.
- Never add backup, seeded, mocked, or demo play data to Amethyst.
- If Aqua is unavailable, show an error state.
- If Aqua has not indexed plays yet, show an empty state.

## Minimum Verification

Run the relevant subset before checkpoint commits:

```bash
pnpm lex:gen-server
SQLX_OFFLINE=true cargo check -p aqua -p cadet
SQLX_OFFLINE=true cargo test -p cadet stores_and_loads_cursor_from_file_when_redis_is_unavailable
pnpm --filter=@teal/amethyst build:web
docker compose -f compose.dev.yml config
docker compose -f compose.yaml config
```

For public-preview changes, also verify:

```bash
curl --fail https://<tunnel-host>/client-metadata.json
curl --fail "https://<tunnel-host>/xrpc/fm.teal.alpha.stats.getLatest?limit=5"
```
