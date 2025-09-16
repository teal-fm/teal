# Teal CLI

A comprehensive management tool for Teal AT Protocol services, featuring cryptographic key management and CAR (Content Addressable aRchive) file exploration.

## Installation

From the project root:

```bash
cargo build --release --bin teal
```

The binary will be available at `target/release/teal`.

## Usage

### CAR File Explorer

Explore and analyze CAR files containing AT Protocol and Teal records.

#### Fetch CAR file from the internet

```bash
# Fetch from AT Protocol handle
teal car fetch --identity alice.bsky.social

# Fetch from DID
teal car fetch --identity did:plc:vdjlpwlhbnug4fnjodwr3vzh

# Fetch and save to specific file
teal car fetch --identity mmatt.net --output mmatt.car

# Fetch and immediately explore
teal car fetch --identity mmatt.net --explore
```

#### Explore a CAR file

```bash
# Basic exploration
teal car explore --file path/to/archive.car

# Verbose output with detailed information
teal car explore --file path/to/archive.car --verbose
```

#### Search for specific content

```bash
# Search for records containing "play"
teal car search --file path/to/archive.car --query "play"

# Search with verbose JSON output
teal car search --file path/to/archive.car --query "queen" --verbose
```

#### Export Teal records to JSON

```bash
# Export to default directory (./teal_exports)
teal car export --file path/to/archive.car

# Export to custom directory
teal car export --file path/to/archive.car --output ./my_exports
```

### Generate a new K256 key pair

```bash
# Generate with default settings (saves to ~/.teal/keys/)
teal gen-key

# Generate with custom name
teal gen-key --name production

# Generate with custom output directory
teal gen-key --output ./keys

# Overwrite existing keys
teal gen-key --force

# Output only the multibase (useful for scripts)
teal gen-key --format multibase

# Output as JSON
teal gen-key --format json
```

### Extract public key from existing private key

```bash
# Extract as multibase (default)
teal extract-pubkey --private-key ./keys/repo.key

# Extract as hex
teal extract-pubkey --private-key ./keys/repo.key --format hex

# Extract as JSON with both formats
teal extract-pubkey --private-key ./keys/repo.key --format json
```

### List available keys

```bash
# List keys in default directory
teal list

# List keys in custom directory
teal list --directory ./keys
```

### Rotate keys (backup old, generate new)

```bash
# Rotate the default 'repo' key
teal rotate --name repo

# Rotate with custom backup directory
teal rotate --name repo --backup-dir ./backups
```

## CAR File Analysis

The CAR explorer can analyze AT Protocol archives and identify:

- **Teal Records**: Music plays (`fm.teal.alpha.feed.play`), profiles (`fm.teal.alpha.actor.profile`), and status updates
- **AT Protocol Records**: BlueSky posts, likes, follows, and other social data
- **Commit Operations**: Repository changes and metadata
- **IPLD Structure**: Content addressing and linking

### Example Output

```
📊 CAR Analysis Results
==================================================

📁 File Overview:
   File size: 10267026 bytes
   Total blocks: 30195
   Root CIDs: 1

📋 Record Types:
   app.bsky.feed.like: 11034
   app.bsky.feed.post: 7510  
   fm.teal.alpha.feed.play: 2605
   fm.teal.alpha.actor.profile: 1

🎵 Teal Records Found:
   fm.teal.alpha.feed.play: 2605
   fm.teal.alpha.actor.profile: 1

🔍 Sample Teal Records:
   1. fm.teal.alpha.feed.play (bafyreigmu...)
      🎵 Track: Bohemian Rhapsody
      🎤 Artists: Queen
      ⏱️  Duration: 355000ms
```

### Exported JSON Structure

```json
[
  {
    "cid": "bafyreigmuwliezhxczoxgxq5hjtsdzaj3jl54kg...",
    "data": {
      "$type": "fm.teal.alpha.feed.play",
      "track_name": "Bohemian Rhapsody",
      "artist_names": ["Queen"],
      "duration": 355000,
      "played_time": "2024-01-15T14:30:00Z"
    }
  }
]
```

## Key Management

The tool generates K256 (secp256k1) keys compatible with AT Protocol:

- **Private Key**: 32-byte secp256k1 private key stored as binary
- **Public Key**: Base58-encoded multibase of the compressed public key
- **Default Location**: `~/.teal/keys/`

### File Structure

```
~/.teal/keys/
├── repo.key         # Private key (32 bytes, binary)
├── repo.pub         # Public key multibase (text)
├── production.key   # Another private key
└── production.pub   # Another public key multibase
```

## Integration

Replace the hardcoded multibase in your DID document:

```rust
// Before (hardcoded)
"publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"

// After (using generated key)
let pubkey = std::fs::read_to_string("~/.teal/keys/repo.pub")?;
// Use pubkey in your DID document
```

## Examples

### CAR File Analysis

```bash
# Fetch CAR file from a user's handle
teal car fetch --identity mmatt.net --output mmatt.car

# Fetch and immediately explore
teal car fetch --identity alice.bsky.social --explore

# Analyze a local CAR export
teal car explore --file nat.car

# Search for specific tracks
teal car search --file nat.car --query "bohemian rhapsody"

# Export all Teal records for data analysis
teal car export --file nat.car --output ./music_data

# View exported play records
cat ./music_data/fm_teal_alpha_feed_play.json | jq '.[0]'
```

### Quick setup

```bash
# Generate a key for development
teal gen-key --name dev

# Get the multibase for your DID document
teal extract-pubkey --private-key ~/.teal/keys/dev.key
```

### Production deployment

```bash
# Generate production keys in a secure location
teal gen-key --name production --output /secure/keys

# Extract multibase for configuration
PUBKEY=$(teal extract-pubkey --private-key /secure/keys/production.key)
echo "Public key: $PUBKEY"
```

## Security Notes

- Private keys are stored as raw 32-byte files with restrictive permissions (600 on Unix)
- Keys are generated using cryptographically secure random number generation
- Never commit private keys to version control
- Consider using secure key management systems in production