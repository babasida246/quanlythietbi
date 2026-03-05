# Kiến trúc hệ thống

## Tổng quan

QLTB là hệ thống **Quản lý Thiết bị / IT Asset Management** được xây dựng theo kiến trúc **Clean Architecture** với monorepo. Hệ thống bao gồm:

- **Frontend:** SvelteKit 5 (Svelte 5 runes) — SPA mode
- **Backend:** Fastify 5 (Node.js) — RESTful API
- **Database:** PostgreSQL 16
- **Package Manager:** pnpm (workspace monorepo)

```
┌─────────────────────────────────────────────────────────┐
│                      Web Browser                        │
│                   (SvelteKit SPA)                        │
│                  Port 5173 / 4011                        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────┐
│                   Fastify API                           │
│               Port 3000 / 4010                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Routes → Modules → Application → Domain           │ │
│  │  (v1/*)   (CRUD)   (Use Cases)   (Entities)       │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Infrastructure: PostgreSQL Repositories            │ │
│  │  Auth: JWT + bcrypt | i18n: i18next                │ │
│  │  Queue: Bull/Redis | Mail: Nodemailer              │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL (pg)
┌──────────────────────▼──────────────────────────────────┐
│                PostgreSQL 16                             │
│            Database: qltb / qltb_test                   │
│            42 migrations + 3 seed files                 │
└─────────────────────────────────────────────────────────┘
```

## Cấu trúc Monorepo

```
QuanLyThietBi/
├── apps/
│   ├── api/                    # @qltb/api — Fastify backend
│   │   ├── src/
│   │   │   ├── main.ts         # Entry point
│   │   │   ├── config/         # env.ts (Zod), i18n.ts
│   │   │   ├── core/           # app.ts, server.ts, middleware/, plugins/
│   │   │   ├── modules/        # Feature modules (Clean Architecture)
│   │   │   ├── routes/         # setup/, v1/ (API routes)
│   │   │   ├── shared/         # errors, schemas, security, utils
│   │   │   └── locales/        # Server-side i18n (vi, en)
│   │   └── package.json
│   │
│   └── web-ui/                 # @qltb/web-ui — SvelteKit frontend
│       ├── src/
│       │   ├── routes/         # SvelteKit file-based routing
│       │   │   ├── login/
│       │   │   ├── (assets)/   # Layout group cho các trang chính
│       │   │   │   ├── admin/
│       │   │   │   ├── analytics/
│       │   │   │   ├── assets/
│       │   │   │   ├── automation/
│       │   │   │   ├── cmdb/
│       │   │   │   ├── integrations/
│       │   │   │   ├── inventory/
│       │   │   │   ├── maintenance/
│       │   │   │   ├── reports/
│       │   │   │   ├── requests/
│       │   │   │   ├── security/
│       │   │   │   └── warehouse/
│       │   └── lib/
│       │       ├── api/        # ~30 HTTP client modules
│       │       ├── components/ # Shared UI components
│       │       ├── i18n/       # svelte-i18n (vi, en)
│       │       ├── rbac/       # Client-side RBAC engine
│       │       └── stores/     # Svelte stores
│       └── package.json
│
├── packages/                   # Shared packages (Clean Architecture layers)
│   ├── application/            # @qltb/application — Use cases, services
│   ├── contracts/              # @qltb/contracts — DTOs, interfaces, types
│   ├── domain/                 # @qltb/domain — Entities, value objects
│   └── infra-postgres/         # @qltb/infra-postgres — Repositories, base migrations
│
├── db/
│   ├── migrations/             # 31 migration files (007–057)
│   ├── seed-data.sql           # Foundation data (users, statuses, locations...)
│   ├── seed-assets-management.sql  # Asset management data (~40 tables)
│   ├── seed-qlts-demo.sql      # CMDB & workflow demo data
│   └── seed-all.sql            # Docker psql orchestrator
│
├── scripts/
│   ├── db-empty.mjs            # DROP SCHEMA + recreate
│   ├── db-migrate.mjs          # Run 42 migrations
│   └── db-seed.mjs             # Run 3 seed files
│
├── tests/
│   ├── global.setup.ts         # Wait for servers, ensure DB ready
│   ├── global.teardown.ts      # Cleanup
│   ├── api/                    # 7 API test files
│   └── ui/                     # 27 UI test files (Playwright)
│
├── docker/                     # Docker configs (nginx, postgres, pgadmin...)
├── docker-compose.yml          # Production Docker stack
├── docker-compose.dev.yml      # Dev Docker stack (postgres + pgadmin)
├── playwright.config.ts        # E2E test configuration
└── vitest.config.ts            # Unit test configuration
```

