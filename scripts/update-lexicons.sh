#!/bin/bash
# scripts/update-lexicons.sh
# Update script for ATProto lexicons from upstream

set -e

echo "Updating ATProto lexicons..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "vendor/atproto" ]; then
    echo "Error: This script must be run from the project root directory"
    echo "Make sure vendor/atproto submodule exists"
    exit 1
fi

# Save current directory
PROJECT_ROOT=$(pwd)

# Update the submodule
echo "Fetching latest changes from atproto repository..."
cd vendor/atproto

# Fetch latest changes
git fetch origin

# Get current commit
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_SHORT=$(git rev-parse --short HEAD)

# Get latest commit on main
LATEST_COMMIT=$(git rev-parse origin/main)
LATEST_SHORT=$(git rev-parse --short origin/main)

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
    echo "Already up to date (${CURRENT_SHORT})"
    cd "$PROJECT_ROOT"
    exit 0
fi

echo "Updating from ${CURRENT_SHORT} to ${LATEST_SHORT}..."

# Pull latest changes
git pull origin main

# Go back to project root
cd "$PROJECT_ROOT"

# Stage the submodule update
git add vendor/atproto

# Show what changed
echo ""
echo "Submodule updated successfully!"
echo "Changes:"
git diff --cached --submodule=log vendor/atproto

echo ""
echo "To complete the update, commit the changes:"
echo "  git commit -m \"Update atproto lexicons to ${LATEST_SHORT}\""
echo ""
echo "Or to see what lexicon files changed:"
echo "  cd vendor/atproto && git log --oneline ${CURRENT_SHORT}..${LATEST_SHORT} -- lexicons/"
