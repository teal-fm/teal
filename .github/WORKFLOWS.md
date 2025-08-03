# GitHub Actions Workflows Documentation

This document describes the CI/CD workflows configured for the Teal project.

## Overview

The project uses GitHub Actions for continuous integration, deployment, and security scanning. The workflows are designed to handle a polyglot codebase with Rust services, Node.js packages, and a React Native application.

## Workflows

### 🔧 CI (`ci.yml`)

**Triggers:** Push/PR to `main` or `develop` branches

**Purpose:** Primary continuous integration workflow that runs tests, linting, and type checking.

**Jobs:**
- **rust-check**: Formats, lints (clippy), and tests all Rust code in both `services/` and `apps/`
- **node-check**: Type checking, linting, building, and testing Node.js packages
- **lexicon-check**: Validates lexicon files and ensures generated code is up to date

**Key Features:**
- Caches Rust and Node.js dependencies for faster builds
- Runs in parallel for optimal performance
- Fails fast if any check fails

### 🚀 Aqua (`aqua.yml`)

**Triggers:** Push/PR to `main` with changes to `apps/aqua/**`

**Purpose:** Builds and pushes the Aqua Rust application Docker image.

**Features:**
- Multi-platform builds (linux/amd64, linux/arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Only pushes on main branch (not PRs)
- Uses GitHub Actions cache for Docker layers

### 🤖 Cadet (`cadet.yml`)

**Triggers:** Push/PR to `main` with changes to `services/cadet/**`

**Purpose:** Builds and pushes the Cadet Rust service Docker image.

**Features:**
- Multi-platform builds (linux/amd64, linux/arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Only pushes on main branch (not PRs)
- Uses GitHub Actions cache for Docker layers

### 🔮 Amethyst (`amethyst.yml`)

**Triggers:** Push/PR to `main` with changes to `apps/amethyst/**`

**Purpose:** Builds the React Native/Expo application for different platforms.

**Jobs:**
- **build-web**: Builds web version and uploads artifacts
- **build-ios**: Builds iOS version (only on main branch pushes, requires macOS runner)
- **lint-and-test**: Type checking and testing

**Features:**
- Generates lexicons before building
- Platform-specific builds
- Artifact uploads for build assets

### 🛠️ Services (`services.yml`)

**Triggers:** Push/PR to `main` with changes to `services/**`

**Purpose:** Dynamically detects and builds all services with Dockerfiles.

**Jobs:**
- **detect-services**: Scans for services with Dockerfiles
- **build-service**: Matrix build for each detected service
- **test-services**: Runs tests for all services

**Features:**
- Dynamic service detection
- Skips special directories (target, migrations, types, .sqlx)
- Per-service Docker caching
- Multi-platform builds

### 🎉 Release (`release.yml`)

**Triggers:** 
- Push to tags matching `v*`
- Manual workflow dispatch

**Purpose:** Creates GitHub releases and builds production Docker images.

**Jobs:**
- **create-release**: Creates GitHub release with changelog
- **build-and-release-aqua**: Builds and tags Aqua for release
- **build-and-release-cadet**: Builds and tags Cadet for release
- **release-other-services**: Builds other services (rocketman, satellite)
- **build-and-release-amethyst**: Builds Amethyst and uploads to release

**Features:**
- Automatic changelog extraction
- Production Docker tags (latest + version)
- Release artifact uploads
- Support for pre-releases (tags with `-`)

### 🔒 Security (`security.yml`)

**Triggers:** 
- Push/PR to `main` or `develop`
- Daily at 2 AM UTC
- Manual dispatch

**Purpose:** Comprehensive security scanning and vulnerability detection.

**Jobs:**
- **rust-security-audit**: Uses `cargo audit` for Rust dependencies
- **node-security-audit**: Uses `pnpm audit` for Node.js dependencies
- **codeql-analysis**: GitHub's semantic code analysis
- **docker-security-scan**: Trivy vulnerability scanning for Docker images
- **secrets-scan**: TruffleHog for secrets detection

**Features:**
- Fails on high/critical vulnerabilities
- SARIF upload for security tab integration
- Historical scanning with git history

## Configuration Files

### Dependabot (`dependabot.yml`)

Automated dependency updates for:
- **npm**: Weekly updates for Node.js dependencies
- **cargo**: Weekly updates for Rust dependencies (services + apps)
- **github-actions**: Weekly updates for workflow actions
- **docker**: Weekly updates for Docker base images

**Schedule:** Monday-Tuesday mornings, staggered to avoid conflicts

## Container Registry

All Docker images are pushed to GitHub Container Registry:
- `ghcr.io/[owner]/[repo]/aqua`
- `ghcr.io/[owner]/[repo]/cadet`
- `ghcr.io/[owner]/[repo]/[service-name]`

**Tags:**
- `latest`: Latest build from main branch
- `sha-[commit]`: Specific commit builds
- `v[version]`: Release builds
- `pr-[number]`: Pull request builds (for testing)

## Secrets and Permissions

**Required secrets:**
- `GITHUB_TOKEN`: Automatically provided (for registry access and releases)

**Permissions used:**
- `contents: read`: Read repository contents
- `packages: write`: Push to GitHub Container Registry
- `security-events: write`: Upload security scan results
- `actions: read`: Access workflow information

## Best Practices

1. **Path-based triggers**: Workflows only run when relevant files change
2. **Caching**: Aggressive caching for Rust, Node.js, and Docker layers
3. **Multi-platform**: Docker images built for amd64 and arm64
4. **Security-first**: Regular vulnerability scanning and secrets detection
5. **Fail-fast**: Early termination on critical issues
6. **Artifact preservation**: Build outputs stored for debugging/deployment

## Usage Examples

### Manual Release
```bash
# Tag and push for automatic release
git tag v1.0.0
git push origin v1.0.0

# Or use workflow dispatch in GitHub UI
```

### Local Development
```bash
# Run the same checks locally
pnpm rust:fmt
pnpm rust:clippy
pnpm typecheck
pnpm test
```

### Debugging Failed Builds
1. Check the Actions tab for detailed logs
2. Download artifacts from successful builds
3. Use the same commands locally with cached dependencies

## Maintenance

- **Weekly**: Review Dependabot PRs
- **Monthly**: Update action versions if not auto-updated
- **Quarterly**: Review and update security scanning tools
- **As needed**: Add new services to release workflow matrix