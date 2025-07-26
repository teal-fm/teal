# Git Hooks Setup Guide

This guide explains how to set up git hooks for the Teal project to ensure code quality, formatting, and error checking before commits.

## Overview

We provide two approaches for setting up git hooks:

1. **Simple Shell Script** - A straightforward bash script approach
2. **Pre-commit Framework** - A more robust, industry-standard solution

## What the Hooks Check

### TypeScript/JavaScript Files
- ✅ **Biome** - Linting and formatting
- ✅ **Prettier** - Code formatting
- ✅ **TypeScript** - Type checking
- ⚠️ **Console.log detection** (warning only)
- ⚠️ **TODO/FIXME comments** (warning only)

### Rust Files
- ✅ **cargo fmt** - Code formatting
- ✅ **cargo clippy** - Linting with warnings as errors

### General Files
- ✅ **Trailing whitespace** removal
- ✅ **End-of-file** fixes
- ✅ **YAML/JSON/TOML** validation
- ✅ **Merge conflict** detection
- ✅ **Large file** detection (>500KB)

## Option 1: Simple Shell Script (Recommended for Quick Setup)

### Installation

1. **Install the git hook:**
   ```bash
   # From the project root
   ./scripts/install-git-hooks.sh
   ```

2. **Verify installation:**
   ```bash
   ls -la .git/hooks/pre-commit
   ```

### Manual Installation (Alternative)

If the script doesn't work, you can install manually:

```bash
# Copy the hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Testing

Make a commit with some staged files:
```bash
git add .
git commit -m "test: testing pre-commit hook"
```

## Option 2: Pre-commit Framework (Recommended for Teams)

The pre-commit framework is more robust and provides better error handling and performance.

### Installation

1. **Install pre-commit tool:**
   ```bash
   # Using pip
   pip install pre-commit

   # Using homebrew (macOS)
   brew install pre-commit

   # Using conda
   conda install -c conda-forge pre-commit
   ```

2. **Install the git hook:**
   ```bash
   pre-commit install
   ```

3. **(Optional) Install additional hooks:**
   ```bash
   # Install commit-msg hook for commit message validation
   pre-commit install --hook-type commit-msg

   # Install pre-push hook
   pre-commit install --hook-type pre-push
   ```

### Usage

- **Automatic:** Hooks run automatically on `git commit`
- **Manual run on all files:**
  ```bash
  pre-commit run --all-files
  ```
- **Manual run on specific files:**
  ```bash
  pre-commit run --files path/to/file.ts
  ```
- **Update hook versions:**
  ```bash
  pre-commit autoupdate
  ```

## Configuration

### Environment Variables

You can customize hook behavior with environment variables:

```bash
# Skip TypeScript checking (for faster commits during development)
export SKIP_TS_CHECK=1

# Skip Rust clippy (if cargo clippy is slow)
export SKIP_RUST_CLIPPY=1

# Allow console.log statements
export ALLOW_CONSOLE_LOG=1
```

### Skipping Hooks

Sometimes you need to bypass hooks (use sparingly):

```bash
# Skip all hooks for a commit
git commit --no-verify -m "emergency fix"

# Skip specific hooks (pre-commit framework only)
SKIP=prettier,biome-check git commit -m "skip formatting"
```

### Project Scripts Integration

The hooks use existing npm scripts from `package.json`:

- `pnpm typecheck` - TypeScript type checking
- `pnpm rust:fmt` - Rust formatting
- `pnpm rust:clippy` - Rust linting
- `pnpm prettier --write` - JavaScript/TypeScript formatting
- `pnpm biome check --apply` - Biome linting and formatting

## Troubleshooting

### Common Issues

1. **"Command not found" errors:**
   - Ensure `pnpm`, `node`, and `cargo` are in your PATH
   - Run `./scripts/install-git-hooks.sh` again to check for missing tools

2. **TypeScript errors:**
   - Fix the type errors or temporarily skip with `SKIP_TS_CHECK=1 git commit`
   - Run `pnpm typecheck` manually to see full error details

3. **Rust formatting/linting errors:**
   - Run `pnpm rust:fmt` and `pnpm rust:clippy` manually
   - Fix clippy warnings or adjust clippy configuration

4. **Hook is too slow:**
   - Use pre-commit framework for better performance
   - Consider running lighter checks in pre-commit and full checks in CI

5. **Permission denied:**
   ```bash
   chmod +x .git/hooks/pre-commit
   ```

### Debugging

Enable verbose output:
```bash
# For shell script
VERBOSE=1 git commit

# For pre-commit framework
pre-commit run --verbose
```

## Customization

### Adding New Checks

#### Shell Script Approach
Edit `scripts/pre-commit-hook.sh` to add new checks.

#### Pre-commit Framework
Edit `.pre-commit-config.yaml` to add new hooks:

```yaml
- repo: local
  hooks:
    - id: my-custom-check
      name: My Custom Check
      entry: my-command
      language: system
      files: \.(ts|js)$
```

### Modifying Existing Checks

1. **Disable console.log warnings:**
   - Comment out the console.log check in the hook script
   - Or remove the `no-console-log` hook from `.pre-commit-config.yaml`

2. **Change file patterns:**
   - Modify the `files:` regex in `.pre-commit-config.yaml`
   - Or adjust the grep patterns in the shell script

3. **Add new file types:**
   - Extend the file extension patterns
   - Add appropriate formatting/linting commands

## Integration with IDEs

### VS Code
Install these extensions for seamless development:
- **Prettier** - Code formatter
- **Biome** - Fast formatter and linter
- **rust-analyzer** - Rust language support

Configure VS Code to format on save:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

### Other IDEs
Configure your IDE to:
- Run Prettier on save for JS/TS files
- Run `cargo fmt` on save for Rust files
- Show linting errors inline

## Best Practices

1. **Run hooks frequently:** Don't wait until commit time
   ```bash
   # Run manually while developing
   pre-commit run --all-files
   ```

2. **Fix issues immediately:** Don't accumulate formatting/linting debt

3. **Keep hooks fast:** Hooks should complete in <30 seconds

4. **Team consistency:** Ensure all team members use the same hook setup

5. **CI/CD integration:** Run the same checks in your CI pipeline

## Monitoring and Maintenance

### Regular Tasks

1. **Update pre-commit hooks:**
   ```bash
   pre-commit autoupdate
   ```

2. **Review hook performance:**
   ```bash
   pre-commit run --all-files --verbose
   ```

3. **Update tool versions:**
   - Keep Prettier, Biome, and other tools updated
   - Test hooks after updates

### Team Coordination

- Document any hook configuration changes
- Notify team members of new requirements
- Consider hook performance impact on team productivity

## Support

If you encounter issues:

1. Check this documentation first
2. Run manual commands to isolate the problem
3. Check tool-specific documentation (Prettier, Biome, Cargo)
4. Ask the team for help with project-specific configurations

Remember: The goal is to catch issues early and maintain code quality, not to slow down development!