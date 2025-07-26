# Lexicon Build Integration Summary

This document summarizes the lexicon build integration setup that ensures lexicons are properly generated before compiling Amethyst and other dependent applications.

## ✅ What Was Implemented

### 1. Turbo Build Dependencies
- **Location**: `turbo.json`
- **What**: Added explicit dependencies for Amethyst builds on lexicon generation
- **Effect**: Ensures `@teal/lexicons#lex:gen-server` runs before any Amethyst build command

```json
{
  "@teal/amethyst#build": {
    "dependsOn": ["@teal/lexicons#lex:gen-server"],
    "outputs": ["./build/**"]
  },
  "@teal/amethyst#build:web": {
    "dependsOn": ["@teal/lexicons#lex:gen-server"],
    "outputs": ["./build/**"]
  },
  "@teal/amethyst#build:ios": {
    "dependsOn": ["@teal/lexicons#lex:gen-server"],
    "outputs": ["./build/**"]
  }
}
```

### 2. Postinstall Hook
- **Location**: `package.json`
- **What**: Added `"postinstall": "pnpm lex:gen-server"`
- **Effect**: Lexicons are automatically generated after `pnpm install`

### 3. Docker Build Integration
- **Location**: `apps/amethyst/Dockerfile`
- **What**: Updated Docker build process to generate lexicons before building Amethyst
- **Changes**:
  - Copy lexicons source directory
  - Run `pnpm lex:gen-server` before building Amethyst
  - Install dependencies from root to access lexicon generation tools

### 4. Git Hooks Integration
- **Location**: `scripts/pre-commit-hook.sh` and `.pre-commit-config.yaml`
- **What**: Added lexicon validation and regeneration to git hooks
- **Effect**: When lexicon files change, hooks automatically validate and regenerate TypeScript types

### 5. Development Scripts
- **Location**: `package.json`
- **What**: Added convenience scripts for lexicon development
- **Scripts**:
  - `lex:build-amethyst`: Generate lexicons and build Amethyst
  - `lex:dev`: Generate lexicons and start Amethyst dev server

## 🔄 How It Works

### Build Process Flow

```
1. Developer runs: pnpm build (or pnpm turbo build --filter=@teal/amethyst)
   ↓
2. Turbo checks dependencies and sees amethyst#build depends on lexicons#lex:gen-server
   ↓
3. Turbo runs: @teal/lexicons#lex:gen-server (if not cached)
   ↓
4. lexicons/lex-gen.sh generates TypeScript files in packages/lexicons/src/
   ↓
5. Turbo runs: @teal/amethyst#build
   ↓
6. Amethyst build has access to fresh @teal/lexicons package
```

### Docker Build Flow

```
1. Docker build starts
   ↓
2. Copy source files (including lexicons/ directory)
   ↓
3. Run: pnpm install (triggers postinstall → lex:gen-server)
   ↓
4. Run: pnpm lex:gen-server (explicit generation)
   ↓
5. Run: pnpm run build:web (Amethyst build)
   ↓
6. Container includes built Amethyst with fresh lexicons
```

### Git Hook Flow

```
1. Developer modifies lexicons/*.json files
   ↓
2. Developer runs: git commit
   ↓
3. Pre-commit hook detects lexicon file changes
   ↓
4. Hook runs: pnpm lex:validate
   ↓
5. Hook runs: pnpm lex:gen-server
   ↓
6. Hook stages generated TypeScript files
   ↓
7. Commit proceeds with both source and generated files
```

## 🛠️ Available Commands

### For Developers

```bash
# Generate lexicons manually
pnpm lex:gen-server

# Build Amethyst with fresh lexicons
pnpm lex:build-amethyst

# Start Amethyst dev server with fresh lexicons
pnpm lex:dev

# Validate lexicon files
pnpm lex:validate

# Watch for lexicon changes and regenerate
pnpm lex:watch
```

### For CI/CD

```bash
# Install dependencies (automatically generates lexicons)
pnpm install

# Build all (lexicons generated automatically via Turbo)
pnpm build

# Build specific app (lexicons generated automatically)
pnpm turbo build --filter=@teal/amethyst
```

## 📁 Key Files Modified

1. **`turbo.json`** - Added Amethyst build dependencies on lexicon generation
2. **`package.json`** - Added postinstall hook and convenience scripts
3. **`apps/amethyst/Dockerfile`** - Updated to generate lexicons during Docker build
4. **`scripts/pre-commit-hook.sh`** - Added lexicon validation and regeneration
5. **`.pre-commit-config.yaml`** - Added lexicon hooks for pre-commit framework

## 🎯 Benefits

1. **Zero Manual Work**: Lexicons are automatically generated when needed
2. **Build Reliability**: Amethyst builds can't proceed without fresh lexicons
3. **Developer Experience**: No need to remember to run lexicon commands
4. **CI/CD Safety**: Docker builds include lexicon generation
5. **Git Safety**: Commits with lexicon changes include generated files
6. **Caching**: Turbo caches lexicon generation for performance

## 🔍 Verification

### Test Local Build
```bash
# Clean generated files
rm -rf packages/lexicons/src/

# Build should regenerate lexicons automatically
pnpm turbo build --filter=@teal/amethyst
```

### Test Docker Build
```bash
# Build Docker image (should include lexicon generation)
docker build -f apps/amethyst/Dockerfile .
```

### Test Git Hooks
```bash
# Make a lexicon change
echo '{}' > lexicons/test.json

# Commit should validate and regenerate
git add . && git commit -m "test lexicon change"
```

## 🚨 Troubleshooting

### "Lexicons not found" errors
```bash
# Manually regenerate
pnpm lex:gen-server

# Check if files exist
ls packages/lexicons/src/
```

### Docker build fails
- Ensure `lexicons/` directory is copied in Dockerfile
- Check that `lex:gen-server` command runs successfully

### Git hooks fail
```bash
# Test validation manually
pnpm lex:validate

# Bypass hooks temporarily
git commit --no-verify
```

## 📚 Related Documentation

- [`docs/lexicon-development.md`](./lexicon-development.md) - Detailed lexicon development guide
- [`docs/git-hooks-setup.md`](./git-hooks-setup.md) - Git hooks setup and usage

---

**Status**: ✅ Complete and fully integrated
**Last Updated**: December 2024
**Maintainer**: Engineering Team