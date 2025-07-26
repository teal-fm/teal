# Lexicon Development Guide

This guide explains how to work with lexicons in the Teal project, ensuring they are properly generated before building applications like Amethyst.

## Overview

Lexicons in Teal are AT Protocol schema definitions that get compiled into TypeScript types and interfaces. The system ensures that:

1. Lexicons are automatically generated before building applications
2. Changes to lexicon files trigger regeneration
3. Generated types are available to all applications that depend on them

## Project Structure

```
teal/
├── lexicons/                    # Source lexicon JSON files
│   └── fm.teal.alpha/          # Lexicon namespace
├── packages/lexicons/          # Generated TypeScript package
│   ├── src/                    # Generated TypeScript files
│   │   ├── types/              # Generated type definitions
│   │   ├── index.ts           # Main exports
│   │   └── lexicons.ts        # Lexicon registry
│   └── lex-gen.sh             # Generation script
└── tools/lexicon-cli/          # Lexicon CLI tool
```

## How It Works

### Automatic Generation

The build system automatically ensures lexicons are generated before building dependent applications:

1. **Turbo Pipeline**: Amethyst builds depend on `@teal/lexicons#lex:gen-server`
2. **Postinstall Hook**: Lexicons are generated after `pnpm install`
3. **Docker Builds**: Lexicons are generated during container builds
4. **Git Hooks**: Lexicon changes trigger validation and regeneration

### Generation Process

```bash
# Source files (JSON)
lexicons/fm.teal.alpha/*.json

# ↓ Generate with
pnpm lex:gen-server

# ↓ Produces TypeScript files
packages/lexicons/src/types/fm/teal/alpha/*.ts
packages/lexicons/src/index.ts
packages/lexicons/src/lexicons.ts
```

## Development Workflow

### Making Lexicon Changes

1. **Edit lexicon files** in `lexicons/` directory
2. **Validate changes**:
   ```bash
   pnpm lex:validate
   ```
3. **Generate types**:
   ```bash
   pnpm lex:gen-server
   ```
4. **Build and test**:
   ```bash
   pnpm lex:build-amethyst
   ```

### Available Commands

```bash
# Generate lexicons for server (TypeScript)
pnpm lex:gen-server

# Generate all lexicons (includes Rust bindings)
pnpm lex:gen

# Validate lexicon files
pnpm lex:validate

# Watch for changes and regenerate
pnpm lex:watch

# Show differences between versions
pnpm lex:diff

# Build amethyst with fresh lexicons
pnpm lex:build-amethyst

# Start amethyst dev server with fresh lexicons
pnpm lex:dev
```

### Development Server

For active lexicon development, use the watch mode:

```bash
# Terminal 1: Watch and regenerate lexicons
pnpm lex:watch

# Terminal 2: Run amethyst dev server
cd apps/amethyst && pnpm dev
```

## Integration Details

### Turbo Configuration

The `turbo.json` file ensures proper build dependencies:

```json
{
  "pipeline": {
    "@teal/amethyst#build": {
      "dependsOn": ["@teal/lexicons#lex:gen-server"]
    },
    "@teal/amethyst#build:web": {
      "dependsOn": ["@teal/lexicons#lex:gen-server"]
    }
  }
}
```

### Package Dependencies

Amethyst depends on the lexicons package:

```json
{
  "dependencies": {
    "@teal/lexicons": "workspace:*"
  }
}
```

### Docker Integration

The Amethyst Dockerfile generates lexicons during build:

```dockerfile
# Install dependencies
RUN pnpm install

# Generate lexicons before building amethyst
RUN pnpm lex:gen-server

# Build the amethyst app
RUN pnpm run build:web
```

## Git Hooks Integration

### Pre-commit Validation

When lexicon files change, git hooks automatically:

1. **Validate** lexicon syntax
2. **Regenerate** TypeScript types
3. **Stage** generated files for commit

### Manual Hook Bypass

If you need to skip lexicon validation:

