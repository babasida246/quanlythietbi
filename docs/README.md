# QLTB Documentation

Tai lieu nay duoc viet lai tu code hien tai (apps, packages, scripts, config), khong dua tren docs cu.

## Doc Index

- [architecture.md](architecture.md): Tong quan monorepo, layers, data flow.
- [backend-api.md](backend-api.md): Fastify app, auth flow, response format, route groups.
- [frontend.md](frontend.md): SvelteKit shell, auth client, i18n split files, theme.
- [database.md](database.md): Migration order, seed order, DB scripts.
- [deployment.md](deployment.md): Build va deploy modes (docker/non-docker).
- [testing.md](testing.md): Playwright + Vitest strategy va commands.

## Source Of Truth

Khi co xung dot giua docs va code, code la source of truth. Cac file tham chieu chinh:

- Root scripts: [../package.json](../package.json)
- API env parser: [../apps/api/src/config/env.ts](../apps/api/src/config/env.ts)
- Migrations script: [../scripts/db-migrate.mjs](../scripts/db-migrate.mjs)
- Seeds script: [../scripts/db-seed.mjs](../scripts/db-seed.mjs)
- E2E config: [../playwright.config.ts](../playwright.config.ts)

## Quick Start

```bash
pnpm install
pnpm dev:infra
pnpm dev:all
```

## Production Build

```bash
pnpm build
# or
pnpm build:prod
```

## Database Reset

```bash
pnpm db:reset
```
