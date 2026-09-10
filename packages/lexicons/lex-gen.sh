#!/bin/bash
set -e

# Navigate to the lexicons directory and find Teal schemas plus the upstream
# schemas referenced by Teal records. Avoid generating the full ATProto tree:
# newer upstream lexicons may use syntax unsupported by this repo's lex-cli.
cd ../../lexicons
json_files=$(find ./fm.teal.alpha -name "*.json" -type f | sort)
json_files="$json_files ./app/bsky/richtext/facet.json"

# Go back to the lexicons package directory
cd ../packages/lexicons

# Check if we found any lexicon files
if [ -z "$json_files" ]; then
    echo "No lexicon files found in ../../lexicons/"
    exit 1
fi

# Convert the file list to absolute paths
lexicon_paths=""
for file in $json_files; do
    lexicon_paths="$lexicon_paths ../../lexicons/$file"
done

# Generate lexicons
echo "Generating lexicons from: $lexicon_paths"
pnpm exec lex gen-server ./src $lexicon_paths --yes

# lex-cli emits Node ESM `.js` suffixes for generated TypeScript imports.
# Metro resolves source files by extension and cannot follow those paths before
# TypeScript is compiled, so keep internal generated imports extensionless.
find ./src -type f -name "*.ts" -exec perl -pi -e "s{(from ['\"](?:\./|\.\./)[^'\"]*)\.js(['\"])}{\$1\$2}g" {} +

perl -0pi -e 's/profileStatus\?: FmTealAlphaActorProfileStatus\.Main/profileStatus?: FmTealAlphaActorProfileStatus.Record/' \
  ./src/types/fm/teal/alpha/actor/defs.ts

mkdir -p ./src/types/app/bsky/richtext
cat > ./src/types/app/bsky/richtext/facet.ts <<'EOF'
import type { AppBskyRichtextFacet } from "@atproto/api";
import type { ValidationResult } from "@atproto/lexicon";

export type Main = AppBskyRichtextFacet.Main;
export type Mention = AppBskyRichtextFacet.Mention;
export type Link = AppBskyRichtextFacet.Link;
export type Tag = AppBskyRichtextFacet.Tag;
export type ByteSlice = AppBskyRichtextFacet.ByteSlice;

export function isMain(v: unknown): v is Main {
  return typeof v === "object" && v !== null;
}

export function validateMain(v: unknown): ValidationResult<Main> {
  return { success: true, value: v as Main };
}
EOF
