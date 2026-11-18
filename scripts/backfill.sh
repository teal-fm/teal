#!/usr/bin/env bash
# Backfill every Teal record into the local database with tab
# (https://tangled.org/pds.dad/tab). Lightrail lists the repos that hold Teal
# records, tab fetches each repo from its PDS, and Cadet's tab-backfill
# consumer stores the records. Both keep running afterwards to follow live
# events; stop with Ctrl-C and rerun to resume.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAB_DIR="${TEAL_TAB_DIR:-$ROOT_DIR/.teal-tab}"
TAB_HOST="${TAB_HOST:-127.0.0.1}"
TAB_PORT="${TAB_PORT:-2480}"
TAB_BASE_URL="http://$TAB_HOST:$TAB_PORT"
TAB_LOG="${TAB_LOG:-$TAB_DIR/tab.log}"

export TAB_BIND="$TAB_HOST:$TAB_PORT"
export TAB_CHANNEL_URL="${TAB_CHANNEL_URL:-ws://$TAB_HOST:$TAB_PORT/channel}"
export TAB_DATABASE_URL="${TAB_DATABASE_URL:-sqlite://$TAB_DIR/tab.db}"
# Any of these collections marks a repo worth backfilling; every fm.teal.*
# record from those repos is delivered, including both play namespaces.
export TAB_LIGHT_RAIL_URL="${TAB_LIGHT_RAIL_URL:-https://lightrail.microcosm.blue}"
export TAB_LIGHT_RAIL_SIGNAL_COLLECTIONS="${TAB_LIGHT_RAIL_SIGNAL_COLLECTIONS:-fm.teal.feed.play,fm.teal.alpha.feed.play,fm.teal.actor.profile,fm.teal.alpha.actor.profile,fm.teal.actor.status,fm.teal.alpha.actor.status}"
export TAB_COLLECTION_FILTERS="${TAB_COLLECTION_FILTERS:-fm.teal.*}"
# Follow live events through Jetstream rather than the full relay firehose.
export TAB_JETSTREAM_URL="${TAB_JETSTREAM_URL:-wss://jetstream1.us-east.bsky.network}"
export DATABASE_URL="${DATABASE_URL:-postgres://teal:teal@127.0.0.1:5432/teal}"

mkdir -p "$TAB_DIR"

if [[ "${TEAL_TAB_RESET:-0}" == "1" ]]; then
  echo "Resetting tab state in $TAB_DIR"
  rm -f "$TAB_DIR"/tab.db "$TAB_DIR"/tab.db-* "$TAB_LOG"
fi

if ! command -v tab >/dev/null 2>&1; then
  if ! command -v go >/dev/null 2>&1; then
    echo "tab is not installed and Go is unavailable. Install Go, then rerun pnpm backfill." >&2
    exit 1
  fi
  echo "Installing tab with go install tangled.org/pds.dad/tab/cmd/tab@latest"
  go install tangled.org/pds.dad/tab/cmd/tab@latest
  export PATH="$(go env GOPATH)/bin:$PATH"
fi

tab_is_healthy() {
  curl --fail --silent "$TAB_BASE_URL/health" >/dev/null 2>&1
}

if tab_is_healthy; then
  echo "Using the tab already running at $TAB_BASE_URL"
else
  echo "Starting tab at $TAB_BASE_URL (logs: $TAB_LOG)"
  echo "Signal collections: $TAB_LIGHT_RAIL_SIGNAL_COLLECTIONS"
  tab run >"$TAB_LOG" 2>&1 &
  TAB_PID=$!
  trap 'kill "$TAB_PID" 2>/dev/null || true' EXIT

  for _ in {1..60}; do
    tab_is_healthy && break
    if ! kill -0 "$TAB_PID" 2>/dev/null; then
      echo "tab exited before becoming healthy. Last logs:" >&2
      tail -80 "$TAB_LOG" >&2 || true
      exit 1
    fi
    sleep 1
  done

  if ! tab_is_healthy; then
    echo "tab did not become healthy at $TAB_BASE_URL. Last logs:" >&2
    tail -80 "$TAB_LOG" >&2 || true
    exit 1
  fi
fi

echo "Starting Cadet's tab-backfill consumer against $TAB_CHANNEL_URL"
SQLX_OFFLINE=true cargo run --release -p cadet --bin tab-backfill
