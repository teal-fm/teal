## Getting Started

### Prerequisites

#### Required
- **Node.js** (>= v21.0.0) - JavaScript runtime
- **Rust** (latest stable) - For Rust services compilation
- **pnpm** (package manager) - Workspace management
- **Docker** & **Docker Compose** - Local PostgreSQL and Garnet
- **cargo-watch** - Auto-rebuilding Rust services during development

#### Optional Development Tools
- **cargo-tarpaulin** - For checking code coverage in Rust

### Installation

1. **Install required dependencies**:
   ```bash
   # Install Rust (if not already installed)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

   # Install pnpm (if not already installed)
   npm install -g pnpm
   ```

2. **Set up the project**:
   ```bash
   # Install all dependencies (Node.js and Rust)
   pnpm install

   # clone submodules
   git submodule update --init --recursive

   # Set up environment configuration
   cp apps/aqua/.env.example apps/aqua/.env

   # Set up database with SQLx
   ./scripts/setup-sqlx.sh

   # Or manually:
   pnpm run db:create
   pnpm run db:migrate
   ```

3. **macOS-specific setup** (if needed):
   ```bash
   pnpm add @libsql/darwin-x64
   ```

4. **Optional: Install development tools**:
   ```bash
   # For Rust file watching during development
   cargo install cargo-watch --locked

   # optionally, set up docker + docker-compose
   # on Linux
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh

   # on macOS, you should use colima or orbstack
   brew install colima # or brew install orbstack
   colima start # or use the GUI for orbstack
   ```

### Database Management

This project uses **SQLx** for database management with PostgreSQL. Please note all database operations are handled through raw, albeit typechecked, SQL.

#### Database Commands

```bash
# Set up database and run all migrations
./scripts/setup-sqlx.sh

# Individual database operations
pnpm db:create          # Create database
pnpm db:migrate         # Run migrations
pnpm db:migrate:revert  # Revert last migration
pnpm db:reset           # Drop, recreate, and migrate database
pnpm db:prepare         # Prepare queries for compile-time verification
```

#### Migration Management

- **Location**: `services/migrations/`
- **Format**: `YYYYMMDDHHMMSS_description.sql` (timestamped SQL files)
- **Type**: Forward-only SQL migrations managed by SQLx

## Development

Start the full development stack with:

```bash
pnpm dev
```

Open https://sigilyph.teal.fm. Keep `pnpm dev` running in your terminal.
Docker runs PostgreSQL, Garnet, Caddy, and the existing named Cloudflare tunnel.
Expo runs locally on port 8082 with Fast Refresh; Aqua, Cadet, and Satellite run
under `cargo watch`. Caddy forwards `/xrpc/*` to Aqua on port 3000 and all other
app requests, including WebSockets, to Expo. No application images are built.

Set `CLOUDFLARED_TUNNEL_TOKEN` in the ignored root `.env` before starting.
The tunnel must route the public hostname to `http://amethyst:80`.
For another public tunnel, use its origin:

```bash
DEV_PUBLIC_ORIGIN=https://your-public-dev.example.com pnpm dev
```

The origin is applied to OAuth metadata, the browser API URL, and Expo's public
packager URL together. ATProto OAuth requires publicly reachable metadata, so
use the public hostname for sign-in. `http://localhost:8081` and the existing
Tailscale proxy are also useful for reachability checks.

`DEV_DATABASE_URL` and `DEV_REDIS_URL` override the default host connections.
Cadet stores its fallback cursor under ignored `.codex-run/` and defers aggregate
refreshes to its periodic worker. Rust watches only relevant service/shared files;
UI edits do not restart ingestion. Debug symbols are disabled to reduce disk use;
set `CARGO_PROFILE_DEV_DEBUG=2` when debugging Rust with a debugger.

Use `pnpm lex:gen` after schema changes, or `pnpm lex:watch` in another terminal.
The CLI's TypeScript compiler watcher is not a schema generator.

Ctrl+C stops the host processes. Docker infrastructure and the tunnel remain
available for the next run. `pnpm tunnel:verify` checks public metadata and XRPC.
The watch overlay needs Docker Compose 2.24.4 or newer. It uses the Caddy image,
or reuses the Caddy runtime in an already-installed `teal-amethyst` image.

### Production image preview

_Still a work in progress and may have some hiccups_

#### 1. Set up publicly accessible endpoints.

It is recommended if you are running aqua to make a publicly accessible endpoint for the app to post to. You can do that a couple of ways:

- Set up the traditional port forward on your router
- Use a tool like [ngrok](https://ngrok.com/) with the command `ngrok http 8080` or [Cloudflare tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/) (follow the 2a. portion of the guide when you get to that point).

If you do the cloudflare tunnels for amethyst as well,
you will also need
to follow [this](https://caddy.community/t/caddy-with-cloudflare-tunnel/18569) for routing to work properly.
Although you can just run it locally and it will work.

#### 2. Set up .envs

1. copy [.env.template](.env.template) and name it [.env](.env). The docker build will pull everything from this `.env`. There are notes in the [.env.template](.env.template) on what some of the values should be.
2. Follow the instructions in [piper](https://github.com/teal-fm/piper) to set up environment variables for the music scraper. But name it `.env.air`

#### 3. Run docker

1. Make sure docker and docker compose is installed
2. It is recommended to run 'docker compose -f compose.dev.yml pull' to pull the latest remote images before running the docker compose command.
3. Run `docker compose -f compose.dev.yml up -d`

And that's it! You should have the full teal.fm stack running locally. Now if you are working on aqua you can do `docker container stop aqua-app` and run that locally during development while everything else is running in docker.

### Lexicon Management

We use AT Protocol lexicons with dual TypeScript/Rust codegen (lex-cli + jacquard-lexicon). Use the unified lexicon CLI for managing schema changes:

```bash
# Generate all types from lexicons
pnpm lex:gen

# Watch lexicons and auto-regenerate
pnpm lex:watch

# Validate type consistency
pnpm lex:validate

# Show lexicon change impact
pnpm lex:diff
```

# Updating Vendored Lexicons
To update vendored lexicons (anything that's not under fm.teal), follow these steps:
```bash
cd vendor/atproto
git pull origin main
cd ../..
git add vendor/atproto
git commit -m "Update atproto lexicons to latest"
```

The TypeScript lexicon package runs `@atproto/lex` validation before generating the compatibility server bindings consumed by the current XRPC layer.
