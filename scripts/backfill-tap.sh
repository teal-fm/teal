#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAP_DIR="${TEAL_TAP_DIR:-$ROOT_DIR/.teal-tap}"
TAP_HOST="${TAP_HOST:-127.0.0.1}"
TAP_PORT="${TAP_PORT:-2480}"
TAP_BASE_URL="${TAP_BASE_URL:-http://$TAP_HOST:$TAP_PORT}"
TAP_CHANNEL_URL="${TAP_CHANNEL_URL:-ws://$TAP_HOST:$TAP_PORT/channel}"
TAP_LOG="${TAP_LOG:-$TAP_DIR/tap.log}"

# Full-network mode discovers every findable repo, then record delivery is
# filtered separately so only fm.teal.* records flow through Cadet.
export TAP_FULL_NETWORK="${TAP_FULL_NETWORK:-true}"
export TAP_SIGNAL_COLLECTION="${TAP_SIGNAL_COLLECTION:-}"
export TAP_COLLECTION_FILTERS="${TAP_COLLECTION_FILTERS:-fm.teal.*}"
export TAP_DISABLE_ACKS="${TAP_DISABLE_ACKS:-true}"
export TAP_CHANNEL_URL

if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgres://teal:teal@127.0.0.1:5432/teal"
fi

mkdir -p "$TAP_DIR"

if [[ "${TEAL_TAP_RESET:-0}" == "1" ]]; then
  echo "Resetting TAP state in $TAP_DIR"
  rm -f "$TAP_DIR"/tap.db "$TAP_DIR"/tap.db-* "$TAP_LOG"
fi

if ! command -v tap >/dev/null 2>&1; then
  if ! command -v go >/dev/null 2>&1; then
    echo "tap is not installed and Go is unavailable. Install Go, then rerun pnpm backfill." >&2
    exit 1
  fi
  echo "Installing tap with go install github.com/bluesky-social/indigo/cmd/tap@latest"
  go install github.com/bluesky-social/indigo/cmd/tap@latest
  export PATH="$(go env GOPATH)/bin:$PATH"
fi

tap_is_healthy() {
  curl --fail --silent --show-error "$TAP_BASE_URL/health" >/dev/null 2>&1
}

if tap_is_healthy; then
  echo "Using existing TAP at $TAP_BASE_URL"
else
  echo "Starting TAP at $TAP_BASE_URL"
  echo "TAP_FULL_NETWORK=$TAP_FULL_NETWORK"
  echo "TAP_SIGNAL_COLLECTION=$TAP_SIGNAL_COLLECTION"
  echo "TAP_COLLECTION_FILTERS=$TAP_COLLECTION_FILTERS"
  (
    cd "$TAP_DIR"
    tap run \
      --bind "$TAP_HOST:$TAP_PORT" \
      --disable-acks="$TAP_DISABLE_ACKS"
  ) >"$TAP_LOG" 2>&1 &
  TAP_PID=$!
  echo "TAP pid $TAP_PID, logs: $TAP_LOG"

  for _ in {1..60}; do
    if tap_is_healthy; then
      break
    fi
    if ! kill -0 "$TAP_PID" >/dev/null 2>&1; then
      echo "TAP exited before becoming healthy. Last logs:" >&2
      tail -80 "$TAP_LOG" >&2 || true
      exit 1
    fi
    sleep 1
  done

  if ! tap_is_healthy; then
    echo "TAP did not become healthy at $TAP_BASE_URL. Last logs:" >&2
    tail -80 "$TAP_LOG" >&2 || true
    exit 1
  fi
fi

echo "Starting Cadet TAP consumer against $TAP_CHANNEL_URL"
echo "This process keeps running after historical backfill so it can consume TAP live events."
SQLX_OFFLINE=true cargo run -p cadet --bin tap-backfill
