#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v cargo-watch >/dev/null 2>&1 && ! cargo watch --version >/dev/null 2>&1; then
  echo "cargo-watch is required. Install it with: cargo install cargo-watch --locked" >&2
  exit 1
fi

DEV_PUBLIC_ORIGIN=${DEV_PUBLIC_ORIGIN:-https://tashi.rainbow-alkaid.ts.net:8445}
DEV_DATABASE_URL=${DEV_DATABASE_URL:-postgres://teal:teal@127.0.0.1:5432/teal}
DEV_REDIS_URL=${DEV_REDIS_URL:-redis://127.0.0.1:6379}
DEV_CADET_CURSOR_FILE=${DEV_CADET_CURSOR_FILE:-/tmp/teal-cadet-cursor.txt}

docker compose -f compose.dev.yml stop amethyst aqua-api cadet satellite >/dev/null
docker compose -f compose.dev.yml up -d postgres garnet

DATABASE_URL="$DEV_DATABASE_URL" pnpm db:migrate

DEV_PUBLIC_ORIGIN="$DEV_PUBLIC_ORIGIN" node scripts/dev-proxy.mjs &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null || true' EXIT INT TERM

export DATABASE_URL=$DEV_DATABASE_URL
export REDIS_URL=$DEV_REDIS_URL
export CURSOR_FILE=$DEV_CADET_CURSOR_FILE
export SQLX_OFFLINE=${SQLX_OFFLINE:-true}
export EXPO_PUBLIC_BASE_URL=${EXPO_PUBLIC_BASE_URL:-$DEV_PUBLIC_ORIGIN}
export EXPO_PUBLIC_AQUA_URL=${EXPO_PUBLIC_AQUA_URL:-$DEV_PUBLIC_ORIGIN}
export EXPO_PUBLIC_GIT_BRANCH=${EXPO_PUBLIC_GIT_BRANCH:-$(git branch --show-current)}
export EXPO_PUBLIC_GIT_COMMIT=${EXPO_PUBLIC_GIT_COMMIT:-$(git rev-parse --short HEAD)}

pnpm dev:apps
