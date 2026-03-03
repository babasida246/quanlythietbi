# 08 - Deployment Runbook

## Muc luc
- [1. Prerequisites](#1-prerequisites)
- [2. Chay local (khong docker)](#2-chay-local-khong-docker)
- [3. Chay bang Docker](#3-chay-bang-docker)
- [4. Setup wizard lan dau](#4-setup-wizard-lan-dau)
- [5. Bien moi truong can thiet](#5-bien-moi-truong-can-thiet)
- [6. Ports/services](#6-portsservices)
- [7. Build/test/CI](#7-buildtestci)
- [8. Backup/restore va scripts DB](#8-backuprestore-va-scripts-db)
- [9. Evidence](#9-evidence)

## 1. Prerequisites
- Node.js 20+
- pnpm (qua Corepack)
- PostgreSQL reachable qua `DATABASE_URL`
- Neu chay compose test/day du: Docker + Docker Compose

## 2. Chay local (khong docker)
### 2.1 Cai dependencies
```bash
pnpm install
```

### 2.2 Migrate + seed DB
```bash
pnpm db:migrate
pnpm db:seed
```

### 2.3 Chay API/Web
```bash
pnpm dev        # API
pnpm dev:web    # Web UI
```

### 2.4 Build/test nhanh
```bash
pnpm build
pnpm test
```

## 3. Chay bang Docker
### 3.1 Stack chinh (`docker-compose.yml`)
Services:
- `postgres` (5432)
- `api` (3000)
- `web-ui` (3001)
- `pgadmin` (8080)
- `redis-insight` (8001)

### 3.2 Stack assets (`docker/compose.assets.yml`)
Services:
- `db` (`${ASSETS_DB_PORT_HOST:-5434}:5432`)
- `api` (`${PORT_API:-3100}:3000`)
- `web` (`${PORT_WEB:-3103}:3000`, profile `web`)
- `pgadmin` (`${PGADMIN_PORT:-5054}:80`, profile `dev`)

### 3.3 Stack test (`docker-compose.test.yml`)
Services:
- `postgres-test` (`5433:5432`)
- `redis-test` (`6380:6379`)
- `api-test` (`3001:3000`)
- `web-test` (`4174:4173`)
- `playwright-tests`, `test-seeder`

## 4. Setup wizard lan dau
Trinh tu wizard:
1. Check API + DB health
2. Run migration
3. Run deterministic seed
4. Create first admin account
5. Finalize setup

Sau khi finalize, setup POST APIs bi khoa theo thiet ke.

## 5. Bien moi truong can thiet
### 5.1 API env schema (validated)
- `NODE_ENV`
- `PORT`
- `HOST`
- `DATABASE_URL`
- `DATABASE_POOL_MAX`
- `LOG_LEVEL`
- `ENABLE_RATE_LIMIT`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`

### 5.2 Env samples quan trong
- `.env.example`: `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`, `VITE_API_BASE`.
- `.env.assets.example`: `PORT_API`, `PORT_WEB`, `ASSETS_DATABASE_URL`, `PGADMIN_PORT`, `VITE_API_BASE`.

## 6. Ports/services
| Mode | Service | Port host -> container |
|---|---|---|
| Main | postgres | `5432 -> 5432` |
| Main | api | `3000 -> 3000` |
| Main | web-ui | `3001 -> 3001` |
| Main | pgadmin | `8080 -> 80` |
| Main | redis-insight | `8001 -> 8001` |
| Assets | db | `5434 (mac dinh) -> 5432` |
| Assets | api | `3100 (mac dinh) -> 3000` |
| Assets | web | `3103 (mac dinh) -> 3000` |
| Assets | pgadmin | `5054 (mac dinh) -> 80` |
| Test | postgres-test | `5433 -> 5432` |
| Test | redis-test | `6380 -> 6379` |
| Test | api-test | `3001 -> 3000` |
| Test | web-test | `4174 -> 4173` |

## 7. Build/test/CI
Lenh quan trong:
- Root: `build`, `test`, `test:all`, `test:docker`, `db:migrate`, `db:seed`, `db:migrate:assets`, `db:seed:assets`.
- API: `dev`, `build`, `test`.
- Web: `dev`, `build`, `test`.

CI:
- `.github/workflows/ci.yml`: pipeline chinh + docker-build + security-scan.
- `.github/workflows/playwright.yml`: matrix E2E/smoke/security/performance/deploy-staging.

## 8. Backup/restore va scripts DB
Tim thay:
- Migrate assets: `docker/scripts/migrate-assets.sh`.
- Seed assets: `docker/scripts/seed-assets.sh`.
- Reset assets (destructive): `docker/scripts/reset-assets.sh` (drop schema public).

`CHUA TÌM THẤY`:
- Script backup/restore operational chinh thuc (vd `pg_dump`/`pg_restore` script hoa cho production).

Ghi chu:
- `db/migrations/README.md` co huong dan `pg_dump`/`psql` thu cong, nhung file `db/init-complete.sql` duoc nhac den hien khong ton tai trong repo.

## 9. Evidence
- Root scripts: `package.json:8-43`.
- API scripts/deps: `apps/api/package.json:8-12`, `apps/api/package.json:17-39`.
- Web scripts/deps: `apps/web-ui/package.json:7-11`, `apps/web-ui/package.json:14-29`.
- Readme migrate/seed/setup wizard: `readme.md:6-7`, `readme.md:13-14`, `readme.md:27-33`.
- Main compose: `docker-compose.yml:2-85`.
- Assets compose: `docker/compose.assets.yml:4-106`.
- Test compose: `docker-compose.test.yml:5-156`.
- Env validator: `apps/api/src/config/env.ts:29-47`.
- Env examples: `.env.example:9-48`, `.env.assets.example:13-46`.
- Setup routes lock/rate-limit/jobs/finalize: `apps/api/src/routes/setup/setup.routes.ts:210-438`, `apps/api/src/routes/setup/setup.service.ts:357-389`, `apps/api/src/routes/setup/setup.service.ts:420-431`.
- Docker DB scripts: `docker/scripts/migrate-assets.sh:12-22`, `docker/scripts/seed-assets.sh:14-23`, `docker/scripts/reset-assets.sh:9-12`.
- CI workflow: `.github/workflows/ci.yml:13-170`, `.github/workflows/playwright.yml:24-369`.
- Migrations README huong dan + tham chieu init-complete: `db/migrations/README.md:5-8`, `db/migrations/README.md:65-73`.
