# The Teal web app: TanStack Start, server-rendered by Node.
# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:22-slim AS builder

ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/lexicons/package.json ./packages/lexicons/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY tools/lexicon-cli/package.json ./tools/lexicon-cli/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@teal/web..." --filter "@teal/lexicons..."

COPY packages ./packages
COPY lexicons ./lexicons
COPY vendor/atproto/lexicons/app/bsky/richtext/facet.json ./vendor/atproto/lexicons/app/bsky/richtext/facet.json
COPY vendor/atproto/lexicons/com/atproto/repo/strongRef.json ./vendor/atproto/lexicons/com/atproto/repo/strongRef.json
COPY apps/web ./apps/web

RUN pnpm rebuild esbuild
RUN pnpm --filter=@teal/lexicons lex:gen
RUN pnpm --filter=@teal/web build

# Nitro bundles the server and its dependencies into .output, so the runtime
# image needs nothing else from the workspace.
FROM node:22-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app
COPY --from=builder /app/apps/web/.output ./.output

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