```bash
# Skip all hooks
git commit --no-verify

# Skip specific hooks (pre-commit framework)
SKIP=lexicon-validate,lexicon-generate git commit
```

## Troubleshooting

### Common Issues

1. **"Lexicons not found" errors**
   ```bash
   # Regenerate lexicons
   pnpm lex:gen-server
   
   # Check if files were generated
   ls packages/lexicons/src/
   ```

2. **TypeScript compilation errors after lexicon changes**
   ```bash
   # Clean and rebuild
   pnpm lex:gen-server
   pnpm turbo build --filter=@teal/amethyst --force
   ```

3. **Docker build fails with lexicon errors**
   ```bash
   # Ensure lexicons directory is copied
   # Check Dockerfile includes: COPY lexicons/ ./lexicons/
   ```

4. **Git hooks fail on lexicon validation**
   ```bash
   # Validate manually to see detailed errors
   pnpm lex:validate
   
   # Fix validation errors in lexicon JSON files
   ```

### Debug Commands

```bash
# Check what lexicons exist
find lexicons/ -name "*.json" -type f

# Check generated files
find packages/lexicons/src/ -name "*.ts" -type f

# Test lexicon CLI directly
cd tools/lexicon-cli
node dist/index.js validate

# Check turbo task dependencies
pnpm turbo build --filter=@teal/amethyst --dry-run
```

### Performance Considerations

- **Lexicon generation is cached** by Turbo based on input files
- **Only regenerates when source files change**
- **Use `--force` flag to override cache** if needed

## Best Practices

### 1. Lexicon File Organization

```
lexicons/
└── fm.teal.alpha/
    ├── actor/
    │   ├── profile.json
    │   └── status.json
    ├── feed/
    │   └── play.json
    └── stats/
        └── latest.json
```

### 2. Validation Before Commits

Always validate lexicons before committing:

```bash
pnpm lex:validate && git add . && git commit
```

### 3. Testing Changes

Test lexicon changes in dependent applications:

```bash
pnpm lex:gen-server
pnpm turbo typecheck --filter=@teal/amethyst
```

### 4. Documentation

Document breaking changes in lexicons:
- Update version numbers appropriately
- Note deprecated fields
- Provide migration guides for consumers

## CI/CD Integration

### GitHub Actions

The CI pipeline automatically:

1. **Installs dependencies** (triggers postinstall lexicon generation)
2. **Builds applications** (triggers lexicon generation via Turbo)
3. **Validates types** (ensures generated lexicons are valid)

### Manual CI Testing

```bash
# Simulate CI environment
rm -rf packages/lexicons/src/
pnpm install  # Should regenerate lexicons
pnpm build    # Should build successfully
```

## Advanced Usage

### Custom Lexicon CLI Commands

The lexicon CLI tool supports additional commands:

```bash
cd tools/lexicon-cli

# Generate with custom options
node dist/index.js gen --output custom-path

# Watch specific files
node dist/index.js watch --pattern "lexicons/custom/*.json"

# Validate with verbose output
node dist/index.js validate --verbose
```

### Multiple Output Formats

```bash
# Generate TypeScript (default)
pnpm lex:gen-server

# Generate all formats (includes Rust)
pnpm lex:gen
```

## Monitoring and Maintenance

### Regular Tasks

1. **Update lexicon CLI tools** when AT Protocol updates
2. **Validate all lexicons** after tool updates
3. **Review generated code** for unexpected changes
4. **Update documentation** when lexicon structure changes

### Health Checks

```bash
# Verify lexicon generation is working
pnpm lex:gen-server && echo "✅ Lexicons generated successfully"

# Verify amethyst can build with current lexicons
pnpm turbo build --filter=@teal/amethyst && echo "✅ Amethyst builds successfully"

# Verify TypeScript compilation
pnpm typecheck && echo "✅ TypeScript compilation successful"
```

Remember: The goal is to keep lexicons always in sync with the applications that depend on them, ensuring a smooth development experience!