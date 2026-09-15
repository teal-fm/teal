#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: pnpm dev [--proxy]

Run the full Teal stack. Postgres, Garnet, and Caddy run in Docker; Expo, Aqua,
Cadet, and Satellite run on the host under their watchers. The app is served at
DEV_PUBLIC_ORIGIN (default http://localhost:8081) with /xrpc/* and OAuth
metadata on the same origin. Nothing is exposed publicly by default.

Options:
  --proxy   Also start the named Cloudflare tunnel and serve the stack at the
            public DEV_PUBLIC_ORIGIN (default https://sigilyph.teal.fm). The
            ignored root .env must define CLOUDFLARED_TUNNEL_TOKEN.
  -h, --help
USAGE
}

PROXY=0
for arg in "$@"; do
  case "$arg" in
    --proxy) PROXY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

if ! command -v cargo-watch >/dev/null 2>&1 && ! cargo watch --version >/dev/null 2>&1; then
  echo "cargo-watch is required. Install it with: cargo install cargo-watch --locked" >&2
  exit 1
fi

if [[ $PROXY == 1 ]]; then
  export DEV_PUBLIC_ORIGIN=${DEV_PUBLIC_ORIGIN:-https://sigilyph.teal.fm}
  node -e 'const u = new URL(process.env.DEV_PUBLIC_ORIGIN); if (u.origin !== process.env.DEV_PUBLIC_ORIGIN || u.protocol !== "https:") throw new Error("DEV_PUBLIC_ORIGIN must be an HTTPS origin with no path or trailing slash")'
else
  export DEV_PUBLIC_ORIGIN=${DEV_PUBLIC_ORIGIN:-http://localhost:8081}
  node -e 'const u = new URL(process.env.DEV_PUBLIC_ORIGIN); if (u.origin !== process.env.DEV_PUBLIC_ORIGIN || !["http:","https:"].includes(u.protocol)) throw new Error("DEV_PUBLIC_ORIGIN must be an HTTP(S) origin with no path or trailing slash")'
fi

DEV_DATABASE_URL=${DEV_DATABASE_URL:-postgres://teal:teal@127.0.0.1:5432/teal}
DEV_REDIS_URL=${DEV_REDIS_URL:-redis://127.0.0.1:6379}
mkdir -p .codex-run
DEV_CADET_CURSOR_FILE=${DEV_CADET_CURSOR_FILE:-$ROOT_DIR/.codex-run/cadet-cursor.txt}

COMPOSE=(docker compose -f compose.dev.yml -f compose.watch.yml)
if [[ $PROXY == 1 ]]; then
  COMPOSE+=(--profile named-tunnel)
fi

# Reuse the already-installed Caddy runtime when available. Its bundled static
# files are unused by Caddyfile.dev; no application image build is needed.
if [[ -z ${DEV_PROXY_IMAGE:-} ]] && ! docker image inspect caddy:2.8-alpine >/dev/null 2>&1 && docker image inspect teal-amethyst >/dev/null 2>&1; then
  export DEV_PROXY_IMAGE=teal-amethyst
fi

# Reject a second runner before changing the running stack. Port 8081 is owned
# by the reused Caddy container, so it is intentionally not checked here.
for port in 3000 3001 8082; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is occupied. Stop the existing app process before pnpm dev." >&2
    exit 1
  fi
done

"${COMPOSE[@]}" config --quiet

if [[ $PROXY == 1 ]]; then
  "${COMPOSE[@]}" config --format json | node -e 'let s=""; process.stdin.on("data", x => s += x); process.stdin.on("end", () => { const c=JSON.parse(s).services["cloudflared-named"].command; if (!c[c.indexOf("--token")+1]) { console.error("Set CLOUDFLARED_TUNNEL_TOKEN in the ignored .env file before pnpm dev --proxy."); process.exit(1); } });'
fi

# Stop containerized app services the host watchers replace, plus any tunnel
# left running from an earlier proxy session so local mode stays private.
docker compose -f compose.dev.yml stop aqua-api cadet satellite >/dev/null
docker compose -f compose.dev.yml --profile named-tunnel stop cloudflared-named >/dev/null 2>&1 || true

"${COMPOSE[@]}" up -d postgres garnet
for attempt in {1..30}; do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U teal -d teal >/dev/null; then
    break
  fi
  if [[ $attempt == 30 ]]; then echo "Postgres did not become ready." >&2; exit 1; fi
  sleep 1
done

DATABASE_URL="$DEV_DATABASE_URL" pnpm db:migrate

export DATABASE_URL=$DEV_DATABASE_URL
export REDIS_URL=$DEV_REDIS_URL
export CURSOR_FILE=$DEV_CADET_CURSOR_FILE
export SQLX_OFFLINE=${SQLX_OFFLINE:-true}
# Keep incremental builds without multi-gigabyte debug symbols by default.
export CARGO_PROFILE_DEV_DEBUG=${CARGO_PROFILE_DEV_DEBUG:-0}
export EXPO_PUBLIC_BASE_URL=$DEV_PUBLIC_ORIGIN
export EXPO_PUBLIC_AQUA_URL=$DEV_PUBLIC_ORIGIN
export EXPO_PACKAGER_PROXY_URL=$DEV_PUBLIC_ORIGIN
export CADET_STREAM_MODE=jetstream
export CADET_DEFER_MATERIALIZED_VIEW_REFRESH=1
export CADET_MATERIALIZED_VIEW_REFRESH_INTERVAL_SECS=60
export EXPO_PUBLIC_GIT_BRANCH=${EXPO_PUBLIC_GIT_BRANCH:-$(git branch --show-current)}
export EXPO_PUBLIC_GIT_COMMIT=${EXPO_PUBLIC_GIT_COMMIT:-$(git rev-parse --short HEAD)}

"${COMPOSE[@]}" up -d --no-build --no-deps amethyst
if [[ $PROXY == 1 ]]; then
  "${COMPOSE[@]}" up -d --no-build --no-deps cloudflared-named
  echo "Public development preview: $DEV_PUBLIC_ORIGIN"
else
  echo "Local development preview: $DEV_PUBLIC_ORIGIN"
fi
# exec keeps SIGINT/SIGTERM attached to Turbo, which owns all watch processes.
exec pnpm dev:apps
