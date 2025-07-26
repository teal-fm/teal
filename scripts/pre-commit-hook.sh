#!/bin/bash

# Pre-commit hook for Teal project
# This script runs code formatting and linting checks before allowing commits

set -e

echo "🔍 Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    print_warning "No staged files found"
    exit 0
fi

# Check if we have TypeScript/JavaScript files
TS_JS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx)$' || true)
# Check if we have Rust files
RUST_FILES=$(echo "$STAGED_FILES" | grep -E '\.rs$' || true)
# Check if we have lexicon files
LEXICON_FILES=$(echo "$STAGED_FILES" | grep -E 'lexicons/.*\.json$' || true)

print_status "Staged files to check:"
echo "$STAGED_FILES" | sed 's/^/  - /'

# 1. TypeScript/JavaScript checks
if [ -n "$TS_JS_FILES" ]; then
    print_status "Running TypeScript/JavaScript checks..."

    # Check if biome is available and run it
    if command -v pnpm >/dev/null 2>&1; then
        print_status "Running Biome formatting and linting..."
        if ! pnpm biome check . --apply --no-errors-on-unmatched 2>/dev/null; then
            print_error "Biome check failed. Please fix the issues and try again."
            exit 1
        fi

        print_status "Running Prettier formatting..."
        if ! pnpm prettier --write $TS_JS_FILES 2>/dev/null; then
            print_error "Prettier formatting failed. Please fix the issues and try again."
            exit 1
        fi

        print_status "Running TypeScript type checking..."
        if ! pnpm typecheck 2>/dev/null; then
            print_error "TypeScript type checking failed. Please fix the type errors and try again."
            exit 1
        fi
    else
        print_warning "pnpm not found, skipping JS/TS checks"
    fi
fi

# 2. Rust checks
if [ -n "$RUST_FILES" ]; then
    print_status "Running Rust checks..."

    if command -v cargo >/dev/null 2>&1; then
        # Check if we're in a Rust project directory
        if [ -f "Cargo.toml" ] || [ -f "services/Cargo.toml" ]; then
            print_status "Running cargo fmt..."
            if ! pnpm rust:fmt 2>/dev/null; then
                print_error "Cargo fmt failed. Please fix the formatting issues and try again."
                exit 1
            fi

            print_status "Running cargo clippy..."
            if ! pnpm rust:clippy -- -D warnings 2>/dev/null; then
                print_error "Cargo clippy found issues. Please fix the warnings and try again."
                exit 1
            fi
        fi
    else
        print_warning "Cargo not found, skipping Rust checks"
    fi
fi

# 3. Lexicon checks
if [ -n "$LEXICON_FILES" ]; then
    print_status "Lexicon files changed, validating and regenerating..."

    if command -v pnpm >/dev/null 2>&1; then
        print_status "Validating lexicons..."
        if ! pnpm lex:validate 2>/dev/null; then
            print_error "Lexicon validation failed. Please fix the lexicon files and try again."
            exit 1
        fi

        print_status "Regenerating lexicons..."
        if ! pnpm lex:gen-server 2>/dev/null; then
            print_error "Lexicon generation failed. Please check the lexicon files and try again."
            exit 1
        fi

        # Note: Generated lexicon files are ignored by .gitignore and not added to staging
        print_status "Generated lexicon files are ignored by .gitignore (as intended)"
    else
        print_warning "pnpm not found, skipping lexicon checks"
    fi
fi

# 4. Re-add files that might have been formatted
FORMATTED_FILES=""
for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
        # Check if file was modified by formatters
        if [ -n "$(git diff "$file")" ]; then
            FORMATTED_FILES="$FORMATTED_FILES $file"
            git add "$file"
        fi
    fi
done

if [ -n "$FORMATTED_FILES" ]; then
    print_success "Auto-formatted files have been re-staged:"
    echo "$FORMATTED_FILES" | tr ' ' '\n' | sed 's/^/  - /'
fi

# 5. Final validation - ensure no syntax errors in staged files
print_status "Running final validation..."

# Check for common issues
for file in $TS_JS_FILES; do
    if [ -f "$file" ]; then
        # Check for console.log statements (optional - remove if you want to allow them)
        if grep -n "console\.log" "$file" >/dev/null 2>&1; then
            print_warning "Found console.log statements in $file"
            # Uncomment the next two lines if you want to block commits with console.log
            # print_error "Please remove console.log statements before committing"
            # exit 1
        fi

        # Check for TODO/FIXME comments in committed code (optional)
        if grep -n -i "TODO\|FIXME" "$file" >/dev/null 2>&1; then
            print_warning "Found TODO/FIXME comments in $file"
        fi
    fi
done

print_success "All pre-commit checks passed! 🎉"
exit 0
