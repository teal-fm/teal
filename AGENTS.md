# Teal Development Guidelines

## Build Commands
- Dev server: `turbo dev --filter=@teal/aqua`
- Build all: `pnpm build`
- Build Rust: `pnpm build:rust`
- Test: `pnpm test`
- DB migrate: `pnpm db:migrate`
- DB reset: `pnpm db:reset`
- Lexicon gen: `pnpm lex:gen`
- Setup: `./scripts/setup-sqlx.sh`

## Project Structure
```
teal/
├── apps/aqua/              # Main Rust/Axum web app
├── services/
│   ├── cadet/             # AT Protocol jetstream consumer
│   ├── rocketman/         # Jetstream library
│   ├── satellite/         # Processing service
│   ├── types/             # Shared types
│   └── migrations/        # SQLx migrations
├── lexicons/fm.teal.alpha/ # AT Protocol schemas
│   ├── feed/              # Music play types
│   ├── actor/             # Profile types
│   └── stats/             # Analytics
├── tools/lexicon-cli/      # Code generation
└── compose.yaml           # Docker setup
```

## Tech Stack
- **Backend**: Rust (Axum, SQLx, Tokio, Serde, Tracing)
- **Database**: PostgreSQL + Garnet/Redis
- **Frontend**: TypeScript, Turbo, pnpm, Biome
- **Protocol**: AT Protocol, IPLD/CAR, WebSocket streams
- **Deploy**: Docker Compose, Traefik

## Services
- **Aqua**: HTTP API, OAuth, play submission, profiles, CAR import
- **Cadet**: Real-time jetstream consumer, background jobs, metrics
- **Rocketman**: Reusable WebSocket consumer framework
- **Satellite**: Analytics, aggregation, external APIs

## Database Schema
```sql
artists (mbid UUID, name TEXT, play_count INTEGER)
releases (mbid UUID, name TEXT, play_count INTEGER)
recordings (mbid UUID, name TEXT, play_count INTEGER)
plays (uri TEXT, did TEXT, rkey TEXT, cid TEXT, track_name TEXT,
       played_time TIMESTAMPTZ, recording_mbid UUID, release_mbid UUID,
       submission_client_agent TEXT, music_service_base_domain TEXT)
profiles (did TEXT, display_name TEXT, description TEXT, avatar BLOB, banner BLOB)
```

## AT Protocol Integration
### Music Play Schema (`fm.teal.alpha.feed.play`)
```json
{
  "trackName": "string (required)",
  "trackMbId": "string", "recordingMbId": "string",
  "duration": "integer", "artists": [{"name": "string", "mbid": "string"}],
  "releaseName": "string", "releaseMbId": "string",
  "isrc": "string", "originUrl": "string",
  "musicServiceBaseDomain": "string", "submissionClientAgent": "string",
  "playedTime": "datetime"
}
```

### Profile Schema (`fm.teal.alpha.actor.profile`)
```json
{
  "displayName": "string", "description": "string",
  "featuredItem": {"mbid": "string", "type": "album|track|artist"},
  "avatar": "blob", "banner": "blob", "createdAt": "datetime"
}
```

## Core Features
- **Music Tracking**: primarily MusicBrainz metadata, multi-platform support, scrobbling logic
- **Social**: Federated profiles, activity feeds, featured items, rich text
- **Real-time**: WebSocket streams, CAR processing, background jobs
- **Analytics**: Play counts, charts, materialized views

## Development Setup
```bash
# Install & setup
pnpm install
cp apps/aqua/.env.example apps/aqua/.env
./scripts/setup-sqlx.sh

# Start dependencies
docker compose -f compose.dev.yml up -d garnet postgres

# Run dev server
turbo dev --filter=@teal/aqua
# Access: http://localhost:3000
```

## Database Operations
```bash
pnpm db:create          # Create DB
pnpm db:migrate         # Run migrations
pnpm db:migrate:revert  # Revert migration
pnpm db:reset          # Reset DB
pnpm db:prepare        # Prepare queries
```

## Lexicon Management
```bash
pnpm lex:gen       # Generate types
pnpm lex:watch     # Watch & regenerate
pnpm lex:validate  # Validate schemas
pnpm lex:diff      # Show changes
```

