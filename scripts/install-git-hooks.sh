#!/bin/bash

# Install git hooks for the Teal project
# This script sets up pre-commit hooks for code formatting and linting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "This script must be run from the root of a git repository"
    exit 1
fi

print_status "Installing git hooks for Teal project..."

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [ -f "scripts/pre-commit-hook.sh" ]; then
    print_status "Installing pre-commit hook..."
    cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    print_success "Pre-commit hook installed"
else
    print_error "Pre-commit hook script not found at scripts/pre-commit-hook.sh"
    exit 1
fi

# Optional: Install other hooks
# You can add more hooks here if needed

print_status "Testing hook installation..."

# Test if the hook is executable
if [ -x ".git/hooks/pre-commit" ]; then
    print_success "Pre-commit hook is executable"
else
    print_error "Pre-commit hook is not executable"
    exit 1
fi

# Check if required tools are available
print_status "Checking required tools..."

MISSING_TOOLS=""

if ! command -v pnpm >/dev/null 2>&1; then
    MISSING_TOOLS="$MISSING_TOOLS pnpm"
fi

if ! command -v node >/dev/null 2>&1; then
    MISSING_TOOLS="$MISSING_TOOLS node"
fi

if ! command -v cargo >/dev/null 2>&1; then
    MISSING_TOOLS="$MISSING_TOOLS cargo"
fi

if [ -n "$MISSING_TOOLS" ]; then
    print_warning "Some tools are missing:$MISSING_TOOLS"
    print_warning "The git hooks may not work properly without these tools"
else
    print_success "All required tools are available"
fi

print_success "Git hooks installation complete! 🎉"
print_status "The following hooks have been installed:"
echo "  - pre-commit: Runs formatting and linting checks before commits"

print_status "To test the pre-commit hook, try making a commit with staged files"
print_status "To temporarily skip hooks, use: git commit --no-verify"

# Optional: Show hook status
echo ""
print_status "Installed hooks:"
ls -la .git/hooks/ | grep -v sample | grep -v "^d" | sed 's/^/  /'
