#!/bin/bash
set -e

# Navigate to the lexicons directory and find all .json files
cd ../../lexicons
json_files=$(find . -name "*.json" -type f)

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
lex gen-server ./src $lexicon_paths --yes
