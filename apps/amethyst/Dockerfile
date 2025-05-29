FROM node:22-slim AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# Set working directory
WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy turbo.json
COPY turbo.json ./

# Copy workspace packages
COPY packages/db/ ./packages/db/
COPY packages/lexicons/ ./packages/lexicons/
COPY packages/tsconfig/ ./packages/tsconfig/

# Copy the aqua app
COPY apps/amethyst/ ./apps/amethyst/

# Build the aqua app
WORKDIR /app/apps/amethyst
RUN pnpm install
RUN pnpm run build:web

FROM caddy:2.1.0-alpine AS caddy
EXPOSE 80
EXPOSE 443
EXPOSE 443/udp
COPY /apps/amethyst/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/amethyst/build /srv