## Clean Architecture Layers

```
┌─────────────────────────────────────────────┐
│  Routes (Fastify)                           │  ← HTTP handlers, validation
│  apps/api/src/routes/v1/                    │
├─────────────────────────────────────────────┤
│  Modules                                    │  ← Feature-specific logic
│  apps/api/src/modules/                      │
├─────────────────────────────────────────────┤
│  Application (Use Cases)                    │  ← Business workflows
│  packages/application/                      │
├─────────────────────────────────────────────┤
│  Domain (Entities)                          │  ← Core business rules
│  packages/domain/                           │
├─────────────────────────────────────────────┤
│  Contracts (DTOs/Interfaces)                │  ← Shared types
│  packages/contracts/                        │
├─────────────────────────────────────────────┤
│  Infrastructure (PostgreSQL)                │  ← Repository implementations
│  packages/infra-postgres/                   │
└─────────────────────────────────────────────┘
```

## Stack Công Nghệ

### Frontend
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| SvelteKit | 2.x | Web framework (SSR disabled, SPA mode) |
| Svelte | 5.x | UI framework (runes mode) |
| TailwindCSS | 3.4 | Utility-first CSS |
| Flowbite Svelte | 0.46 | UI component library |
| ECharts | 6.0 | Charts & data visualization |
| Cytoscape | 3.30 | Network topology graphs |
| XYFlow/Svelte | 1.5 | Flow diagrams |
| svelte-i18n | 4.0 | Internationalization (vi/en) |
| Zod | 3.24 | Client-side validation |

### Backend
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Fastify | 5.6 | Web framework |
| PostgreSQL | 16 | Database |
| pg | 8.11 | PostgreSQL client |
| JSON Web Token | — | Authentication |
| bcryptjs | — | Password hashing |
| i18next | 25.7 | Server-side i18n |
| Bull | 4.16 | Job queue (Redis) |
| Nodemailer | — | Email sending |
| Zod | 3.22 | Request validation |
| Pino | — | Logging |

### DevOps & Testing
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Playwright | 1.58 | E2E testing |
| Vitest | 1.0+ | Unit testing |
| TypeScript | 5.3 | Type safety |
| Docker Compose | — | Container orchestration |
| pnpm | 8+ | Package management |
| tsup | — | TypeScript bundling |

## API Modules

Backend được tổ chức theo module, mỗi module chứa routes, schemas, và business logic:

| Module | Đường dẫn | Mô tả |
|--------|-----------|-------|
| `auth` | `/api/v1/auth/*` | Đăng nhập, JWT, quản lý session |
| `admin` | `/api/v1/admin/*` | Quản lý users, RBAC |
| `assets` | `/api/v1/assets/*` | CRUD thiết bị, catalogs, specs |
| `cmdb` | `/api/v1/cmdb/*` | Configuration Management DB |
| `warehouse` | `/api/v1/warehouse/*` | Kho, phiếu nhập/xuất, tồn kho |
| `maintenance` | `/api/v1/maintenance/*` | Bảo trì, sửa chữa |
| `inventory` | `/api/v1/inventory/*` | Kiểm kê |
| `reports` | `/api/v1/reports/*` | Báo cáo, nhắc nhở |
| `analytics` | `/api/v1/analytics/*` | Phân tích, dashboard |
| `automation` | `/api/v1/automation/*` | Tự động hóa workflow |
| `integrations` | `/api/v1/integrations/*` | Tích hợp bên ngoài |
| `security` | `/api/v1/security/*` | Bảo mật, compliance |
| `communications` | `/api/v1/communications/*` | Thông báo, tin nhắn |
| `setup` | `/api/setup/*` | First-time setup wizard |
