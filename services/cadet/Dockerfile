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

# Install Node.js and pnpm for lexicon generation
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

# Install dependencies and generate lexicons
RUN pnpm install
RUN cd tools/lexicon-cli && pnpm build
RUN pnpm lex:gen

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

# copy sqlx in
COPY ./.sqlx ./services/cadet/.sqlx

# Debug platform detection and run build
RUN echo "DEBUG Before target.sh: TARGETPLATFORM=$TARGETPLATFORM TARGETARCH=$TARGETARCH" && \
    . ./target.sh && \
    touch services/cadet/src/main.rs && \
    echo "Building for $TARGET_ARCH" && \
    cargo build --release --target $RUST_TARGET --package cadet && \
    cp target/$RUST_TARGET/release/cadet target/cadet

FROM --platform=${TARGETARCH:-$BUILDPLATFORM} gcr.io/distroless/cc

# Import from builder.
COPY --from=buildah /etc/passwd /etc/passwd
COPY --from=buildah /etc/group /etc/group

WORKDIR /app

# Copy our build
COPY --from=buildah /buildah/target/cadet ./

# Use an unprivileged user.
USER app:app

CMD ["/app/cadet"]
