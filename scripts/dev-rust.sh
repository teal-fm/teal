#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
service=${1:?Expected aqua, cadet, or satellite}
case "$service" in
  aqua) directory=apps/aqua ;;
  cadet|satellite) directory=services/$service ;;
  *) echo "Unknown Rust service: $service" >&2; exit 1 ;;
esac
watch=(-w "$directory/src" -w "$directory/Cargo.toml" -w Cargo.toml -w Cargo.lock -w .sqlx -w migrations)
[[ ! -f "$directory/build.rs" ]] || watch+=(-w "$directory/build.rs")
[[ $service == satellite ]] || watch+=(-w services/types)
# Explicit paths prevent UI edits restarting ingestion. Include generated types.
exec cargo watch --no-vcs-ignores "${watch[@]}" -x "run -p $service --bin $service"
