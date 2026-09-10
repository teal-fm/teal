#!/bin/bash
set -e

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
lexicons_root="$repo_root/lexicons"
echo "Validating lexicons with @atproto/lex"
bash "$repo_root/packages/lexicons/lex-validate.sh"

# The current HTTP server consumes the legacy gen-server shape. Keep this
# compatibility output until Aqua's XRPC bindings migrate to @atproto/lex.
cd "$repo_root/packages/lexicons"
json_files=$(find "$lexicons_root/fm.teal.alpha" -name "*.json" -type f | sort)
json_files="$json_files $lexicons_root/app/bsky/richtext/facet.json"
lexicon_paths=""
for file in $json_files; do
  lexicon_paths="$lexicon_paths $file"
done

echo "Generating compatibility server bindings"
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
