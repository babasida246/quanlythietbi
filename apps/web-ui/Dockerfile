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
COPY apps/web-ui/package.json apps/web-ui/package.json
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
# Build web-ui specifically
RUN pnpm --filter @qltb/web-ui build

# ----- runtime -----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Copy built application
COPY --from=build /repo/apps/web-ui/build ./build
COPY --from=build /repo/apps/web-ui/package.json ./package.json
# Copy runtime dependencies 
COPY --from=build /repo/node_modules ./node_modules
# Copy built workspace packages that web-ui needs at runtime
COPY --from=build /repo/packages ./packages

EXPOSE 3001
CMD ["node", "build"]