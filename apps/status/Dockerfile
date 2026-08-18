ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH
ARG TARGETOS

FROM rust:latest AS build

WORKDIR /build
COPY ./ ./

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.0
RUN pnpm install --ignore-scripts
RUN cd tools/lexicon-cli && pnpm build
RUN pnpm lex:gen --rust-only

ENV SQLX_OFFLINE=true
RUN cargo build --release --package status-api

FROM gcr.io/distroless/cc
WORKDIR /app
COPY --from=build /build/target/release/status-api ./status-api
USER 10001:10001
CMD ["/app/status-api"]
