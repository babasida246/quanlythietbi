# Quản Lý Thiết Bị (QLTB)

Hệ thống Quản Lý Tài Sản CNTT (IT Asset Management) xây dựng theo Clean Architecture trên monorepo pnpm.

## 1. Tổng quan

QLTB giải quyết bài toán quản lý toàn bộ vòng đời tài sản CNTT:

- Danh mục và cấu hình tài sản, mô hình thiết bị, nhà cung cấp
- Nhập/xuất kho, tồn kho linh kiện, phiếu điều chỉnh/chuyển kho
- Gán tài sản cho người dùng/phòng ban/hệ thống
- Bảo trì, sửa chữa, kiểm kê định kỳ
- CMDB (quản lý cấu hình hạ tầng), sơ đồ topology
- Workflow phê duyệt đa bước, inbox duyệt
- Báo cáo, analytics, khấu hao tài sản
- Quản trị người dùng, RBAC (Classic + Policy), audit log

## 2. Kiến trúc nhanh

```text
SvelteKit SPA (apps/web-ui)
  ↓ HTTP/REST + Bearer JWT
Fastify 5 (apps/api)
  ↓
Application Services (@qltb/application)
  ↓
Repositories (@qltb/infra-postgres)
  ↓
PostgreSQL 16
```

Monorepo gồm 2 app và 4 package:

| Package | Mô tả |
| --- | --- |
| `apps/api` | Backend Fastify 5 |
| `apps/web-ui` | Frontend SvelteKit SPA |
| `packages/contracts` | DTOs, interfaces, enums dùng chung |
| `packages/domain` | Domain entities và value objects |
| `packages/application` | Use cases, business services |
| `packages/infra-postgres` | Postgres repositories, schema, migrations |

## 3. Công nghệ

| Layer | Công nghệ |
| --- | --- |
| Frontend | SvelteKit 2, Svelte 5 (runes), TailwindCSS 3.4, svelte-i18n |
| Backend | Fastify 5, Node.js 20+, Zod, JWT (access + refresh) |
| Database | PostgreSQL 16, Redis |
| Testing | Playwright (E2E + API), Vitest (unit) |
| Tooling | pnpm workspaces, Vite, tsup, Docker Compose |

## 4. Yêu cầu hệ thống

- Node.js >= 20
- pnpm >= 8
- Docker + Docker Compose (cho local infra)

## 5. Quick Start

```bash
# 1. Cài dependencies
pnpm install

# 2. Khởi động PostgreSQL + pgAdmin qua Docker
pnpm dev:infra

# 3. Tạo schema + chạy seed dữ liệu
pnpm db:reset

# 4. Khởi động API + Web UI song song
pnpm dev:all
```

Sau khi chạy:

| Service | URL |
| --- | --- |
| Web UI | <http://localhost:5173> |
| API | <http://localhost:3000> |
| Swagger | <http://localhost:3000/docs> |
| pgAdmin | <http://localhost:8080> |

## 6. Biến môi trường quan trọng

Sao chép `.env.example` thành `.env`:

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/qltb` |
| `JWT_SECRET` | ✅ prod | Khóa ký access token |
| `JWT_REFRESH_SECRET` | ✅ prod | Khóa ký refresh token |
| `PORT` | — | Cổng API (mặc định 3000) |
| `VITE_API_BASE` | — | Base URL frontend gọi API |
| `DISABLE_AUTH` | — | Bỏ qua JWT auth (chỉ local dev) |
| `REDIS_URL` | — | Kết nối Redis |

## 7. Tài khoản mặc định sau seed

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@example.com` | `Benhvien@121` |
| IT Manager | `it_manager@example.com` | `Benhvien@121` |
| User | `user@example.com` | `Benhvien@121` |

## 8. Scripts thường dùng

```bash
# Phát triển
pnpm dev:all        # API + Web UI + packages watch
pnpm dev            # Chỉ API (port 3000)
pnpm dev:web        # Chỉ Web UI (port 5173)
pnpm dev:infra      # Khởi PostgreSQL + pgAdmin (Docker)

# Database
pnpm db:reset       # empty → migrate → seed (full reset)
pnpm db:empty       # DROP SCHEMA + recreate
pnpm db:migrate     # Chạy tất cả migrations theo thứ tự
pnpm db:seed        # Chạy 16 seed files

# Build
pnpm build          # Build toàn bộ packages + apps
pnpm build:api      # Build API với tsup
pnpm build:web      # Build Web UI với Vite

# Tests
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright tất cả (API + UI)
pnpm test:api       # Playwright — chỉ API tests
pnpm test:ui        # Playwright — chỉ UI tests
pnpm test:smoke     # Chỉ smoke tests

# Dependency graph / architecture checks
pnpm deps:check
pnpm deps:json
pnpm deps:html
pnpm deps:graph
```

## 9. Cấu trúc thư mục

```text
QuanLyThietBi/
├── apps/
│   ├── api/            # Fastify backend
│   └── web-ui/         # SvelteKit frontend (SPA mode)
├── packages/
│   ├── contracts/      # DTOs, interfaces, enums
│   ├── domain/         # Domain entities, value objects
│   ├── application/    # Use cases, business services
│   └── infra-postgres/ # Repositories, schema, migrations
├── db/
│   ├── migrations/     # DDL migrations (065_xxx.sql trở đi)
│   └── seed-*.sql      # 16 seed files theo thứ tự
├── docs/               # Tài liệu kỹ thuật
├── scripts/            # db-migrate, db-seed, db-empty, deploy
└── tests/              # Playwright E2E (api/ + ui/)
```

## 10. Quy ước quan trọng khi phát triển

- Không sửa migration cũ — luôn thêm migration mới.
- Migration chỉ chứa DDL, seed data đặt trong `db/seed-*.sql`.
- Frontend dùng i18n split-domain: `locales/vi/<domain>.json` và `locales/en/<domain>.json`.
- API response format: `{ success: true, data, meta? }` / `{ success: false, error: { code, message } }`.
- Svelte 5 runes: dùng `$state`, `$derived`, `$effect` — không dùng Svelte 4 store syntax cho local state.
- Build theo thứ tự: `contracts → domain → infra-postgres → application → api`.

## 11. Tài liệu chi tiết

| File | Nội dung |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Kiến trúc, data flow, layer rules |
| [docs/database.md](docs/database.md) | Schema, migration order, seed order |
| [docs/frontend.md](docs/frontend.md) | Svelte 5 patterns, i18n, CSS tokens, RBAC |
| [docs/backend-api.md](docs/backend-api.md) | API conventions, route patterns, auth |
| [docs/testing.md](docs/testing.md) | Strategy, Playwright config, test patterns |
| [docs/deployment.md](docs/deployment.md) | Docker, HTTPS, deploy scripts |
| [docs/project-map.md](docs/project-map.md) | Map đầy đủ modules, packages, dependency rules |

## 12. Onboarding 30 phút

1. Chạy `pnpm dev:infra`, `pnpm db:reset`, `pnpm dev:all`.
2. Đăng nhập bằng `admin@example.com` / `Benhvien@121`.
3. Mở Swagger tại `/docs`, gọi thử endpoint `GET /api/v1/assets`.
4. Đọc `docs/architecture.md` và `docs/database.md`.
5. Chạy smoke tests: `pnpm test:smoke`.
