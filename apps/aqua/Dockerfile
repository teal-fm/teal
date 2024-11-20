# Use the official Bun image as base
FROM oven/bun:1.0 AS builder

# Set working directory
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lockb ./

# Copy turbo.json
COPY turbo.json ./

# Copy workspace packages
COPY packages/db/ ./packages/db/
COPY packages/lexicons/ ./packages/lexicons/
COPY packages/tsconfig/ ./packages/tsconfig/

# Copy the aqua app
COPY apps/aqua/ ./apps/aqua/

# Install dependencies
RUN bun install

# Build workspace packages (if needed)
RUN bun run build --filter=@teal/db
RUN bun run build --filter=@teal/lexicons

# Build the aqua app
WORKDIR /app/apps/aqua
RUN bun run build

# Start production image (node lts ideally)
FROM node:bookworm-slim

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/apps/aqua/dist ./dist
# copy base node modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/aqua/node_modules ./node_modules
COPY --from=builder /app/apps/aqua/package.json ./

# move public to cwd
RUN mv ./dist/public ./public

# Set environment variables
ENV NODE_ENV=production

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
