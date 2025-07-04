FROM node:22-slim AS builder
ARG CLIENT_ADDRESS

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

# Copy .env
COPY ../../.env ./apps/amethyst/.env

# Build the aqua app
WORKDIR /app/apps/amethyst
RUN pnpm install
RUN pnpm run build:web

#create the client-json
RUN echo '{ \
            "redirect_uris": ["https://'"${CLIENT_ADDRESS}"'/auth/callback"], \
            "response_types": ["code"], \
            "grant_types": ["authorization_code", "refresh_token"], \
            "scope": "atproto transition:generic", \
            "token_endpoint_auth_method": "none", \
            "application_type": "web", \
            "client_id": "https://'"${CLIENT_ADDRESS}"'/client-metadata.json", \
            "client_name": "teal", \
            "client_uri": "https://'"${CLIENT_ADDRESS}"'", \
            "dpop_bound_access_tokens": true \
          }' > /app/client-metadata.json


FROM caddy:2.1.0-alpine AS caddy
EXPOSE 80
EXPOSE 443
EXPOSE 443/udp
COPY /apps/amethyst/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/amethyst/build /srv
COPY --from=builder /app/client-metadata.json /srv/client-metadata.json