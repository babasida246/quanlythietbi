# Architecture

## Monorepo Structure

QLTB dung pnpm workspace voi 2 nhom chinh:

- `apps/*`: runtime applications
- `packages/*`: shared domain/application/infrastructure libraries

Cau truc chinh:

- `apps/api`: Fastify backend
- `apps/web-ui`: SvelteKit frontend
- `packages/contracts`: DTOs/interfaces shared
- `packages/domain`: entities/value objects
- `packages/application`: use-cases/services
- `packages/infra-postgres`: Postgres repositories + schema/migrations
- `db`: app-level migrations + seed files
- `scripts`: db and deployment scripts
- `tests`: Playwright E2E + fixtures

## Layer Dependency Direction

Huong phu thuoc theo thiet ke hien tai:

1. `domain`
2. `contracts` (can import from domain)
3. `infra-postgres` (depends on contracts/domain)
4. `application` (depends on contracts/domain/infra abstractions)
5. `apps/api` (compose routes + services + repos)
6. `apps/web-ui` (consume API)

## Backend Runtime Flow

1. API boot tu [../apps/api/src/main.ts](../apps/api/src/main.ts)
2. Env validate tai [../apps/api/src/config/env.ts](../apps/api/src/config/env.ts)
3. Fastify app setup tai [../apps/api/src/core/app.ts](../apps/api/src/core/app.ts)
4. Modules register qua assets module + route contexts
5. Requests /api/v1/* qua auth hook tru /api/v1/auth/*

## Frontend Runtime Flow

1. Root layout tai [../apps/web-ui/src/routes/+layout.svelte](../apps/web-ui/src/routes/+layout.svelte)
2. Sidebar shell cho main routes, shell-less cho login/setup
3. HTTP calls di qua [../apps/web-ui/src/lib/api/httpClient.ts](../apps/web-ui/src/lib/api/httpClient.ts)
4. JWT refresh singleton tren 401
5. i18n load split files qua [../apps/web-ui/src/lib/i18n/index.ts](../apps/web-ui/src/lib/i18n/index.ts)

## Build Artifacts

- API: `apps/api/dist/main.js`
- Web: `apps/web-ui/build/`

Build commands tham chieu tu [../package.json](../package.json).
