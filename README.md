# Quản Lý Thiết Bị (QLTB)

> Hệ thống Quản lý Thiết bị — IT Asset Management System cho doanh nghiệp vừa và nhỏ.

[![Playwright E2E](https://img.shields.io/badge/E2E-Playwright-green)](tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](tsconfig.base.json)
[![SvelteKit 5](https://img.shields.io/badge/SvelteKit-5-orange)](apps/web-ui)
[![Fastify 5](https://img.shields.io/badge/Fastify-5-yellow)](apps/api)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-blue)](db/)

## Tính năng chính

- 📦 **Quản lý tài sản** — CRUD thiết bị, danh mục, model, vendor, vị trí, tracking vòng đời
- 🏪 **Kho & Linh kiện** — Phiếu nhập/xuất, sổ cái kho, kiểm kê, spare parts, consumables
- 🔧 **Bảo trì & Sửa chữa** — Lệnh sửa chữa, ticket bảo trì, SLA tracking
- 📋 **Workflow phê duyệt** — Quy trình phê duyệt đa bước, inbox duyệt, roles
- 🗺 **CMDB** — Configuration Items, types, services, relationships, topology, change tracking
- 📊 **Analytics & Báo cáo** — Dashboard, cost analysis, depreciation, compliance reports
- 🔐 **RBAC** — Role-based access control, org units, permission matrix, audit log
- ⚙️ **Automation** — Rules engine, scheduled tasks, notifications, webhook integrations

## Stack Công nghệ

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 5 + Svelte 5 runes + TailwindCSS + svelte-i18n (vi/en) |
| Backend | Fastify 5 (Node.js) + TypeScript |
| Database | PostgreSQL 16 |
| Testing | Playwright (E2E) + Vitest (Unit) |
| Infra | Docker Compose |
| Architecture | Clean Architecture — monorepo (pnpm workspaces) |

## Quick Start

```bash
# 1. Cài dependencies
pnpm install

# 2. Khởi động PostgreSQL + pgAdmin
pnpm dev:infra

# 3. Reset DB (schema trống → migrate → seed)
pnpm db:reset

# 4. Chạy toàn bộ (API + Web UI + packages watch)
pnpm dev:all
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/docs |
| pgAdmin | http://localhost:8080 |

## Tài khoản mặc định

| Vai trò | Email | Mật khẩu |
|---------|-------|-----------|
| Admin | admin@example.com | Benhvien@121 |
| IT Manager | it_manager@example.com | Benhvien@121 |
| User | user@example.com | Benhvien@121 |

## Cấu trúc Project

```
QuanLyThietBi/
├── apps/
│   ├── api/              # @qltb/api — Fastify backend (~221 API routes)
│   └── web-ui/           # @qltb/web-ui — SvelteKit frontend (48 routes)
├── packages/
│   ├── application/      # @qltb/application — Use cases & services
│   ├── contracts/        # @qltb/contracts — DTOs, interfaces, types
│   ├── domain/           # @qltb/domain — Entities, value objects
│   └── infra-postgres/   # @qltb/infra-postgres — Repositories, migrations
├── db/
│   ├── migrations/       # 31 migration files (007–057)
│   ├── seed-data.sql     # Dữ liệu nền (users, roles, danh mục...)
│   ├── seed-assets-management.sql  # Dữ liệu thiết bị (~40 tables)
│   └── seed-qlts-demo.sql          # CMDB & workflow demo data
├── scripts/              # DB scripts (migrate, seed, empty, setup)
├── tests/
│   ├── api/              # 7 Playwright API test files
│   └── ui/               # 29 Playwright UI test files (~365 tests)
└── docs/                 # Tài liệu chi tiết (architecture, API, DB, testing...)
```

## Lệnh thường dùng

```bash
# --- Phát triển ---
pnpm dev:all          # API + Web UI + packages (watch mode)
pnpm dev              # Chỉ API  (port 3000)
pnpm dev:web          # Chỉ Web UI (port 5173)
pnpm dev:infra        # Docker: PostgreSQL (5432) + pgAdmin (8080)

# --- Database ---
pnpm db:reset         # Schema trống → 31 migrations → 3 seed files
pnpm db:empty         # DROP SCHEMA + recreate (cẩn thận!)
pnpm db:migrate       # Chạy migrations còn thiếu
pnpm db:seed          # Chạy các seed files

# --- Testing ---
pnpm test:e2e         # Toàn bộ E2E tests (Playwright)
pnpm test:ui          # UI tests only (chromium)
pnpm test:api         # API tests only
pnpm test             # Unit tests (Vitest)

# --- Build ---
pnpm build            # Build tất cả packages
pnpm build:api        # Build API
pnpm build:web        # Build Web UI
```

## Biến môi trường

Sao chép file mẫu và điều chỉnh:

```bash
cp .env.example .env
```

| Biến | Mô tả | Mặc định |
|------|-------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/qltb` |
| `JWT_SECRET` | Access token secret | — (bắt buộc đặt) |
| `JWT_REFRESH_SECRET` | Refresh token secret | — (bắt buộc đặt) |
| `PORT` | API server port | `3000` |
| `VITE_API_BASE` | Base URL cho frontend → API | `http://localhost:3000/api` |

## Setup Wizard (lần đầu)

Nếu chạy lần đầu tiên chưa có seed data:

1. Mở <http://localhost:5173/setup>
2. Health check (API + DB) → Run migrations → Seed data → Tạo admin → Finalize

> Wizard tự khoá sau khi hoàn tất, redirect về `/login`.

## Tài liệu

Xem thư mục [`docs/`](docs/README.md) để biết chi tiết đầy đủ:

| File | Nội dung |
|------|----------|
| [architecture.md](docs/architecture.md) | Kiến trúc hệ thống, Clean Architecture, monorepo layout |
| [database.md](docs/database.md) | Schema, migrations, seed data, naming conventions |
| [api-reference.md](docs/api-reference.md) | 221 REST endpoints, xác thực, phân quyền |
| [features.md](docs/features.md) | 48 routes, mô tả chi tiết từng module |
| [testing.md](docs/testing.md) | Playwright E2E, Vitest unit tests, cách chạy & viết mới |
| [deployment.md](docs/deployment.md) | Docker Compose, biến môi trường, build, monitoring |
