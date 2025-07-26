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

If you're cloning this repository for the first time, you'll need to initialize the submodules and create the symbolic links:

```bash
# Initialize submodules
git submodule update --init --recursive

# Create symbolic links to atproto lexicons
cd lexicons
ln -s ../vendor/atproto/lexicons/app app
ln -s ../vendor/atproto/lexicons/chat chat
ln -s ../vendor/atproto/lexicons/com com
ln -s ../vendor/atproto/lexicons/tools tools
cd ..
```

Or use the provided setup script:

```bash
./scripts/setup-lexicons.sh
```

### Updating ATProto Lexicons

To update to the latest ATProto lexicons, use the provided update script:

```bash
./scripts/update-lexicons.sh
```

This will:
1. Fetch the latest changes from the atproto repository
2. Show you what changed
3. Stage the submodule update for commit

Then commit the changes:
```bash
git commit -m "Update atproto lexicons to latest"
```

**Manual approach:**
```bash
cd vendor/atproto
git pull origin main
cd ../..
git add vendor/atproto
git commit -m "Update atproto lexicons to latest"
```

### Available Scripts

Two convenience scripts are available:

**Setup Script** - Handle the initial setup:

```bash
#!/bin/bash
# scripts/setup-lexicons.sh

echo "Setting up lexicons..."

# Initialize submodules
git submodule update --init --recursive

# Create symbolic links if they don't exist
cd lexicons
if [ ! -L app ]; then
    ln -s ../vendor/atproto/lexicons/app app
    echo "Created symlink: lexicons/app"
fi
if [ ! -L chat ]; then
    ln -s ../vendor/atproto/lexicons/chat chat
    echo "Created symlink: lexicons/chat"
fi
if [ ! -L com ]; then
    ln -s ../vendor/atproto/lexicons/com com
    echo "Created symlink: lexicons/com"
fi
if [ ! -L tools ]; then
    ln -s ../vendor/atproto/lexicons/tools tools
    echo "Created symlink: lexicons/tools"
fi
cd ..

echo "Lexicons setup complete!"
```

**Update Script** - Update ATProto lexicons:

```bash
#!/bin/bash
# scripts/update-lexicons.sh

# Fetches latest changes from atproto repository
# Shows what changed and stages the update for commit
./scripts/update-lexicons.sh
```

### Adding Custom Lexicons

Custom lexicons should be added to the `fm.teal.alpha/` directory following the ATProto lexicon schema format. These files are tracked directly in our repository and not affected by submodule updates.

**Note**: The symbolic links (`app`, `chat`, `com`, `tools`) are not tracked in git and will be created during setup. They are ignored in `.gitignore` to avoid conflicts.
