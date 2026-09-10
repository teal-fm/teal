#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT_DIR/compose.dev.yml" --profile named-tunnel)

load_local_env() {
  local env_file="$ROOT_DIR/.env"
  [[ -f "$env_file" ]] || return 0

  local line key value
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    key="${line%%=*}"
    key="${key//[[:space:]]/}"
    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    case "$key" in
      TUNNEL_HOST|CLIENT_ADDRESS|EXPO_PUBLIC_BASE_URL|EXPO_PUBLIC_AQUA_URL|EXPO_PUBLIC_DID_WEB|CLOUDFLARED_TUNNEL_TOKEN)
        if [[ -z "${!key:-}" ]]; then
          export "$key=$value"
        fi
        ;;
    esac
  done < "$env_file"
}

load_local_env

TUNNEL_HOST="${TUNNEL_HOST:-sigilyph.teal.fm}"
PUBLIC_ORIGIN="https://${TUNNEL_HOST}"

usage() {
  cat <<USAGE
Usage: pnpm tunnel:<command>

Commands:
  tunnel:up       Build and start the stable Cloudflare tunnel preview
  tunnel:down     Stop the stable tunnel preview containers
  tunnel:status   Show compose service status
  tunnel:logs     Follow tunnel/app logs
  tunnel:verify   Verify public metadata and latest-play XRPC

Required local env:
  CLOUDFLARED_TUNNEL_TOKEN must be set in your shell or ignored .env file.

Defaults:
  TUNNEL_HOST=${TUNNEL_HOST}
USAGE
}

require_token() {
  if [[ -z "${CLOUDFLARED_TUNNEL_TOKEN:-}" ]]; then
    echo "CLOUDFLARED_TUNNEL_TOKEN is missing. Add it to .env or export it locally." >&2
    exit 1
  fi
}

export_preview_env() {
  export CLIENT_ADDRESS="${CLIENT_ADDRESS:-:80}"
  export EXPO_PUBLIC_BASE_URL="${EXPO_PUBLIC_BASE_URL:-$PUBLIC_ORIGIN}"
  export EXPO_PUBLIC_AQUA_URL="${EXPO_PUBLIC_AQUA_URL:-$PUBLIC_ORIGIN}"
  export EXPO_PUBLIC_DID_WEB="${EXPO_PUBLIC_DID_WEB:-did:web:${TUNNEL_HOST}}"
  export EXPO_PUBLIC_GIT_BRANCH="$(git symbolic-ref --short -q HEAD || echo detached)"
  export EXPO_PUBLIC_GIT_COMMIT="$(git rev-parse HEAD)"
}

curl_preview() {
  local url="$1"

  if curl --fail --show-error --silent "$url" >/dev/null; then
    return 0
  fi

  local ip
  ip="$(dig +short "$TUNNEL_HOST" @1.1.1.1 | grep -E '^[0-9.]+$' | head -n 1 || true)"
  if [[ -z "$ip" ]]; then
    echo "Could not resolve $TUNNEL_HOST with the local resolver or Cloudflare DNS." >&2
    return 1
  fi

  echo "Local DNS has not caught up for $TUNNEL_HOST; retrying verification through $ip." >&2
  curl --fail --show-error --silent --resolve "$TUNNEL_HOST:443:$ip" "$url" >/dev/null
}

fetch_preview() {
  local url="$1"

  if curl --fail --show-error --silent "$url"; then
    return 0
  fi

  local ip
  ip="$(dig +short "$TUNNEL_HOST" @1.1.1.1 | grep -E '^[0-9.]+$' | head -n 1 || true)"
  if [[ -z "$ip" ]]; then
    echo "Could not resolve $TUNNEL_HOST with the local resolver or Cloudflare DNS." >&2
    return 1
  fi

  echo "Local DNS has not caught up for $TUNNEL_HOST; retrying verification through $ip." >&2
  curl --fail --show-error --silent --resolve "$TUNNEL_HOST:443:$ip" "$url"
}

verify_preview() {
  echo "Verifying client metadata..."
  fetch_preview "$PUBLIC_ORIGIN/client-metadata.json" | python3 -c '
import json
import sys

origin = sys.argv[1]
metadata = json.load(sys.stdin)
expected_client_id = f"{origin}/client-metadata.json"
expected_redirect_uri = f"{origin}/auth/callback"
actual_client_id = metadata.get("client_id")
actual_client_uri = metadata.get("client_uri")

if actual_client_id != expected_client_id:
    raise SystemExit(f"client_id mismatch: expected {expected_client_id!r}, got {actual_client_id!r}")
if expected_redirect_uri not in metadata.get("redirect_uris", []):
    raise SystemExit(f"redirect_uris missing {expected_redirect_uri!r}")
if actual_client_uri != origin:
    raise SystemExit(f"client_uri mismatch: expected {origin!r}, got {actual_client_uri!r}")
if metadata.get("token_endpoint_auth_method") != "none":
    raise SystemExit("token_endpoint_auth_method must be none")
if metadata.get("dpop_bound_access_tokens") is not True:
    raise SystemExit("dpop_bound_access_tokens must be true")
' "$PUBLIC_ORIGIN"
  echo "Verifying latest plays..."
  fetch_preview "$PUBLIC_ORIGIN/xrpc/fm.teal.stats.getLatest?limit=1" | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
plays = payload.get("plays")
if not isinstance(plays, list):
    raise SystemExit("latest plays response must contain a plays array")
'
}

case "${1:-}" in
  up)
    require_token
    export_preview_env
    "${COMPOSE[@]}" up -d --build postgres garnet aqua-api cadet amethyst cloudflared-named
    echo "Stable preview: $PUBLIC_ORIGIN"
    verify_preview
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  status)
    "${COMPOSE[@]}" ps
    ;;
  logs)
    "${COMPOSE[@]}" logs -f amethyst aqua-api cadet cloudflared-named
    ;;
  verify)
    verify_preview
    ;;
  *)
    usage
    exit 1
    ;;
esac