## Rust Development Guidelines
- **Error Handling**: Always use `anyhow::Result<T>` for fallible functions, never `Result<T, String>`
- **Async Patterns**: Use `async/await` throughout, avoid `tokio::spawn` unless necessary for parallelism
- **Database**: SQLx queries MUST be compile-time verified with `cargo sqlx prepare`
- **Types**: Use workspace types from `types` crate, avoid duplicating structs across services
- **Imports**: Group std → external → workspace → local, use `use` not `extern crate`
- **Lifetimes**: Avoid explicit lifetimes unless required, let compiler infer
- **Memory**: Use `Arc<T>` for shared ownership, `Rc<T>` only in single-threaded contexts
- **Serialization**: Use `#[derive(Serialize, Deserialize)]` with serde, not manual impls
- **Logging**: Use `tracing::info!`, `tracing::error!` etc, not `println!` or `log` crate
- **Testing**: Place unit tests in `#[cfg(test)]` modules, integration tests in `tests/` directory

## Git Workflow Guidelines
- **Codex: You MUST work in a branch, you can NOT push to main and thus you need to make a PR per-feature**
- **Branch naming**: `feature/short-description`, `fix/issue-description`, `refactor/component-name`
- **Commit format**: `type(scope): description` - e.g. `feat(cadet): add jetstream reconnection`, `fix(aqua): handle empty play submissions`
- **Commit types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`
- **Branch lifecycle**: Create from `main`, keep updated with `git rebase main`, squash before merge
- **PR requirements**: All tests pass, no clippy warnings, SQLx queries prepared, lexicons validated
- **Commit size**: Small, focused commits - one logical change per commit
- **Message body**: Include WHY for non-obvious changes, reference issues with `#123`
- **Breaking changes**: Mark with `BREAKING:` in commit body, update migration docs
- **Checkpointing**: Create focused checkpoint commits after each meaningful, verified unit of work
- **Push after commit**: After each checkpoint commit, push the current feature branch to its remote unless explicitly told not to
- **Status hygiene**: Before committing, inspect `git status --short` and leave unrelated user files unstaged
- **Handoff**: Report the commit hash after each checkpoint commit

## Working Handoff
- Read `todo.md` before starting implementation work.
- Update `todo.md` whenever implementation state, blockers, public preview URLs, or next steps change.
- Keep future work concrete: name the service, route, test, or deployment action that remains.
- Do not commit secrets, tunnel tokens, OAuth codes, or private credentials.

## Code Standards
- **TypeScript**: Biome format (`pnpm fix`), explicit types
- **DB**: Snake_case, migrations, indexes, constraints
- **AT Protocol**: URI format, lexicon validation, federation-ready

## Testing
```bash
pnpm test           # All tests
pnpm test:rust      # Rust only
cargo test          # Service tests
cargo tarpaulin     # Coverage
```

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

## Deployment
```bash
# Environment vars: DATABASE_URL, REDIS_URL, AT_PROTOCOL_JWT_SECRET
docker compose build
docker compose up -d
docker compose exec aqua-api pnpm db:migrate
```

## Architecture
- **Microservices**: Rust services with shared types
- **Federation**: AT Protocol for decentralized social music
- **Scrobble When**: <2min = full play, ≥2min = half duration (max 4min)
- **Data Flow**: WebSocket → Cadet → PostgreSQL → Aqua API
- **Caching**: Redis for sessions, jobs, API responses
- **Monitoring**: Prometheus metrics, structured logging

## Key Patterns
- **Lexicon-first**: Schema definitions drive code generation
- **Event-driven**: Real-time processing via jetstream
- **Content-addressable**: CAR files for federated data
- **Type-safe**: SQLx compile-time query verification
- **Async-first**: Tokio runtime throughout

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
- After completing a new feature or overhaul, publish the updated build to the stable public preview at `https://sigilyph.teal.fm` through the Cloudflare tunnel.
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

## Rust Anti-Patterns to Avoid
- **DON'T**: Use `unwrap()` or `expect()` in production code - use proper error handling
- **DON'T**: Clone unnecessarily - prefer borrowing with `&` or using `Arc<T>`
- **DON'T**: Use `String` when `&str` suffices - avoid unnecessary allocations
- **DON'T**: Mix blocking and async code - use `tokio::task::spawn_blocking` for CPU work
- **DON'T**: Ignore compiler warnings - *fix all clippy lints before committing*
- **DON'T**: Write raw SQL strings - use SQLx query macros or builder patterns
- **DON'T**: Use global state - pass dependencies through function parameters or structs
- **DON'T**: Implement `Debug` manually - use `#[derive(Debug)]` unless custom formatting needed
