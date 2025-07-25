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

COPY ./ .

RUN . ./target.sh && touch src/main.rs && echo "Building for $TARGET_ARCH" && cargo build --release --target $RUST_TARGET && cp target/$RUST_TARGET/release/cadet target/cadet

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
