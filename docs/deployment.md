# Triển khai & Vận hành

## Tổng quan các chế độ triển khai

| Chế độ | File cấu hình | Dùng khi |
|--------|---------------|----------|
| **Development** (infra Docker, code local) | `docker-compose.dev.yml` | Lập trình hàng ngày |
| **Full Docker** (tất cả trong container) | `docker-compose.yml` | Self-hosted đơn server |
| **App-only Docker** (infra ngoài) | `docker-compose.app.yml` | Infra dùng cloud managed service |
| **Standalone** (không Docker) | `.env` + `pm2`/`systemd` | Deploy trực tiếp lên server riêng lẻ |

---

## Ubuntu Server Moi Hoan Toan

Repo da co san script bootstrap cho Ubuntu server moi tai `scripts/install-ubuntu-server.sh`.

Script nay se:

- cai Docker Engine + Docker Compose plugin
- cai Node.js 20 + corepack/pnpm
- sinh file `.env` production neu chua co
- tao `docker-compose.server.override.yml` de bind PostgreSQL/Redis chi tren `127.0.0.1`
- bat UFW va chi mo SSH, Web UI, API
- build va khoi dong `postgres`, `redis`, `api`, `web-ui`

### Cach dung nhanh

```bash
# 1. Clone repo len server
git clone <repo-url> /opt/qltb
cd /opt/qltb

# 2. Cho phep script duoc chay
chmod +x scripts/install-ubuntu-server.sh

# 3. Chay bootstrap voi IP/domain public cua server
./scripts/install-ubuntu-server.sh your-domain.com
```

Neu muon tuy bien truoc khi chay:

```bash
PUBLIC_HOST=your-domain.com \
WEB_PORT=80 \
PORT=3000 \
ENABLE_PGADMIN=false \
ENABLE_REDIS_INSIGHT=false \
FORCE_OVERWRITE_ENV=true \
./scripts/install-ubuntu-server.sh
```

### Luu y van hanh

- Script mac dinh expose `Web UI` tren port `80` va `API` tren port `3000`.
- PostgreSQL va Redis van chay trong Docker, nhung chi bind tren `127.0.0.1`.
- Neu muon doi sang HTTPS + reverse proxy, dat them Nginx/Caddy o phia truoc sau khi bootstrap xong.

### Standalone khong Docker

Neu muon deploy tung dich vu truc tiep tren Ubuntu, repo da co them script `scripts/install-ubuntu-standalone.sh`.

Script nay se:

- cai Node.js 20 + pnpm
- cai PostgreSQL va tao database/user rieng cho QLTB
- cai Redis va bat `requirepass`
- build API + Web UI tu source
- chay migration va seed data
- tao 2 `systemd` services: `qltb-api`, `qltb-web`
- tuy chon cai Nginx reverse proxy

```bash
chmod +x scripts/install-ubuntu-standalone.sh
./scripts/install-ubuntu-standalone.sh your-domain.com
```

Tuy bien thuong dung:

```bash
PUBLIC_HOST=your-domain.com \
PORT=3000 \
WEB_PORT=3001 \
RUN_DB_SEED=true \
INSTALL_NGINX=true \
FORCE_OVERWRITE_ENV=true \
./scripts/install-ubuntu-standalone.sh
```

Mac dinh standalone khong cai Nginx. Neu bat `INSTALL_NGINX=true`, script se expose web qua port `80` va proxy `/api/*` vao API local.

---

## 1. Development (Khuyến nghị cho lập trình)

Infra chạy trong Docker, code chạy local với hot-reload.

### Yêu cầu

| Phần mềm | Phiên bản |
|-----------|-----------|
| Node.js | ≥ 20 LTS |
| pnpm | ≥ 8 |
| Docker Desktop | Latest |

### Cài đặt

```bash
# 1. Clone repo và cài dependencies
git clone <repo-url> && cd QuanLyThietBi
pnpm install

# 2. Tạo file .env từ template
cp .env.example .env

# 3. Khởi động infra (PostgreSQL, Redis, pgAdmin, Redis Insight)
pnpm dev:infra
# → PostgreSQL :5432  pgAdmin :8080  Redis :6379  Redis Insight :8001

# 4. Khởi tạo database
pnpm db:reset   # empty → migrate → seed

# 5. Chạy tất cả (packages watch + API + Web)
pnpm dev:all
# → API :3000   Web :5173
```

### Chạy từng phần

