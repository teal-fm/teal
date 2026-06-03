#!/bin/bash

# Script to verify .sqlx files exist for offline SQLx builds (SQLX_OFFLINE=true)
# With unified workspace, .sqlx only needs to exist at the project root

set -e

# Get the script directory (should be in teal/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source .sqlx directory
SQLX_SOURCE="$PROJECT_ROOT/.sqlx"

echo "🔧 Verifying SQLx offline files..."

# Check if source .sqlx directory exists
if [ ! -d "$SQLX_SOURCE" ]; then
    echo "❌ .sqlx directory not found at: $SQLX_SOURCE"
    echo "   Make sure you've run 'cargo sqlx prepare' from the project root first."
    exit 1
fi

query_count=$(ls -1 "$SQLX_SOURCE" | wc -l | tr -d ' ')
echo "✅ Found .sqlx directory with $query_count query files"
echo "✅ SQLx offline mode ready!"
echo ""
echo "Note: If you add new SQL queries or modify existing ones, run 'cargo sqlx prepare' from the project root"
