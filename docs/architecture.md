# Kiến trúc hệ thống

## 1. Tổng quan Clean Architecture

QLTB áp dụng Clean Architecture với 4 layer rõ ràng, phụ thuộc một chiều từ ngoài vào trong:

```text
apps/api + apps/web-ui          ← Delivery layer (Fastify routes, SvelteKit pages)
    ↓
packages/application            ← Use-case / business services
    ↓
packages/domain                 ← Entities, value objects, business rules thuần túy
    ↓
packages/contracts              ← DTOs, interfaces, enums dùng chung
    ↑
packages/infra-postgres         ← Implement interfaces từ contracts, truy cập PostgreSQL
```

Quy tắc phụ thuộc:

- `domain` không được import từ layer nào bên ngoài.
- `contracts` không được import từ `application` hoặc `infra-postgres`.
- `application` không được import trực tiếp từ `apps/*`.
- `apps/api/routes` không được import `infra-postgres` trực tiếp — phải qua service.
- `apps/web-ui` không được import source code của `apps/api`.

## 2. Monorepo structure

```text
QuanLyThietBi/
├── apps/
│   ├── api/                    # @qltb/api — Fastify 5 backend
│   │   └── src/
│   │       ├── main.ts         # Entry point → startServer()
│   │       ├── config/env.ts   # Zod env validation
│   │       ├── core/
│   │       │   ├── app.ts      # createApp() — register plugins, hooks, modules
│   │       │   └── server.ts   # startServer() — DB connect, listen
│   │       ├── modules/        # auth, admin, health, qlts, reports, entitlements
│   │       ├── routes/v1/      # 28 route groups (xem mục 3)
│   │       └── shared/         # errors, response utils, security, constants
│   │
│   └── web-ui/                 # @qltb/web-ui — SvelteKit SPA
│       └── src/
│           ├── app.html        # Anti-FOUC theme script
│           ├── app.css         # Global styles + component layer
│           ├── routes/
│           │   ├── +layout.svelte      # Auth guard, sidebar, theme
│           │   ├── login/, setup/      # Shell-less
│           │   └── (assets)/           # Layout group chính (có sidebar)
│           └── lib/
│               ├── api/        # ~30 HTTP client modules
│               ├── auth/       # capabilities.ts — client-side RBAC
│               ├── components/ # AppSidebar, ToastHost, NotifCenter
│               ├── i18n/       # svelte-i18n, locales/vi + locales/en
│               └── stores/     # themeStore, authStore, effectivePermsStore
│
├── packages/
│   ├── contracts/              # @qltb/contracts — DTOs, interfaces, enums
│   ├── domain/                 # @qltb/domain — Entities, value objects
│   ├── application/            # @qltb/application — Use cases, services
│   └── infra-postgres/         # @qltb/infra-postgres — Repos, PgClient, schema
│       └── src/
│           ├── schema.sql      # Squashed baseline (toàn bộ DDL đến 2026-04-07)
│           └── repositories/   # 40+ Repo classes
│
├── db/
│   ├── migrations/             # DDL mới từ 065_xxx.sql trở đi
│   └── seed-*.sql              # 16 seed files
│
├── scripts/
│   ├── db-empty.mjs            # DROP + recreate schema
│   ├── db-migrate.mjs          # Chạy migrations theo thứ tự
│   └── db-seed.mjs             # Chạy 16 seed files
│
└── tests/
    ├── api/                    # ~7 Playwright API tests
    └── ui/                     # ~27 Playwright UI tests
```

## 3. API route groups (apps/api/src/routes/v1)

