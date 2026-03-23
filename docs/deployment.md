# Deployment and Operations Guide - QLTB

Tai lieu nay mo ta cach trien khai QLTB cho moi truong local/test/prod.

## 1. Deployment model

QLTB hien su dung deployment model theo thanh phan:

- API service (`apps/api`)
- Web UI service (`apps/web-ui`)
- PostgreSQL
- Redis

Trong local va test co the dung Docker Compose de khoi dong nhanh.

## 2. Environment matrix

### Local development

- Muc tieu: phat trien tinh nang, debug nhanh
- Tooling: `pnpm dev:*`, `docker-compose.dev.yml`

### Test environment

- Muc tieu: chay Playwright API/UI
- Tooling: `.env.test`, test ports 4010/4011

### Production

- Muc tieu: van hanh on dinh, co backup/monitoring
- Yeu cau: secret management, TLS, log retention, rollback plan

## 3. Core environment variables

Bat buoc:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

Thuong dung:

- `PORT`
- `VITE_API_BASE`
- `DISABLE_AUTH` (chi de local dev)
- `REDIS_URL`
- `REDIS_CACHE_ENABLED`
- `LOG_LEVEL`

Khuyen nghi:

- Khong hardcode secrets trong repo
- Dung secret store hoac env injection tu platform

## 4. Local runbook

```bash
pnpm install
pnpm dev:infra
pnpm db:reset
pnpm dev:all
```

Diem check sau khi start:

- API health endpoint accessible
- Swagger mo duoc tai `/docs`
- Web UI login duoc
- DB va Redis ket noi thanh cong

## 5. Build and release commands

```bash
pnpm build
pnpm build:api
pnpm build:web
```

De verify package dependency chain, co the build theo thu tu:

1. `@qltb/contracts`
2. `@qltb/domain`
3. `@qltb/infra-postgres`
4. `@qltb/application`
5. `@qltb/api`
6. `@qltb/web-ui`

## 6. Database rollout strategy

Truoc khi deploy version moi:

1. Backup database
2. Chay migration tren staging
3. Verify critical flows
4. Deploy production va migrate theo runbook

Nguyen tac:

- Khong sua migration da ton tai
- Migrations phai co rollback strategy (it nhat la rollback script/plan)

## 7. Operational checks sau deploy

- API status va error rate
- Login/refresh token flow
- Core modules: assets, warehouse, maintenance
- Queue/cache behavior neu su dung Redis

## 8. Logging and observability

Khuyen nghi toi thieu:

- Structured logs cho API requests/errors
- Request ID de truy vet
- Alert cho 5xx rate tang bat thuong
- Dashboard metrics (latency, throughput, DB health)

## 9. Security checklist

- JWT secrets du manh va duoc rotate theo chu ky
- TLS bat buoc o production
- `DISABLE_AUTH` phai tat o production
- Gioi han CORS theo domain deploy
- Kiem tra rate limit cho endpoint nhay cam

## 10. Incident and rollback plan

Khi deploy loi:

1. Tam dung traffic vao version moi (neu can)
2. Rollback image/version truoc
3. Neu migration gay issue, restore backup theo runbook
4. Mo postmortem va cap nhat deployment checklist

## 11. Suggested pre-release checklist

- Code and docs synced
- `pnpm typecheck` pass
- `pnpm build` pass
- API/UI regression tests pass
- Migration da test tren staging
- Backup da san sang
- Monitoring va alerts da bat
