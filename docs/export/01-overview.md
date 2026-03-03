# 01 - Overview

## Muc luc
- [1. Tom tat he thong](#1-tom-tat-he-thong)
- [2. Pham vi module](#2-pham-vi-module)
- [3. Stack cong nghe](#3-stack-cong-nghe)
- [4. Cau truc thu muc chinh](#4-cau-truc-thu-muc-chinh)
- [5. Entrypoints quan trong](#5-entrypoints-quan-trong)
- [6. Config env va cach chay](#6-config-env-va-cach-chay)
- [7. Evidence](#7-evidence)

## 1. Tom tat he thong
He thong la monorepo quan ly thiet bi CNTT, gom API Fastify + giao dien SvelteKit + schema PostgreSQL va cac module nghiep vu tai san/CMDB/kho/phieu.

Pham vi nghiep vu chinh trong code hien tai:
- Quan ly tai san (assets, assignments, attachments, timeline su kien).
- Danh muc (category, model, vendor, location) + specs dong theo category.
- Kiem ke (inventory sessions/items).
- Yeu cau workflow (assign/return/move/repair/dispose).
- Kho vat tu sua chua (warehouse, spare parts, stock documents, stock ledger).
- Bao tri (maintenance tickets).
- CMDB (CI types/versions/schema, CI, relationships, services, reports).
- Truyen thong noi bo (notifications, inbox).
- Setup wizard khoi tao DB + seed + admin + finalize.
- QLTS bo sung (purchase plans, asset increases, approvals).

## 2. Pham vi module
Monorepo co 2 ung dung chinh:
- `apps/api`: backend REST API.
- `apps/web-ui`: frontend SvelteKit.

Va 4 package dung chung:
- `packages/domain`: domain rules/errors.
- `packages/contracts`: interfaces/types contracts.
- `packages/application`: business services.
- `packages/infra-postgres`: schema SQL, repositories, seeding.

## 3. Stack cong nghe
| Lop | Cong nghe |
|---|---|
| Frontend | Svelte 5, SvelteKit 2, Vite 5, TailwindCSS, Flowbite-Svelte |
| Backend | Node.js + TypeScript, Fastify 5, Zod, JWT |
| Data access | `pg` + repository pattern, SQL schema/migrations |
| Database | PostgreSQL |
| Cache/Queue | Redis co trong compose test; CMDB report co lop Redis cache/Bull queue |
| Test | Vitest (unit/integration), Playwright (E2E) |
| Dong goi | Docker Compose (main/assets/test), GitHub Actions CI |

Nhan xet quan trong:
- Khong thay ORM (Prisma/TypeORM/Sequelize/Drizzle/Knex) trong workspace; du an dang dung SQL + repository.

## 4. Cau truc thu muc chinh
```text
.
|- apps/
|  |- api/
|  |  |- src/
|  |     |- core/ (app, server, middleware, plugins)
|  |     |- routes/
|  |        |- setup/
|  |        |- v1/
|  |           |- auth/
|  |           |- assets/
|  |           |- inventory/
|  |           |- workflow/
|  |           |- warehouse/
|  |           |- maintenance/
|  |           |- reports/
|  |           |- communications/
|  |           |- cmdb/
|  |     |- modules/qlts/routes/
|  |- web-ui/
|     |- src/routes/ (pages/screens)
|     |- src/lib/api/ (HTTP client + API modules)
|     |- src/lib/cmdb/ (CMDB UI panels)
|- packages/
|  |- application/src/ (business services)
|  |- contracts/src/ (interfaces/types)
|  |- domain/src/ (domain rules)
|  |- infra-postgres/src/ (schema.sql, repositories, seeds)
|- db/
|  |- migrations/
|  |- seed-assets-management.sql
|  |- seed-qlts-demo.sql
|- docker/
|  |- compose.assets.yml
|  |- scripts/
|- .github/workflows/
```

## 5. Entrypoints quan trong
Backend:
- Khoi dong tu `apps/api/src/main.ts` -> tao DB pool/client -> tao Fastify app -> `startServer`.
- `apps/api/src/core/server.ts` bind host/port va handle shutdown signals.
- `apps/api/src/core/app.ts` dang ky security/docs/hooks va 3 module setup/auth/assets.

Frontend:
- SvelteKit non-SSR: `apps/web-ui/src/routes/+layout.ts` (`ssr = false`, `prerender = false`).
- Redirect trang goc dua tren role capability tai `apps/web-ui/src/routes/+page.svelte`.
- Shell/chuyen huong/menu theo role tai `apps/web-ui/src/routes/+layout.svelte`.

## 6. Config env va cach chay
Config env:
- API load `.env` va `.env.local`, validate bang `zod` (NODE_ENV, PORT, DATABASE_URL, rate-limit...).
- Mau env co cac nhom bien DB/JWT/Redis/VITE API base.

Lenh chay:
- Root scripts co `dev`, `dev:web`, `build`, `test`, `db:migrate`, `db:seed`, `db:migrate:assets`, `db:seed:assets`.
- API co `dev` (tsx watch), `build` (tsup), `test` (vitest).
- Web co `dev` (vite), `build` (svelte-kit + vite), `test` (vitest).

Docker:
- `docker-compose.yml`: stack chinh (`postgres`, `api`, `web-ui`, `pgadmin`, `redis-insight`).
- `docker/compose.assets.yml`: stack assets profile (db/api/web/pgadmin).
- `docker-compose.test.yml`: stack test co postgres/redis/api/web/playwright.

## 7. Evidence
- Workspace monorepo: `pnpm-workspace.yaml:1-3`.
- Root scripts: `package.json:8-43`.
- API stack/deps/scripts: `apps/api/package.json:8-50`.
- Web stack/deps/scripts: `apps/web-ui/package.json:7-36`.
- Backend entrypoints: `apps/api/src/main.ts:6-13`, `apps/api/src/core/server.ts:8-54`, `apps/api/src/core/app.ts:51-140`.
- Module registration: `apps/api/src/core/app.ts:108-132`.
- Frontend SSR off: `apps/web-ui/src/routes/+layout.ts:1-2`.
- Frontend root redirect theo capability: `apps/web-ui/src/routes/+page.svelte:4-11`.
- Frontend shell/menu guard: `apps/web-ui/src/routes/+layout.svelte:48-159`.
- Env loader/validator: `apps/api/src/config/env.ts:15-47`, `apps/api/src/config/env.ts:51-67`.
- Env samples: `.env.example:9-48`, `.env.assets.example:13-46`.
- Compose main/assets/test: `docker-compose.yml:1-85`, `docker/compose.assets.yml:1-106`, `docker-compose.test.yml:1-156`.
- Khong thay ORM pho bien: ket qua tim kiem rong voi `prisma|typeorm|sequelize|mikro-orm|drizzle|knex` tren workspace.
