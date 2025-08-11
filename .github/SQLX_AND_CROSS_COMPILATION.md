# SQLx Offline and Cross-Compilation Setup

This document explains the configuration changes made to support SQLx offline builds and fix cross-compilation issues.

## Problems Solved

### 1. SQLx Offline Compilation
When `SQLX_OFFLINE=true`, each Rust project needs access to `.sqlx` query metadata files in their local directory. Previously, these files only existed at the workspace root, causing builds to fail outside Docker.

### 2. Cross-Compilation OpenSSL Issues  
Cross-compilation was failing due to OpenSSL dependencies being pulled in by various crates, which is notoriously difficult to cross-compile.

## Solutions Implemented

### SQLx Offline Setup

#### Script: `scripts/setup-sqlx-offline.sh`
- Automatically copies `.sqlx` files from workspace root to each SQLx-dependent project
- Identifies projects that use SQLx by checking `Cargo.toml` files
- Projects that receive `.sqlx` files:
  - `apps/aqua`
  - `services/cadet` 
  - `services/satellite`

#### CI Integration
The script is now called in all CI jobs that build Rust code:
- `setup-and-build` job
- `rust-cross-compile` job  
- `rust-quality` job
- `security-audit` job

### Cross-Compilation Fixes

#### 1. Replaced OpenSSL with rustls
Updated workspace dependencies to use rustls instead of OpenSSL:

```toml
# Root Cargo.toml
sqlx = { version = "0.8", features = [
    "runtime-tokio",
    "postgres", 
    "uuid",
    "tls-rustls",  # Instead of default OpenSSL
] }

reqwest = { version = "0.12", default-features = false, features = [
    "json",
    "rustls-tls",  # Instead of default native-tls
    "stream",
    "gzip",
] }

tokio-tungstenite = { version = "*", default-features = false, features = [
    "rustls-tls-webpki-roots",  # Instead of default native-tls
] }
```

#### 2. Fixed Workspace Dependency Conflicts
The `services/Cargo.toml` was overriding workspace dependencies with different configurations. Fixed by:
- Changing `reqwest = { version = "0.12", features = ["json"] }` to `reqwest.workspace = true`
- Changing `tokio-tungstenite = "0.24"` to `tokio-tungstenite.workspace = true`

#### 3. Enhanced Cross.toml Configuration
Created comprehensive `Cross.toml` files for cross-compilation:

```toml
[build.env]
passthrough = [
    "CARGO_HOME",
    "CARGO_TARGET_DIR", 
    "SQLX_OFFLINE",
    "PKG_CONFIG_ALLOW_CROSS",
]

[target.aarch64-unknown-linux-gnu]
image = "ghcr.io/cross-rs/aarch64-unknown-linux-gnu:main"

[target.aarch64-unknown-linux-gnu.env]
passthrough = ["CARGO_HOME", "CARGO_TARGET_DIR", "SQLX_OFFLINE"]
PKG_CONFIG_ALLOW_CROSS = "1"
RUSTFLAGS = "-C target-feature=+crt-static -C link-arg=-s"
CC_aarch64_unknown_linux_gnu = "aarch64-linux-gnu-gcc"
CXX_aarch64_unknown_linux_gnu = "aarch64-linux-gnu-g++"
```

#### 4. Improved CI Cross-Compilation
- Uses latest `cross` from Git: `cargo install cross --git https://github.com/cross-rs/cross`
- Sets `PKG_CONFIG_ALLOW_CROSS=1` environment variable
- Copies `.sqlx` files to individual service directories during cross-compilation
- Improved executable collection with better filtering

### Executable Collection

Enhanced executable collection in CI:
- Filters out build artifacts (`.d` files and temporary files with `-` in names)
- Handles missing target directories gracefully
- Collects executables for both x86_64 and aarch64 targets
- Provides clear logging of collected executables

## File Changes

### Created
- `scripts/setup-sqlx-offline.sh` - SQLx offline setup script
- `Cross.toml` - Root cross-compilation config
- `services/Cross.toml` - Services cross-compilation config  
- `apps/aqua/Cross.toml` - Aqua cross-compilation config

### Modified
- `Cargo.toml` - Updated workspace dependencies to use rustls
- `services/Cargo.toml` - Fixed workspace dependency usage
- `.github/workflows/ci.yml` - Added SQLx setup and improved cross-compilation

## Usage

### Running SQLx Setup Locally
```bash
./scripts/setup-sqlx-offline.sh
```

### Cross-Compilation Locally
```bash
# Install cross if not already installed
cargo install cross --git https://github.com/cross-rs/cross

# Add target
rustup target add aarch64-unknown-linux-gnu

# Set environment
export PKG_CONFIG_ALLOW_CROSS=1
export SQLX_OFFLINE=true

# Run SQLx setup
./scripts/setup-sqlx-offline.sh

# Cross-compile services
cd services
cross build --release --target aarch64-unknown-linux-gnu

# Cross-compile apps
cd ../apps/aqua  
cross build --release --target aarch64-unknown-linux-gnu
```

### Updating SQLx Queries
When you add or modify SQL queries:

1. Generate new query metadata from the services directory:
   ```bash
   cd services
   cargo sqlx prepare
   ```

2. Update all project copies:
   ```bash
   ./scripts/setup-sqlx-offline.sh
   ```

## Troubleshooting

### Cross-Compilation Still Fails
- Ensure you're using the latest `cross` from Git
- Check that `PKG_CONFIG_ALLOW_CROSS=1` is set
- Verify no dependencies are pulling in OpenSSL (use `cargo tree | grep openssl`)

### SQLx Offline Errors
- Run `./scripts/setup-sqlx-offline.sh` after any SQL query changes
- Ensure `.sqlx` directory exists in workspace root
- Check that `SQLX_OFFLINE=true` is set in CI environment

### Missing Executables
- Check that build succeeded without errors
- Verify executable names match expected service/app names
- Look for executables in `artifacts/` directory structure

## Dependencies Avoided
To maintain cross-compilation compatibility, avoid dependencies that:
- Default to OpenSSL (use rustls variants)
- Require system libraries not available in cross containers
- Have complex native build requirements

Always test cross-compilation locally before pushing changes.