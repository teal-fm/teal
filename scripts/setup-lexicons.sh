#!/bin/bash
# scripts/setup-lexicons.sh
# Setup script for ATProto lexicons submodule and symbolic links

set -e

echo "Setting up lexicons..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "lexicons" ]; then
    echo "Error: This script must be run from the project root directory"
    exit 1
fi

# Initialize submodules
echo "Initializing submodules..."
git submodule update --init --recursive

# Check if vendor/atproto exists
if [ ! -d "vendor/atproto" ]; then
    echo "Error: vendor/atproto submodule not found"
    exit 1
fi

# Create symbolic links if they don't exist
echo "Creating symbolic links..."
cd lexicons

if [ ! -L app ]; then
    ln -s ../vendor/atproto/lexicons/app app
    echo "Created symlink: lexicons/app"
else
    echo "Symlink already exists: lexicons/app"
fi

if [ ! -L chat ]; then
    ln -s ../vendor/atproto/lexicons/chat chat
    echo "Created symlink: lexicons/chat"
else
    echo "Symlink already exists: lexicons/chat"
fi

if [ ! -L com ]; then
    ln -s ../vendor/atproto/lexicons/com com
    echo "Created symlink: lexicons/com"
else
    echo "Symlink already exists: lexicons/com"
fi

if [ ! -L tools ]; then
    ln -s ../vendor/atproto/lexicons/tools tools
    echo "Created symlink: lexicons/tools"
else
    echo "Symlink already exists: lexicons/tools"
fi

cd ..

echo "Lexicons setup complete!"
echo ""
echo "You should now have access to:"
echo "  - lexicons/app -> ATProto app lexicons"
echo "  - lexicons/chat -> ATProto chat lexicons"
echo "  - lexicons/com -> ATProto protocol lexicons"
echo "  - lexicons/tools -> ATProto tools lexicons"
echo "  - lexicons/fm.teal.alpha -> Custom Teal lexicons"
