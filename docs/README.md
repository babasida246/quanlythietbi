# QLTB Documentation

Tài liệu kỹ thuật hệ thống Quản Lý Thiết Bị.

## Danh mục tài liệu

| File | Nội dung |
| --- | --- |
| [architecture.md](architecture.md) | Kiến trúc clean architecture, data flow, ports |
| [backend-api.md](backend-api.md) | Fastify setup, auth, response format, route patterns |
| [frontend.md](frontend.md) | Svelte 5 runes, i18n, CSS tokens, RBAC client-side |
| [database.md](database.md) | Migration order, seed order, UUID patterns |
| [testing.md](testing.md) | Playwright + Vitest strategy, test patterns |
| [deployment.md](deployment.md) | Docker, HTTPS, deploy scripts |
| [project-map.md](project-map.md) | Map đầy đủ tất cả modules, packages, dependency rules |

## Source of truth

Khi có xung đột giữa docs và code, code là source of truth:

- Root scripts: [../package.json](../package.json)
- API env parser: [../apps/api/src/config/env.ts](../apps/api/src/config/env.ts)
- Migration list: [../scripts/db-migrate.mjs](../scripts/db-migrate.mjs)
- Seed list: [../scripts/db-seed.mjs](../scripts/db-seed.mjs)
- E2E config: [../playwright.config.ts](../playwright.config.ts)

## Quick reference

```bash
# Khởi động dev
pnpm dev:infra && pnpm db:reset && pnpm dev:all

# Build production
pnpm build:prod

# Reset database
pnpm db:reset

# Kiểm tra dependency rules
pnpm deps:check
```