```bash
pnpm dev              # Chỉ API (hot-reload :3000)
pnpm dev:web          # Chỉ Web UI (hot-reload :5173)
pnpm dev:packages     # Watch packages (application, contracts, domain, infra)
pnpm dev:infra        # Chỉ infra containers
```

---

## 2. Full Docker (Tất cả trong container)

Toàn bộ stack chạy trong Docker Compose trên **một server**.

### Cài đặt

```bash
# 1. Tạo .env từ template
cp .env.example .env
# Chỉnh sửa .env nếu cần (ports, passwords)

# 2. Build và khởi động
docker-compose up -d --build

# 3. Xem logs
docker-compose logs -f api
```

API sẽ tự động: chờ PostgreSQL/Redis → chạy migrations → khởi động server.

### Các biến môi trường quan trọng

```env
# PostgreSQL container
POSTGRES_PASSWORD=your-secure-password

# Redis container
REDIS_PASSWORD=your-redis-password

# VITE_ phải đặt trước khi build web-ui
VITE_API_BASE=http://your-server-ip:3000/api
VITE_API_URL=http://your-server-ip:3000/api
```

### Commands

```bash
docker-compose up -d              # Khởi động (background)
docker-compose down               # Dừng (giữ volumes)
docker-compose down -v            # Dừng và xóa data
docker-compose build api          # Rebuild chỉ API
docker-compose restart api        # Restart API
docker-compose logs -f api        # Theo dõi logs API
```

---

## 3. App-only Docker (Infra trên server riêng / Cloud Managed)

Dùng khi PostgreSQL và Redis chạy trên server riêng biệt hoặc dịch vụ managed
(AWS RDS, Azure Database, ElastiCache, Redis Cloud, v.v.).

### Cài đặt

```bash
# 1. Tạo .env với thông tin kết nối đến server ngoài
cp .env.production.example .env
# Chỉnh sửa DATABASE_URL và REDIS_URL trỏ đến server ngoài

# 2. Build và khởi động (chỉ api + web-ui)
docker-compose -f docker-compose.app.yml up -d --build
```

### Cấu hình `.env` tối thiểu

```env
# Trỏ đến PostgreSQL server ngoài
DATABASE_URL=postgresql://user:password@db.your-domain.com:5432/qltb

# Trỏ đến Redis server ngoài
REDIS_URL=redis://:password@redis.your-domain.com:6379

# URL API cho Web UI (domain/IP thực)
VITE_API_BASE=http://api.your-domain.com:3000/api
VITE_API_URL=http://api.your-domain.com:3000/api
BACKEND_BASE_URL=http://api:3000/api
```

---

## 4. Standalone (Không Docker)

Deploy trực tiếp lên server — mỗi dịch vụ cài đặt riêng lẻ.

### Bước 1 — Cài đặt hạ tầng

**PostgreSQL (Ubuntu/Debian):**
```bash
apt install -y postgresql-16
sudo -u postgres psql -c "CREATE DATABASE qltb;"
sudo -u postgres psql -c "CREATE USER qltb_user WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE qltb TO qltb_user;"
```

**Redis (Ubuntu/Debian):**
```bash
apt install -y redis-server
# Thêm vào /etc/redis/redis.conf: requirepass your-redis-password
systemctl restart redis
```

### Bước 2 — Build

```bash
git clone <repo-url> && cd QuanLyThietBi
pnpm install
cp .env.production.example .env
# Chỉnh sửa .env — đặt đúng DATABASE_URL, REDIS_URL, VITE_API_BASE

pnpm build      # Build tất cả (packages + api + web)
```

> **Lưu ý**: `VITE_API_BASE` và `VITE_API_URL` phải được đặt đúng trong `.env`
> **trước khi chạy** `pnpm build:web` — đây là build-time variables.

### Bước 3 — Chạy migrations

```bash
node scripts/db-migrate.mjs
```

### Bước 4 — Khởi động

```bash
# Dùng pm2 (khuyến nghị)
npm install -g pm2
pm2 start apps/api/dist/apps/api/src/main.js --name qltb-api
pm2 start build/index.js --name qltb-web --cwd apps/web-ui
pm2 save && pm2 startup
```

