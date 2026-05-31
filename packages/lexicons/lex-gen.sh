#!/bin/bash
set -e

# Navigate to the lexicons directory and find all .json files
cd ../../lexicons
json_files=$(find . -name "*.json" -type f | sort)

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
node ../../node_modules/@atproto/lex-cli/dist/index.js gen-server ./src $lexicon_paths --yes

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
