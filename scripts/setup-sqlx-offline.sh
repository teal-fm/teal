#!/bin/bash

# Script to copy .sqlx files to all Rust projects that use SQLx
# This is needed for offline SQLx builds (SQLX_OFFLINE=true)

set -e

# Get the script directory (should be in teal/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source .sqlx directory
SQLX_SOURCE="$PROJECT_ROOT/.sqlx"

# List of projects that use SQLx (relative to project root)
SQLX_PROJECTS=(
    "apps/aqua"
    "services/cadet"
    "services/satellite"
)

echo "🔧 Setting up SQLx offline files..."

# Check if source .sqlx directory exists
if [ ! -d "$SQLX_SOURCE" ]; then
    echo "❌ Source .sqlx directory not found at: $SQLX_SOURCE"
    echo "   Make sure you've run 'cargo sqlx prepare' from the services directory first."
    exit 1
fi

# Copy .sqlx files to each project that needs them
for project in "${SQLX_PROJECTS[@]}"; do
    project_path="$PROJECT_ROOT/$project"
    target_sqlx="$project_path/.sqlx"

    if [ ! -d "$project_path" ]; then
        echo "⚠️  Project directory not found: $project_path (skipping)"
        continue
    fi

    # Check if project actually uses SQLx
    if [ ! -f "$project_path/Cargo.toml" ]; then
        echo "⚠️  No Cargo.toml found in $project (skipping)"
        continue
    fi

    if ! grep -q "sqlx" "$project_path/Cargo.toml"; then
        echo "⚠️  Project $project doesn't appear to use SQLx (skipping)"
        continue
    fi

    echo "📦 Copying .sqlx files to $project..."

    # Remove existing .sqlx directory if it exists
    if [ -d "$target_sqlx" ]; then
        rm -rf "$target_sqlx"
    fi

    # Copy the .sqlx directory
    cp -r "$SQLX_SOURCE" "$target_sqlx"

    echo "   ✅ Copied $(ls -1 "$target_sqlx" | wc -l) query files"
done

echo "✅ SQLx offline setup complete!"
echo ""
echo "Note: If you add new SQL queries or modify existing ones, you'll need to:"
echo "1. Run 'cargo sqlx prepare' from the services directory"
echo "2. Run this script again to update all project copies"
