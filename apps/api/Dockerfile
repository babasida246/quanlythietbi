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

# Copy workspace manifests để pnpm có thể resolve dependencies
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /repo/.npmrc ./.npmrc

# Copy app & packages manifests
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/packages/application/package.json ./packages/application/package.json
COPY --from=build /repo/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /repo/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /repo/packages/infra-postgres/package.json ./packages/infra-postgres/package.json

# Install production deps only (bỏ devDependencies, giảm image size đáng kể)
RUN pnpm install --frozen-lockfile --prod

# Copy compiled code
COPY --from=build /repo/apps/api/dist ./apps/api/dist
# Copy built workspace packages (includes dist compiled by tsc)
COPY --from=build /repo/packages ./packages

# Copy DB migrations, scripts, docker scripts
COPY --from=build /repo/db ./db
COPY --from=build /repo/scripts ./scripts
COPY --from=build /repo/docker/scripts ./docker/scripts

# Make entrypoint executable
RUN chmod +x /app/docker/scripts/api-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/docker/scripts/api-entrypoint.sh"]
