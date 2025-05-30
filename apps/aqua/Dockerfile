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
COPY apps/aqua/ ./apps/aqua/

# Build the aqua app
WORKDIR /app/apps/aqua
RUN pnpm install
RUN pnpm run build

# Start production image (node lts ideally)
FROM node:bookworm-slim

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/apps/aqua/dist ./dist
# copy base node modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/aqua/node_modules ./node_modules
COPY --from=builder /app/apps/aqua/package.json ./

# install pino-pretty for logs
RUN npm install -g pino-pretty@13.0.0

# move public to cwd
RUN mv ./dist/public ./public

# Set environment variables
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.cjs", "|", "pino-pretty"]
