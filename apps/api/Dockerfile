FROM node:20-bookworm-slim AS base
WORKDIR /repo
ENV CI=true
RUN corepack enable

# ── deps (cache layer) ──────────────────────────────────────────────────────
# Only copy package manifests first to maximise Docker layer cache hits.
# The full source COPY happens in the build stage.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches/ patches/
COPY apps/api/package.json                     apps/api/package.json
COPY packages/domain/package.json              packages/domain/package.json
COPY packages/contracts/package.json           packages/contracts/package.json
COPY packages/application/package.json         packages/application/package.json
COPY packages/infra-postgres/package.json      packages/infra-postgres/package.json
RUN pnpm install --frozen-lockfile

# ── build ───────────────────────────────────────────────────────────────────
# tsup (noExternal) bundles all @qltb/* workspace packages INTO dist/main.js.
# Runtime image will NOT need workspace package dists at all.
FROM deps AS build
COPY . .

# Build workspace packages in dependency order so tsup can resolve imports.
# tsc produces dist/ for each package; tsup reads those as input.
RUN pnpm --filter @qltb/domain build \
    && pnpm --filter @qltb/contracts build \
    && pnpm --filter @qltb/infra-postgres build \
    && pnpm --filter @qltb/application build \
    && pnpm --filter @qltb/api build

# Generate a stripped package.json for the runtime image:
# removes workspace:* deps (already bundled by tsup) and devDependencies.
RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('apps/api/package.json','utf8'));const d=pkg.dependencies||{};Object.keys(d).forEach(k=>{if(d[k].startsWith('workspace:'))delete d[k]});delete pkg.devDependencies;fs.writeFileSync('apps/api/package.runtime.json',JSON.stringify(pkg,null,2))"

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Install ONLY external runtime deps (pg, fastify, redis, bull, etc.).
# Workspace packages (@qltb/*) are NOT listed here — tsup bundled them.
COPY --from=build /repo/apps/api/package.runtime.json ./package.json
RUN pnpm install --prod

# The single bundled entry point — contains all workspace code inlined.
# No need to copy packages/*/dist — everything is already here.
COPY --from=build /repo/apps/api/dist ./dist

# DB migrations needed by the entrypoint:
#   - packages/infra-postgres/src/schema.sql       (base schema)
#   - packages/infra-postgres/src/migrations/      (020–042)
#   - db/migrations/                               (007–057 + dated patches)
COPY --from=build /repo/packages/infra-postgres/src/schema.sql      ./packages/infra-postgres/src/schema.sql
COPY --from=build /repo/packages/infra-postgres/src/migrations      ./packages/infra-postgres/src/migrations
COPY --from=build /repo/db       ./db
COPY --from=build /repo/scripts  ./scripts
COPY --from=build /repo/docker/scripts ./docker/scripts
RUN chmod +x /app/docker/scripts/api-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/docker/scripts/api-entrypoint.sh"]
