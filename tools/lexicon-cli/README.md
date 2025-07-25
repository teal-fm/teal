# Lexicon CLI Tool

A unified command-line tool for managing AT Protocol lexicons across TypeScript and Rust codegen in the Teal monorepo.

## Features

- **Unified Generation**: Generate both TypeScript and Rust types from lexicons with a single command
- **Auto-installation**: Automatically installs required dependencies (esquema-cli) when needed
- **File Watching**: Watch lexicon files for changes and auto-regenerate types
- **Cross-language Validation**: Validate consistency between TypeScript and Rust generated types
- **Diff Analysis**: Show impact of lexicon changes on generated code

## Installation

The tool is automatically available in the workspace. Install dependencies:

```bash
pnpm install
```

## Commands

### Generate Types

Generate both TypeScript and Rust types from lexicons:

```bash
# Generate all types
pnpm lex:gen

# Generate only TypeScript types
lex gen --ts-only

# Generate only Rust types  
lex gen --rust-only

# Force regeneration even if no changes detected
lex gen --force
```

### Watch for Changes

Automatically regenerate types when lexicon files change:

```bash
# Watch all lexicon files
pnpm lex:watch

# Watch only for TypeScript generation
lex watch --ts-only

# Watch only for Rust generation
lex watch --rust-only
```

### Validate Types

Validate that generated types are consistent and up-to-date:

```bash
pnpm lex:validate
```

### Show Changes

Display lexicon and generated type changes:

```bash
# Show changes since last commit
pnpm lex:diff

# Show changes since specific commit
lex diff HEAD~3
```

## How It Works

### TypeScript Generation
- Uses `@atproto/lex-cli` to generate TypeScript types
- Sources lexicons from `packages/lexicons/real/`
- Outputs to `packages/lexicons/src/types/`

### Rust Generation
- Uses `esquema-cli` (forked from atrium-codegen) 
- Sources lexicons from `services/types/lexicons/`
- Outputs to `services/types/src/`
- Auto-installs esquema-cli if not present

### File Watching
- Monitors both lexicon source directories
- Debounces changes to avoid multiple regenerations
- Shows clear feedback about what changed

## Integration with Build System

The tool integrates with the existing Turbo build pipeline:

- `lex:gen-server` - Legacy TypeScript-only generation (kept for compatibility)
- `lex:gen` - New unified generation command
- `lex:watch` - File watching for development
- `lex:validate` - Type validation

## Lexicon Sources

### Teal Lexicons (`fm.teal.alpha.*`)
- **Actor**: Profile management, status tracking, search
- **Feed**: Music play tracking, artist/track data  
- **Stats**: Top artists, releases, user statistics

### External Protocol Support
- **Bluesky** (`app.bsky.*`): Full AT Protocol compatibility
- **Statusphere** (`xyz.statusphere.*`): Status sharing
- **AT Protocol Core** (`com.atproto.*`): Authentication, repositories, admin

## Developer Workflow

1. **Making Lexicon Changes**: Edit files in `packages/lexicons/real/` or `services/types/lexicons/`
2. **Regenerate Types**: Run `pnpm lex:gen` or use `pnpm lex:watch` during development
3. **Validate Changes**: Run `pnpm lex:validate` to check consistency
4. **Review Impact**: Use `pnpm lex:diff` to see what changed

## Troubleshooting

### esquema-cli Installation Issues
If automatic installation fails:
```bash
cargo install esquema-cli --git https://github.com/fatfingers23/esquema.git
```

### Type Generation Failures
- Ensure lexicon JSON files are valid
- Check that both TypeScript and Rust lexicon directories exist
- Verify file permissions for output directories

### Watch Mode Issues
- File watching uses `chokidar` for cross-platform compatibility
- If changes aren't detected, try restarting the watcher
- Large numbers of files may cause performance issues

## Configuration

The tool automatically detects the workspace structure using:
- `pnpm-workspace.yaml` for workspace root detection
- Package structure for TypeScript and Rust paths
- Git for diff operations

No additional configuration is required.