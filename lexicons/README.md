# Lexicons Directory

This directory contains ATProto lexicon definitions used by the Teal project.

## Structure

- `app/`, `chat/`, `com/`, `tools/` - Symbolic links to the official ATProto lexicons from the [bluesky-social/atproto](https://github.com/bluesky-social/atproto) repository
- `fm.teal.alpha/` - Custom Teal-specific lexicon definitions

## Submodule Setup

The official ATProto lexicons are included as a git submodule located at `../vendor/atproto`. This allows us to:

1. Stay up-to-date with the latest ATProto lexicon definitions
2. Avoid duplicating large amounts of lexicon files in our repository
3. Maintain our custom lexicons alongside the official ones

### Initial Setup

If you're cloning this repository for the first time, you'll need to initialize the submodules:

```bash
git submodule update --init --recursive
```

### Updating ATProto Lexicons

To update to the latest ATProto lexicons:

```bash
cd vendor/atproto
git pull origin main
cd ../..
git add vendor/atproto
git commit -m "Update atproto lexicons to latest"
```

### Adding Custom Lexicons

Custom lexicons should be added to the `fm.teal.alpha/` directory following the ATProto lexicon schema format. These files are tracked directly in our repository and not affected by submodule updates.

## Generated Files

This directory may contain generated files (`.js`, `.d.ts`, etc.) that are created by lexicon compilation tools. These are ignored by git as specified in the `.gitignore` file.