#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
lexicons_root="$repo_root/lexicons"
validation_dir="$(mktemp -d "${TMPDIR:-/tmp}/teal-lexicons.XXXXXX")"
trap 'rm -rf "$validation_dir"' EXIT

mkdir -p "$validation_dir/fm/teal" "$validation_dir/com/atproto/repo" "$validation_dir/app/bsky/richtext"
cp -R "$lexicons_root/fm.teal" "$validation_dir/fm/teal"
cp "$repo_root/vendor/atproto/lexicons/com/atproto/repo/strongRef.json" \
  "$validation_dir/com/atproto/repo/strongRef.json"
cp "$repo_root/vendor/atproto/lexicons/app/bsky/richtext/facet.json" \
  "$validation_dir/app/bsky/richtext/facet.json"

pnpm --dir "$repo_root/packages/lexicons" exec ts-lex build \
  --lexicons "$validation_dir" \
  --out "$validation_dir/generated" \
  --clear \
  --import-ext "" \
  --default-export=false \
  --lib @atproto/lexicon
