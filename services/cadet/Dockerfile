# Docker build args for cross-platform builds (must be at the top)
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH
ARG TARGETOS

FROM --platform=${BUILDPLATFORM} rust:latest AS buildah

# Create appuser
ENV USER=app
ENV UID=10001

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"

WORKDIR /buildah

# Re-declare ARGs after FROM (Docker requirement)
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH
ARG TARGETOS

# Debug platform detection before copying files
RUN echo "DEBUG Before copy: TARGETPLATFORM=$TARGETPLATFORM TARGETARCH=$TARGETARCH BUILDPLATFORM=$BUILDPLATFORM"

COPY ./ .

# Setup lexicons and install dependencies
RUN ./scripts/setup-lexicons.sh

# Rust lexicon bindings are generated before commits and checked in under
# services/types/src. Keep Docker builds focused on compiling the service.

# Install cross-compilation toolchains
RUN rustup target add x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu

# Enable ARM64 architecture and install cross-compilation tools
RUN dpkg --add-architecture arm64 && \
    apt-get update && \
    apt-get install -y \
    gcc-aarch64-linux-gnu \
    libssl-dev:arm64 \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set up cross-compilation environment
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc
ENV PKG_CONFIG_ALLOW_CROSS=1
ENV PKG_CONFIG_PATH_aarch64_unknown_linux_gnu=/usr/lib/aarch64-linux-gnu/pkgconfig
ENV OPENSSL_DIR_aarch64_unknown_linux_gnu=/usr
ENV OPENSSL_LIB_DIR_aarch64_unknown_linux_gnu=/usr/lib/aarch64-linux-gnu
ENV OPENSSL_INCLUDE_DIR_aarch64_unknown_linux_gnu=/usr/include/openssl

# Force SQLx to use offline mode with workspace cache
ENV SQLX_OFFLINE=true

# Debug platform detection and run build
RUN echo "DEBUG Before target.sh: TARGETPLATFORM=$TARGETPLATFORM TARGETARCH=$TARGETARCH" && \
    . ./target.sh && \
    touch services/cadet/src/main.rs && \
    echo "Building for $TARGET_ARCH" && \
    cargo build --release --target $RUST_TARGET --package cadet && \
    cp target/$RUST_TARGET/release/cadet target/cadet

# Stage a state directory owned by the runtime user so the cursor file mount
# point is writable when Docker copies it onto the named volume.
RUN mkdir -p /buildah/runtime-state/var/lib/cadet && \
    chown -R ${UID}:${UID} /buildah/runtime-state/var/lib/cadet

FROM --platform=${TARGETARCH:-$BUILDPLATFORM} gcr.io/distroless/cc

# Import from builder.
COPY --from=buildah /etc/passwd /etc/passwd
COPY --from=buildah /etc/group /etc/group
COPY --from=buildah --chown=10001:10001 /buildah/runtime-state/var/lib/cadet /var/lib/cadet

WORKDIR /app

# Copy our build
COPY --from=buildah /buildah/target/cadet ./

# Use an unprivileged user.
USER app:app

CMD ["/app/cadet"]
