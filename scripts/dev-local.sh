#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v cargo-watch >/dev/null 2>&1 && ! cargo watch --version >/dev/null 2>&1; then
  echo "cargo-watch is required. Install it with: cargo install cargo-watch --locked" >&2
  exit 1
fi

export DEV_PUBLIC_ORIGIN=${DEV_PUBLIC_ORIGIN:-https://sigilyph.teal.fm}
node -e 'const u = new URL(process.env.DEV_PUBLIC_ORIGIN); if (u.origin !== process.env.DEV_PUBLIC_ORIGIN || u.protocol !== "https:") throw new Error("DEV_PUBLIC_ORIGIN must be an HTTPS origin with no path or trailing slash")'
DEV_DATABASE_URL=${DEV_DATABASE_URL:-postgres://teal:teal@127.0.0.1:5432/teal}
DEV_REDIS_URL=${DEV_REDIS_URL:-redis://127.0.0.1:6379}
mkdir -p .codex-run
DEV_CADET_CURSOR_FILE=${DEV_CADET_CURSOR_FILE:-$ROOT_DIR/.codex-run/cadet-cursor.txt}
COMPOSE=(docker compose -f compose.dev.yml -f compose.watch.yml --profile named-tunnel)
# Reuse the already-installed Caddy runtime when available. Its bundled static
# files are unused by Caddyfile.dev; no application image build is needed.
if [[ -z ${DEV_PROXY_IMAGE:-} ]] && ! docker image inspect caddy:2.8-alpine >/dev/null 2>&1 && docker image inspect teal-amethyst >/dev/null 2>&1; then
  export DEV_PROXY_IMAGE=teal-amethyst
fi

# Reject a second runner before changing the running stack.
for port in 3000 3001 8082; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is occupied. Stop the existing app process before pnpm dev." >&2
    exit 1
  fi
done

"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" config --format json | node -e 'let s=""; process.stdin.on("data", x => s += x); process.stdin.on("end", () => { const c=JSON.parse(s).services["cloudflared-named"].command; if (!c[c.indexOf("--token")+1]) { console.error("Set CLOUDFLARED_TUNNEL_TOKEN in the ignored .env file before pnpm dev."); process.exit(1); } });'
docker compose -f compose.dev.yml stop aqua-api cadet satellite >/dev/null
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

"${COMPOSE[@]}" up -d --no-build --no-deps amethyst cloudflared-named
echo "Development preview: $DEV_PUBLIC_ORIGIN"
# exec keeps SIGINT/SIGTERM attached to Turbo, which owns all watch processes.
exec pnpm dev:apps
