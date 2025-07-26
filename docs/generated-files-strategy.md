# Generated Files Strategy

This document explains our approach to handling generated files in the Teal project, specifically for lexicon-generated TypeScript files.

## TL;DR

**Generated files are NOT tracked in git** - they are ignored by `.gitignore` and regenerated automatically when needed.

## The Problem

Generated files (like TypeScript types from lexicon schemas) present a common dilemma:

### Option A: Track Generated Files in Git
**Pros:**
- Immediate availability after clone
- Clear diff of what changed
- No build step required for basic usage

**Cons:**
- Merge conflicts in generated code
- Bloated git history with auto-generated changes
- Risk of generated files becoming out of sync with source
- Larger repository size
- Confusing diffs mixing human and generated changes

### Option B: Ignore Generated Files (Our Choice)
**Pros:**
- Clean git history with only human changes
- No merge conflicts in generated code
- Smaller repository size
- Generated files always match current source
- Clear separation between source and generated code

**Cons:**
- Requires build step after clone
- Not immediately usable without generation

## Our Implementation

We chose **Option B** for these reasons:

### 1. Automatic Generation Pipeline

Generated files are created automatically in multiple scenarios:

```bash
# After fresh install
pnpm install  # → triggers postinstall → lex:gen-server

# Before builds
pnpm turbo build --filter=@teal/amethyst  # → generates lexicons first

# During development
pnpm lex:watch  # → regenerates on source changes

# In Docker builds
docker build ...  # → includes generation step

# Via git hooks
git commit  # → validates and regenerates if lexicon files changed
```

### 2. Zero Developer Friction

Developers don't need to think about generated files:

```bash
# This just works - lexicons generated automatically
git clone <repo>
pnpm install
pnpm build
```

### 3. Build System Integration

Turbo ensures lexicons are always fresh:

```json
{
  "@teal/amethyst#build": {
    "dependsOn": ["@teal/lexicons#lex:gen-server"]
  }
}
```

### 4. Git Hook Validation

When lexicon source files change, hooks:
1. Validate lexicon syntax
2. Regenerate TypeScript files
3. Ensure generation succeeds
4. **Don't stage generated files** (they remain ignored)

## File Patterns

### Tracked (Source Files)
```
lexicons/fm.teal.alpha/*.json     ✅ Tracked
packages/lexicons/package.json    ✅ Tracked
packages/lexicons/lex-gen.sh      ✅ Tracked
```

### Ignored (Generated Files)
```
packages/lexicons/src/            ❌ Ignored (.gitignore)
services/types/src/               ❌ Ignored (.gitignore)
```

### .gitignore Entry
```gitignore
# generated lexicons
# js lexicons
packages/lexicons/src
# rust lexicons (types :)))
services/types/src
```

## Benefits in Practice

### Clean Git History
```bash
# Only meaningful changes show up in git log
commit abc123: feat: add new actor profile fields
commit def456: fix: update feed lexicon validation
```

Instead of:
```bash
commit abc123: feat: add new actor profile fields
commit abc124: [auto] regenerate lexicons
commit abc125: fix: regenerated lexicon formatting
commit abc126: merge conflict in generated files
```

### No Merge Conflicts
When multiple developers change lexicons, git only needs to merge the source JSON files, not generated TypeScript.

### Always Fresh
Generated files always match the current lexicon sources - no risk of drift.

### Faster CI/CD
CI systems generate files once and use them, rather than pulling large generated file diffs.

## Developer Workflow

### First Time Setup
```bash
git clone <repo>
pnpm install        # Generates lexicons automatically
pnpm dev           # Ready to develop
```

### Making Lexicon Changes
```bash
# Edit lexicon files
vim lexicons/fm.teal.alpha/actor/profile.json

# Validate and regenerate (automatic via git hooks)
git add .
git commit -m "feat: add profile status field"

# Or manually
pnpm lex:validate
pnpm lex:gen-server
```

### Checking Generated Output
```bash
# View generated files (not tracked)
ls packages/lexicons/src/types/

# Regenerate if needed
pnpm lex:gen-server
```

## CI/CD Considerations

### GitHub Actions
Our workflows automatically handle generation:

```yaml
- name: Install dependencies
  run: pnpm install  # Triggers postinstall generation

- name: Build applications
  run: pnpm build    # Triggers lexicon generation via Turbo
```

### Docker Builds
```dockerfile
# Generate lexicons during build
RUN pnpm install
RUN pnpm lex:gen-server
RUN pnpm run build:web
```

## Troubleshooting

### "Module not found" errors
```bash
# Regenerate lexicons
pnpm lex:gen-server

# Check if files were created
ls packages/lexicons/src/
```

### After switching branches
```bash
# Regenerate for new lexicon state
pnpm lex:gen-server
```

### Fresh environment setup
```bash
# This should be all you need
pnpm install
```

## Comparison with Other Projects

### Projects That Track Generated Files
- **Protocol Buffers in some repos** - Often track `.pb.go` files
- **OpenAPI generators** - Sometimes track generated client code
- **GraphQL codegen** - Mixed approaches

### Projects That Ignore Generated Files
- **Create React App** - Ignores build output
- **Next.js** - Ignores `.next/` directory
- **Rust projects** - Ignore `target/` directory
- **Our approach** - Ignore `packages/lexicons/src/`

## Alternative Approaches Considered

### 1. Separate Generated Files Repo
- **Pro**: Clean main repo
- **Con**: Complex CI/CD, dependency management nightmare

### 2. Git Submodules for Generated Code
- **Pro**: Separation of concerns
- **Con**: Submodule complexity, versioning issues

### 3. Package Registry for Generated Code
- **Pro**: Versioned, distributed
- **Con**: Build complexity, circular dependencies

### 4. Build-time Generation Only
- **Pro**: Always fresh
- **Con**: Slower builds, requires build for development

## Conclusion

Our strategy of **ignoring generated files** with **automatic regeneration** provides:

1. **Clean git history** - Only human changes tracked
2. **Zero friction** - Developers don't manage generated files
3. **Always consistent** - Generated files match current source
4. **Robust pipeline** - Multiple generation triggers ensure availability
5. **CI/CD friendly** - Clean, predictable builds

This approach scales well with team size and project complexity while maintaining developer productivity and code quality.

---

**Key Principle**: *Source of truth is the lexicon JSON files. Everything else is derived and regenerated automatically.*