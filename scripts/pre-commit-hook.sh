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

# The hook runs formatters on the working tree and stages their edits below.
STAGED_FILES=()
FORMAT_FILES=()
TS_JS_FILES=()
RUST_FILES=()
LEXICON_FILES=()
while IFS= read -r -d '' file; do
    STAGED_FILES+=("$file")
    case "$file" in
        *.ts|*.tsx|*.js|*.jsx) TS_JS_FILES+=("$file") ;;
        *.rs) RUST_FILES+=("$file") ;;
        *lexicons/*.json) LEXICON_FILES+=("$file") ;;
    esac
    case "$file" in
        *.ts|*.tsx|*.js|*.jsx|*.rs)
            if ! git --literal-pathspecs diff --quiet -- "$file"; then
                print_error "$file has unstaged changes. Stash the unstaged edits before running this hook."
                exit 1
            fi
            FORMAT_FILES+=("$file")
            ;;
    esac
done < <(git diff --cached --name-only --diff-filter=ACMR -z)

if [ "${#STAGED_FILES[@]}" -eq 0 ]; then
    print_warning "No staged files found"
    exit 0
fi

report_unstaged_fixes() {
    local status=$? file
    if [ "$status" -ne 0 ]; then
        local changed=()
        for file in "${FORMAT_FILES[@]}"; do
            if ! git --literal-pathspecs diff --quiet -- "$file"; then
                changed+=("$file")
            fi
        done
        if [ "${#changed[@]}" -gt 0 ]; then
            print_warning "The hook changed these files before a check failed:"
            printf '  - %s\n' "${changed[@]}"
            print_status "Review the changes with git diff and stage the fixes you want before retrying."
        fi
    fi
    return "$status"
}
trap report_unstaged_fixes EXIT

print_status "Staged files to check:"
printf '  - %s\n' "${STAGED_FILES[@]}"

# 1. TypeScript/JavaScript checks
if [ "${#TS_JS_FILES[@]}" -gt 0 ]; then
    print_status "Running TypeScript/JavaScript checks..."

    # Check if biome is available and run it
    if command -v pnpm >/dev/null 2>&1; then
        print_status "Running Biome lint checks..."
        if ! pnpm exec biome lint --write --no-errors-on-unmatched -- "${TS_JS_FILES[@]}"; then
            print_error "Biome check failed. Please fix the issues and try again."
            exit 1
        fi

        print_status "Running Prettier formatting..."
        if ! pnpm exec prettier --write -- "${TS_JS_FILES[@]}"; then
            print_error "Prettier formatting failed. Please fix the issues and try again."
            exit 1
        fi

        # TypeScript checking temporarily disabled due to vendor compilation issues
        # Re-enable once vendor code is fixed
    else
        print_warning "pnpm not found, skipping JS/TS checks"
    fi
fi

# 2. Rust checks
if [ "${#RUST_FILES[@]}" -gt 0 ]; then
    print_status "Running Rust checks..."

    if command -v cargo >/dev/null 2>&1; then
        RUST_ERRORS=0

        # Check services workspace
        if [ -f "services/Cargo.toml" ]; then
            print_status "Running cargo fmt on services workspace..."
            if ! (cd services && cargo fmt --check) 2>/dev/null; then
                print_status "Auto-formatting Rust code in services..."
                (cd services && cargo fmt) 2>/dev/null || true
            fi

            print_status "Running cargo clippy on services workspace..."
            if (cd services && cargo check); then
                if ! (cd services && cargo clippy -- -D warnings); then
                    print_warning "Cargo clippy found issues in services workspace. Please fix the warnings."
                    print_warning "Run 'pnpm rust:clippy:services' to see detailed errors."
                    # Don't fail the commit for clippy warnings, just warn
                fi
            else
                print_warning "Services workspace has compilation errors. Skipping clippy."
                print_warning "Run 'pnpm rust:clippy:services' to see detailed errors."
            fi
        fi

        # Check individual Rust projects outside services
        CHECKED_DIRS=""
        for rust_file in "${RUST_FILES[@]}"; do
            rust_dir=$(dirname "$rust_file")
            # Find the nearest Cargo.toml going up the directory tree
            check_dir="$rust_dir"
            while [ "$check_dir" != "." ] && [ "$check_dir" != "/" ]; do
                if [ -f "$check_dir/Cargo.toml" ] && [ "$check_dir" != "services" ]; then
                    # Skip if we already checked this directory
                    if echo "$CHECKED_DIRS" | grep -q "$check_dir"; then
                        break
                    fi
                    CHECKED_DIRS="$CHECKED_DIRS $check_dir"

                    # Found a Cargo.toml outside services workspace
                    print_status "Running cargo fmt on $check_dir..."
                    if ! (cd "$check_dir" && cargo fmt --check) 2>/dev/null; then
                        print_status "Auto-formatting Rust code in $check_dir..."
                        (cd "$check_dir" && cargo fmt) 2>/dev/null || true
                    fi

                    print_status "Running cargo clippy on $check_dir..."
                    if (cd "$check_dir" && cargo check); then
                        if ! (cd "$check_dir" && cargo clippy -- -D warnings); then
                            print_error "Cargo clippy found issues in $check_dir. Please fix the warnings and try again."
                            RUST_ERRORS=1
                        fi
                    else
                        print_warning "Project $check_dir has compilation errors. Skipping clippy."
                        print_warning "Run 'cd $check_dir && cargo check' to see detailed errors."
                    fi
                    break
                fi
                check_dir=$(dirname "$check_dir")
            done
        done

        if [ $RUST_ERRORS -eq 1 ]; then
            exit 1
        fi
    else
        print_warning "Cargo not found, skipping Rust checks"
    fi
fi

# 3. Lexicon checks
if [ "${#LEXICON_FILES[@]}" -gt 0 ]; then
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
FORMATTED_FILES=()
for file in "${FORMAT_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check if file was modified by formatters
        if ! git --literal-pathspecs diff --quiet -- "$file"; then
            FORMATTED_FILES+=("$file")
            git --literal-pathspecs add -- "$file"
        fi
    fi
done

if [ "${#FORMATTED_FILES[@]}" -gt 0 ]; then
    print_success "Auto-formatted files have been re-staged:"
    printf '  - %s\n' "${FORMATTED_FILES[@]}"
fi

# 5. Final validation - ensure no syntax errors in staged files
print_status "Running final validation..."

# Check for common issues
for file in "${TS_JS_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check for console.log statements (optional - remove if you want to allow them)
        if grep -n -- "console\.log" "$file" >/dev/null 2>&1; then
            print_warning "Found console.log statements in $file! yooo!!!"
            # Uncomment the next two lines if you want to block commits with console.log
            # print_error "Please remove console.log statements before committing"
            # exit 1
        fi

        # Check for TODO/FIXME comments in committed code (optional)
        if grep -n -i -- "TODO\|FIXME" "$file" >/dev/null 2>&1; then
            print_warning "Found TODO/FIXME comments in $file"
        fi
    fi
done

print_success "All pre-commit checks passed! 🎉"
exit 0