| Group | Prefix | Mô tả |
| --- | --- | --- |
| assets | `/api/v1/assets` | CRUD tài sản, assign, timeline, import |
| catalogs | `/api/v1/assets/catalogs` | Loại, model, vendor, location, status |
| category-specs | `/api/v1/category-specs` | Spec definitions theo loại thiết bị |
| maintenance | `/api/v1/maintenance` | Ticket bảo trì, lệnh sửa chữa |
| inventory | `/api/v1/inventory` | Kiểm kê tài sản |
| warehouse | `/api/v1/warehouse` | Kho, phiếu nhập/xuất/điều chỉnh/chuyển |
| cmdb | `/api/v1/cmdb` | CI, CI types, services, relationships |
| wf | `/api/v1/wf` | Workflow requests + approvals |
| analytics | `/api/v1/analytics` | Dashboard, cost analysis |
| reports | `/api/v1/reports` | Báo cáo, reminders |
| admin | `/api/v1/admin` | Users, roles, RBAC-AD, organizations |
| auth | `/api/v1/auth` | Login, refresh, logout |
| accessories | `/api/v1/accessories` | Phụ kiện |
| components | `/api/v1/components` | Linh kiện |
| consumables | `/api/v1/consumables` | Vật tư tiêu hao |
| licenses | `/api/v1/licenses` | License phần mềm |
| checkout | `/api/v1/checkout` | Mượn/trả tài sản |
| depreciation | `/api/v1/depreciation` | Khấu hao |
| documents | `/api/v1/documents` | Tài liệu đính kèm |
| labels | `/api/v1/labels` | Nhãn tài sản |
| organizations | `/api/v1/organizations` | Cơ cấu tổ chức (OU tree) |
| automation | `/api/v1/automation` | Rules engine, scheduled tasks |
| integrations | `/api/v1/integrations` | Connectors, webhooks |
| security | `/api/v1/security` | Compliance, audit, RBAC permissions |
| communications | `/api/v1/communications` | Thông báo, inbox |
| audit | `/api/v1/audit` | Audit log |
| print | `/api/v1/print` | Xuất tài liệu DOCX |
| chat | `/api/v1/chat` | AI chat |
| field-kit | `/api/v1/field-kit` | Field engineer tools |

## 4. Data flow

### 4.1 HTTP request (Frontend → API)

```text
Browser (SvelteKit SPA)
  │  HTTP/REST — Bearer JWT
  ▼
Fastify (apps/api)
  ├─ Hook: requestIdHook
  ├─ Hook: createApiV1AuthHook → JWT verify + DB user check
  │     Bỏ qua: OPTIONS, non /api/v1/*, /api/v1/auth/*
  ├─ Hook: contextHook (attach db, user to request)
  │
  ├─ Route handler (routes/v1/**)
  │     → Zod validation (body, params, query)
  │     → Service (packages/application/)
  │           → Repository (packages/infra-postgres/)
  │                 → PostgreSQL (pg driver)
  │
  └─ Response: { success: true, data, meta? }
     Error:    { success: false, error: { code, message } }
```

### 4.2 Auth flow

```text
1. POST /api/v1/auth/login → { accessToken, user }
   - accessToken lưu vào localStorage: 'authToken'
   - refreshToken lưu qua HttpOnly cookie (server set)

2. Mọi request: Authorization: Bearer <accessToken>

3. Token hết hạn → httpClient tự gọi POST /api/v1/auth/refresh
   (singleton refreshingPromise — không refresh song song)

4. Proactive refresh: timer 90 giây trước khi token hết hạn
   visibilitychange handler: refresh ngay nếu còn < 2 phút

5. Refresh thất bại → clearStoredSession() → redirect /login
```

### 4.3 Theme flow

```text
app.html → inline script đọc localStorage('theme') → toggle class 'dark' trước paint
themeStore → writable → theme.toggle() → cập nhật html element + localStorage
tokens.css → :root (dark defaults) + html:not(.dark) (light overrides)
```

## 5. Build order (theo dependency)

```bash
pnpm --filter @qltb/contracts build
pnpm --filter @qltb/domain build
pnpm --filter @qltb/infra-postgres build
pnpm --filter @qltb/application build
pnpm --filter @qltb/api build
pnpm --filter @qltb/web-ui build
```

## 6. Ports (dev)

| Service | Port | Ghi chú |
| --- | --- | --- |
| Web UI | 5173 | Vite dev server |
| API | 3000 | Fastify |
| Swagger | 3000/docs | — |
| pgAdmin | 8080 | Docker |
| Test API | 4010 | Playwright E2E |
| Test Web | 4011 | Playwright E2E |
