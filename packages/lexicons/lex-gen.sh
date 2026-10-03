#!/bin/bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
lexicons_root="$repo_root/lexicons"
source_dir="$(mktemp -d "${TMPDIR:-/tmp}/teal-lexicons.XXXXXX")"
trap 'rm -rf "$source_dir"' EXIT

mkdir -p "$source_dir/fm/teal" "$source_dir/com/atproto/repo" "$source_dir/app/bsky/richtext"
cp -R "$lexicons_root/fm.teal" "$source_dir/fm/teal"
cp "$repo_root/vendor/atproto/lexicons/com/atproto/repo/strongRef.json" \
  "$source_dir/com/atproto/repo/strongRef.json"
cp "$repo_root/vendor/atproto/lexicons/app/bsky/richtext/facet.json" \
  "$source_dir/app/bsky/richtext/facet.json"

pnpm --dir "$repo_root/packages/lexicons" exec ts-lex build \
  --lexicons "$source_dir" \
  --out "$repo_root/packages/lexicons/src" \
  --clear \
  --import-ext "" \
  --index-file \
  --default-export=false

node "$repo_root/packages/lexicons/generate-documents.mjs" "$source_dir"
