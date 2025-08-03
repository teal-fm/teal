#!/bin/bash
# Taken from https://github.com/DataDog/sdlc-gitops-sample-stack/blob/main/apps/pass-image-api/scripts/target.sh
set -e

# Map TARGETPLATFORM to Rust target
case "$TARGETPLATFORM" in
    "linux/amd64")
        export RUST_TARGET="x86_64-unknown-linux-gnu"
        ;;
    "linux/arm64")
        export RUST_TARGET="aarch64-unknown-linux-gnu"
        ;;
    *)
        echo "Unsupported platform: $TARGETPLATFORM"
        exit 1
        ;;
esac
