FROM node:22-slim AS builder

ARG CLIENT_ADDRESS=localhost
ARG EXPO_PUBLIC_BASE_URL
ARG EXPO_PUBLIC_AQUA_URL=http://localhost:3000
ARG EXPO_PUBLIC_DID_WEB

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV EXPO_PUBLIC_BASE_URL=${EXPO_PUBLIC_BASE_URL}
ENV EXPO_PUBLIC_AQUA_URL=${EXPO_PUBLIC_AQUA_URL}
ENV EXPO_PUBLIC_DID_WEB=${EXPO_PUBLIC_DID_WEB}

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY tools ./tools
COPY lexicons ./lexicons
COPY apps/amethyst ./apps/amethyst

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild esbuild unrs-resolver
RUN pnpm lex:gen-server

WORKDIR /app/apps/amethyst
RUN pnpm run build:web

RUN node -e 'const fs=require("fs"); const host=process.env.CLIENT_ADDRESS || "'"${CLIENT_ADDRESS}"'"; const base=host.startsWith("http") ? host : `https://${host}`; const metadata={redirect_uris:[`${base}/auth/callback`],response_types:["code"],grant_types:["authorization_code","refresh_token"],scope:"atproto transition:generic",token_endpoint_auth_method:"none",application_type:"web",client_id:`${base}/client-metadata.json`,client_name:"teal",client_uri:base,dpop_bound_access_tokens:true}; fs.writeFileSync("/app/client-metadata.json", JSON.stringify(metadata, null, 2));'

FROM caddy:2.8-alpine

ARG CLIENT_ADDRESS=:80
ENV CLIENT_ADDRESS=${CLIENT_ADDRESS}

EXPOSE 80
EXPOSE 443
EXPOSE 443/udp

COPY apps/amethyst/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/amethyst/build /srv
COPY --from=builder /app/client-metadata.json /srv/client-metadata.json