**Hoặc systemd** — tạo `/etc/systemd/system/qltb-api.service`:
```ini
[Unit]
Description=QLTB API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/qltb
EnvironmentFile=/opt/qltb/.env
ExecStart=/usr/bin/node apps/api/dist/apps/api/src/main.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Biến môi trường đầy đủ

### API

| Biến | Mô tả | Default | Bắt buộc |
|------|-------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | — | ✅ |
| `NODE_ENV` | Môi trường | `development` | — |
| `PORT` | Port API | `3000` | — |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | — |
| `REDIS_CACHE_ENABLED` | Bật/tắt Redis cache | `true` | — |
| `REDIS_CACHE_TTL` | TTL cache (giây) | `900` | — |
| `RUN_MIGRATIONS` | Auto-migrate khi startup Docker | `true` | — |
| `DISABLE_AUTH` | Tắt authentication | `false` | — |
| `ENABLE_RATE_LIMIT` | Bật rate limiting | `false` | — |
| `LOG_LEVEL` | trace/debug/info/warn/error | `info` | — |

### Web UI

| Biến | Mô tả | Thời điểm |
|------|-------|-----------|
| `VITE_API_BASE` | URL API server | Build-time ⚡ |
| `VITE_API_URL` | URL API server | Build-time ⚡ |
| `BACKEND_BASE_URL` | API cho SSR | Runtime |
| `PORT` / `WEB_PORT` | Port Web UI | Runtime |

### Docker Compose (`docker-compose.yml`)

| Biến | Mô tả | Default |
|------|-------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
| `REDIS_PASSWORD` | Redis auth password | (trống) |
| `PGADMIN_EMAIL` | pgAdmin login | `admin@example.com` |
| `PGADMIN_PASSWORD` | pgAdmin password | `admin` |

---

## Database Management

```bash
pnpm db:reset      # Xóa sạch → migrate → seed (full reset)
pnpm db:empty      # Chỉ xóa sạch schema
pnpm db:migrate    # Chỉ chạy migrations
pnpm db:seed       # Chỉ chạy seed data
```

### Tạo migration mới

```bash
touch db/migrations/058_your_feature.sql
# Thêm vào danh sách trong scripts/db-migrate.mjs
pnpm db:reset   # Test
```

### Backup & Restore

```bash
# Docker
docker exec qltb-postgres pg_dump -U postgres qltb > backup_$(date +%Y%m%d).sql
docker exec -i qltb-postgres psql -U postgres qltb < backup.sql

# Standalone
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
psql "$DATABASE_URL" < backup.sql
```

---

## Ports Reference

| Service | Development | Production |
|---------|-------------|------------|
| API | 3000 | 3000 (env: `PORT`) |
| Web UI | 5173 | 3001 (env: `WEB_PORT`) |
| PostgreSQL | 5432 | 5432 (env: `POSTGRES_PORT`) |
| Redis | 6379 | 6379 (env: `REDIS_PORT`) |
| pgAdmin | 8080 | 8080 (env: `PGADMIN_PORT`) |
| Redis Insight | 8001 | 8001 (env: `REDIS_INSIGHT_PORT`) |

---

## Monitoring & Logging

```bash
# Health check
curl http://localhost:3000/health/ready
# {"status":"ok","db":"ok","cache":"ok"}

# Docker logs
docker-compose logs -f api

# PM2 logs (standalone)
pm2 logs qltb-api
pm2 monit
```

- **Swagger UI**: `http://localhost:3000/docs`
- **pgAdmin**: `http://localhost:8080`
- **Redis Insight**: `http://localhost:8001`

---

## Troubleshooting

### API không kết nối được Database
```bash
pg_isready -d "$DATABASE_URL"
docker-compose logs postgres
```

### Redis không kết nối
API sẽ tự **fallback sang in-memory cache** — không crash. Kiểm tra:
```bash
redis-cli -u "$REDIS_URL" ping   # Expect: PONG
```

### Migration lỗi
```bash
pnpm db:reset
# Docker: docker-compose down -v && docker-compose up -d
```

### VITE_ vars sai sau build
`VITE_` vars được baked-in lúc build — phải rebuild sau khi thay đổi:
```bash
pnpm build:web
# hoặc: docker-compose build web-ui
```

### Port đã bị chiếm (Windows)
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---
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

```bash
redis-cli -u "$REDIS_URL" ping   # Expect: PONG
```

### Migration lỗi
```bash
pnpm db:reset
# Docker: docker-compose down -v && docker-compose up -d
```

### VITE_ vars sai sau build
`VITE_` vars được baked-in lúc build  phải rebuild sau khi thay đổi:
```bash
pnpm build:web
# hoặc: docker-compose build web-ui
```

### Port đã bị chiếm (Windows)
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```
