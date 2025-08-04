#!/bin/bash
set -e

# Debug: Print all available build variables
echo "DEBUG: TARGETPLATFORM=$TARGETPLATFORM"
echo "DEBUG: BUILDPLATFORM=$BUILDPLATFORM"
echo "DEBUG: TARGETARCH=$TARGETARCH"
echo "DEBUG: TARGETOS=$TARGETOS"

# Use TARGETARCH directly (more reliable than TARGETPLATFORM)
TARGET_ARCH_VAR="${TARGETARCH:-}"

# If TARGETARCH is not set, try to extract from TARGETPLATFORM
if [ -z "$TARGET_ARCH_VAR" ] && [ -n "$TARGETPLATFORM" ]; then
    TARGET_ARCH_VAR=$(echo "$TARGETPLATFORM" | cut -d'/' -f2)
    echo "DEBUG: Extracted TARGET_ARCH_VAR=$TARGET_ARCH_VAR from TARGETPLATFORM"
fi

# Final fallback: detect from uname
if [ -z "$TARGET_ARCH_VAR" ]; then
    ARCH=$(uname -m)
    case "$ARCH" in
        "x86_64")
            TARGET_ARCH_VAR="amd64"
            ;;
        "aarch64")
            TARGET_ARCH_VAR="arm64"
            ;;
        *)
            echo "ERROR: Could not detect target architecture. uname -m returned: $ARCH"
            echo "Available variables: TARGETARCH=$TARGETARCH, TARGETPLATFORM=$TARGETPLATFORM"
            exit 1
            ;;
    esac
    echo "DEBUG: Detected TARGET_ARCH_VAR=$TARGET_ARCH_VAR from uname"
fi

# Map architecture to Rust target
case "$TARGET_ARCH_VAR" in
    "amd64")
        export RUST_TARGET="x86_64-unknown-linux-gnu"
        export TARGET_ARCH="amd64"
        ;;
    "arm64")
        export RUST_TARGET="aarch64-unknown-linux-gnu"
        export TARGET_ARCH="arm64"
        ;;
    *)
        echo "ERROR: Unsupported target architecture: $TARGET_ARCH_VAR"
        echo "Supported architectures: amd64, arm64"
        exit 1
        ;;
esac

echo "SUCCESS: Using RUST_TARGET=$RUST_TARGET, TARGET_ARCH=$TARGET_ARCH"
