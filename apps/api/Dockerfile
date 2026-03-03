FROM node:20-bookworm-slim AS base
WORKDIR /repo
ENV CI=true
RUN corepack enable

# ----- deps (cache layer) -----
FROM base AS deps
# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy npmrc for workspace resolution
COPY .npmrc ./.npmrc
# Copy package manifests for optimal caching
COPY apps/api/package.json apps/api/package.json
COPY packages/ packages/

# Install dependencies with workspace resolution
RUN pnpm install --frozen-lockfile

# ----- build -----
FROM deps AS build
# Copy full source code
COPY . .
# Clean any existing build artifacts that might cause conflicts
RUN find packages -name dist -type d -exec rm -rf {} + || true
RUN find packages -name "*.tsbuildinfo" -type f -delete || true
# Build using TypeScript composite project build from root
RUN npx tsc --build tsconfig.json

# ----- runtime -----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Copy workspace files to maintain pnpm workspace resolution
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml 
COPY --from=build /repo/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy API app
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

# Copy runtime dependencies 
COPY --from=build /repo/node_modules ./node_modules
# Copy built workspace packages with their package.json and dist
COPY --from=build /repo/packages ./packages

# Copy DB migrations and docker scripts for runtime migration support
COPY --from=build /repo/db ./db
COPY --from=build /repo/docker/scripts ./docker/scripts

# Create symlinks in node_modules for workspace packages
RUN mkdir -p node_modules/@qltb && \
    ln -sf /app/packages/application node_modules/@qltb/application && \
    ln -sf /app/packages/contracts node_modules/@qltb/contracts && \
    ln -sf /app/packages/domain node_modules/@qltb/domain && \
    ln -sf /app/packages/infra-postgres node_modules/@qltb/infra-postgres

# Install psql for running migrations
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
