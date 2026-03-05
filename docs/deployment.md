# Triển khai & Vận hành

## Development Setup

### Yêu cầu

| Phần mềm | Phiên bản | Ghi chú |
|-----------|-----------|---------|
| Node.js | ≥ 20 | LTS recommended |
| pnpm | ≥ 8 | Package manager |
| Docker | Latest | Để chạy PostgreSQL |
| Docker Compose | Latest | Đi kèm Docker Desktop |

### Bước cài đặt

```bash
# 1. Clone repo
git clone <repo-url>
cd QuanLyThietBi

# 2. Cài dependencies
pnpm install

# 3. Tạo file .env cho API (copy từ .env.example)
cp apps/api/.env.example apps/api/.env

# 4. Khởi tạo infrastructure
pnpm dev:infra
# → PostgreSQL :5432 + pgAdmin :8080

# 5. Reset database (empty → migrate → seed)
pnpm db:reset

# 6. Chạy toàn bộ development
pnpm dev:all
# → API :3000 + Web :5173 + packages watch
```

### Chạy từng phần

```bash
# Chỉ API
pnpm dev

# Chỉ Web UI
pnpm dev:web

# Chỉ packages (watch mode)
pnpm dev:packages

# Infrastructure
pnpm dev:infra
```

---

## Biến môi trường

### API (`apps/api/.env`)

| Biến | Mô tả | Default |
|------|-------|---------|
| `NODE_ENV` | Môi trường | `development` |
| `PORT` | Port API server | `3000` |
| `HOST` | Host bind | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL connection string | (bắt buộc) |
| `DATABASE_POOL_MAX` | Max DB connections | `10` |
| `JWT_SECRET` | Secret cho access token | (bắt buộc) |
| `JWT_REFRESH_SECRET` | Secret cho refresh token | (bắt buộc) |
| `LOG_LEVEL` | Mức log (trace/debug/info/warn/error) | `info` |
| `DISABLE_AUTH` | Tắt authentication | `false` |
| `ENABLE_RATE_LIMIT` | Bật rate limiting | `false` |
| `RATE_LIMIT_MAX` | Max requests/window | `10000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `60000` |
| `REDIS_URL` | Redis connection (cho Bull queue) | — |
| `SMTP_HOST` | SMTP server cho email | — |
| `SMTP_PORT` | SMTP port | — |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |

### Web UI (SvelteKit env)

| Biến | Mô tả | Default |
|------|-------|---------|
| `VITE_API_BASE` | URL API server | `http://localhost:3000` |

### Test Environment (`.env.test`)

| Biến | Mô tả | Default |
|------|-------|---------|
| `API_BASE_URL` | API server for tests | `http://localhost:4010` |
| `WEB_BASE_URL` | Web server for tests | `http://localhost:4011` |
| `TEST_ADMIN_EMAIL` | Admin email for tests | `admin@example.com` |
| `TEST_ADMIN_PASSWORD` | Admin password | `Benhvien@121` |
| `DATABASE_URL` | Test DB | `postgres://postgres:postgres@localhost:5432/qltb_test` |

---

## Docker Compose

### Development (`docker-compose.dev.yml`)

```bash
pnpm dev:infra
# = docker-compose -f docker-compose.dev.yml up -d
```

| Service | Image | Port | Mô tả |
|---------|-------|------|-------|
| `postgres` | `postgres:16-alpine` | 5432 | Database |
| `pgadmin` | `dpage/pgadmin4` | 8080 | DB admin UI |

### Production (`docker-compose.yml`)

```bash
docker-compose up -d
```

| Service | Port | Mô tả |
|---------|------|-------|
| `postgres` | 5432 | Database |
| `api` | 3000 | Fastify API (built from Dockerfile) |
| `web-ui` | 3001 | SvelteKit (built from Dockerfile) |
| `pgadmin` | 8080 | DB admin |
| `redis-insight` | 8001 | Redis visualization |

Volumes: `qltb_pgdata`, `qltb_pgadmin_data`, `qltb_redis_insight_data`

---

## Database Management

### Commands

```bash
# Reset toàn bộ (xóa → migrate → seed)
pnpm db:reset

# Chỉ xóa schema
pnpm db:empty

# Chỉ chạy migrations
pnpm db:migrate

# Chỉ chạy seed
pnpm db:seed
```

### Tạo migration mới

1. Tạo file `db/migrations/058_your_migration.sql`
2. Thêm vào danh sách trong `scripts/db-migrate.mjs`
3. Test: `pnpm db:reset`

### Backup & Restore

```bash
# Backup
docker exec qltb-postgres pg_dump -U postgres qltb > backup.sql

# Restore
docker exec -i qltb-postgres psql -U postgres qltb < backup.sql
```

### Direct SQL

```bash
# Kết nối psql
docker exec -it qltb-postgres psql -U postgres -d qltb

# Chạy file SQL
docker exec -i qltb-postgres psql -U postgres -d qltb < db/seed-data.sql
```

---

## Build

### Build toàn bộ

```bash
pnpm build
```

### Build từng phần

```bash
# API
pnpm build:api  # → apps/api/dist/

# Web UI
pnpm build:web  # → apps/web-ui/build/

# Packages
pnpm --filter @qltb/application build
pnpm --filter @qltb/contracts build
pnpm --filter @qltb/domain build
pnpm --filter @qltb/infra-postgres build
```

### Build Docker images

```bash
# Build tất cả
docker-compose build

# Build từng service
docker-compose build api
docker-compose build web-ui
```

---

## Ports Reference

| Service | Port Dev | Port Test | Port Prod |
|---------|----------|-----------|-----------|
| API | 3000 | 4010 | 3000 |
| Web UI | 5173 | 4011 | 3001 |
| PostgreSQL | 5432 | 5432 | 5432 |
| pgAdmin | 8080 | — | 8080 |
| Redis Insight | — | — | 8001 |

---

## Monitoring & Logging

### Logs

```bash
# API logs (development)
pnpm dev  # Pino logger output to console

# Docker logs
docker-compose logs -f api
docker-compose logs -f postgres
```

### pgAdmin

- URL: http://localhost:8080
- Email: `admin@example.com`
- Password: `admin`

### Swagger UI

- URL: http://localhost:3000/docs
- Tự động generate từ route schemas

---

## Troubleshooting

### PostgreSQL không kết nối được

```bash
# Kiểm tra container
docker ps | findstr postgres

# Restart
docker-compose -f docker-compose.dev.yml restart postgres

# Kiểm tra logs
docker-compose -f docker-compose.dev.yml logs postgres
```

### Port đã bị sử dụng

```powershell
# Tìm process trên port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

### Migration lỗi

```bash
# Reset toàn bộ DB
pnpm db:reset

# Nếu vẫn lỗi, xóa volume Docker
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
pnpm db:reset
```

### Dependencies không sync

```bash
# Clean install
rm -rf node_modules
pnpm install

# Rebuild packages
pnpm dev:packages
```
