# Claude Instructions — QuanLyThietBi (QLTB)

> Tài liệu chỉ dẫn cho Claude khi làm việc với codebase này.
> Cập nhật lần cuối: 2026-03-19

---

## 1. Dự án là gì?

**QLTB** (Quản Lý Thiết Bị) là hệ thống **IT Asset Management** dành cho doanh nghiệp vừa và nhỏ, được xây dựng theo Clean Architecture trên monorepo pnpm.

### Các module chính

| Module | Đường dẫn UI | Mô tả |
| --- | --- | --- |
| Assets | `/assets` | Vòng đời thiết bị, CRUD, assign, timeline |
| Catalogs | `/assets/catalogs` | Loại, model, vendor, vị trí, trạng thái |
| CMDB | `/cmdb` | Hạng mục cấu hình (CI), loại, dịch vụ, quan hệ, sơ đồ |
| Warehouse | `/warehouse` | Kho, phiếu nhập/xuất/điều chỉnh/chuyển, tồn kho, sổ kho |
| Maintenance | `/maintenance` | Ticket bảo trì, lệnh sửa chữa |
| Inventory | `/inventory` | Kiểm kê tài sản |
| Organizations | `/admin` | Cơ cấu tổ chức phân cấp (OU tree) |
| Requests / Workflow | `/requests`, `/inbox` | Phê duyệt đa bước, inbox duyệt |
| Analytics | `/analytics` | Dashboard, cost analysis, báo cáo |
| Automation | `/automation` | Rules engine, scheduled tasks |
| Integrations | `/integrations` | Connectors, sync rules, webhooks |
| Security | `/security` | Compliance, audit, RBAC permissions |
| Admin | `/admin` | Quản lý users, roles, organizations |
| Reports | `/reports` | Báo cáo tổng hợp |

---

## 2. Stack công nghệ

| Layer | Công nghệ | Phiên bản |
| --- | --- | --- |
| Frontend | SvelteKit 2 + Svelte 5 (runes) | SPA mode |
| CSS | TailwindCSS 3.4 + custom design tokens | `darkMode: 'class'` |
| Charts | ECharts 6, Cytoscape 3.30, XYFlow | — |
| i18n | svelte-i18n 4.0 | vi/en, split domain files |
| Backend | Fastify 5 (Node.js 20+) | — |
| Validation | Zod (cả client lẫn server) | — |
| Database | PostgreSQL 16 | — |
| Auth | JWT (access + refresh), bcryptjs | — |
| Cache | Redis (Bull + ioredis) | — |
| Testing | Playwright (E2E) + Vitest (unit) | — |
| Infra | Docker Compose, pnpm workspaces | — |
| Build | tsup (API), Vite (Web UI) | — |

---

## 3. Cấu trúc Monorepo

```text
QuanLyThietBi/
├── apps/
│   ├── api/                    # @qltb/api — Fastify backend
│   │   └── src/
│   │       ├── main.ts         # Entry point → startServer()
│   │       ├── config/env.ts   # Zod env validation
│   │       ├── core/
│   │       │   ├── app.ts      # createApp() — register plugins, hooks, modules
│   │       │   ├── server.ts   # startServer() — DB connect, listen
│   │       │   └── middleware/ # auth hook, error handler, request hooks
│   │       ├── modules/        # Feature stores: accessories, admin, auth, wf...
│   │       ├── routes/
│   │       │   ├── setup/      # /api/setup/* — First-time wizard
│   │       │   └── v1/         # /api/v1/* — tất cả feature routes
│   │       │       └── assets/ # assets.module.ts — registers ALL route groups
│   │       └── shared/         # errors, response utils, security, constants
│   │
│   └── web-ui/                 # @qltb/web-ui — SvelteKit frontend
│       └── src/
│           ├── app.html        # Anti-FOUC theme script ở đây
│           ├── app.css         # Global styles + component layer
│           ├── routes/
│           │   ├── +layout.svelte     # Root layout: auth guard, sidebar, header
│           │   ├── login/             # Shellless (không có sidebar)
│           │   ├── setup/             # Shellless — first-time wizard
│           │   └── (assets)/          # Layout group chính (có sidebar)
│           │       ├── +layout.svelte
│           │       └── [module]/+page.svelte
│           └── lib/
│               ├── api/        # HTTP client modules (~30 files)
│               ├── auth/       # capabilities.ts — client-side RBAC
│               ├── components/ # AppSidebar, ToastHost, NotifCenter...
│               ├── i18n/       # svelte-i18n config + locales/vi/ + locales/en/
│               ├── rbac/       # RBAC engine helpers
│               ├── warehouse/  # StockDocumentLines.svelte (dual-mode line editor)
│               └── stores/     # themeStore.ts, authStore...
│
├── packages/                   # Clean Architecture layers
│   ├── contracts/              # @qltb/contracts — DTOs, interfaces, shared enums
│   ├── domain/                 # @qltb/domain — Entities, value objects
│   ├── application/            # @qltb/application — Use cases, service classes
│   └── infra-postgres/         # @qltb/infra-postgres — Repo implementations, PgClient
│       └── src/
│           ├── schema.sql      # Base schema (migration #1)
│           ├── migrations/     # migrations 020–042
│           └── repositories/   # All *Repo classes
│
├── db/
│   ├── migrations/             # migrations 007–057 + dated patches (20260319_*)
│   ├── seed-data.sql           # Foundation: users, locations, vendors, statuses
│   ├── seed-assets-management.sql  # ~40 tables: assets, warehouse, maintenance
│   └── seed-qlts-demo.sql      # CMDB, workflow demo data
│
├── scripts/
│   ├── db-empty.mjs            # DROP + recreate schema
│   ├── db-migrate.mjs          # Run all migrations in order
│   └── db-seed.mjs             # Run 3 seed files in order
│
└── tests/
    ├── global.setup.ts         # Playwright global setup
    ├── api/                    # ~7 API test files
    └── ui/                     # ~27 UI test files
```

---

## 4. Luồng dữ liệu (Data Flow)

### 4.1 Request HTTP (Frontend → API)

```text
Browser (SvelteKit SPA)
  │
  │  HTTP/REST — Bearer JWT
  ▼
Fastify (apps/api)
  │
  ├─ Hook: requestIdHook (gen x-request-id)
  ├─ Hook: createApiV1AuthHook → authenticateBearerRequest (JWT verify + DB user check)
  │     Bỏ qua: OPTIONS, non /api/v1/*, /api/v1/auth/*
  ├─ Hook: contextHook (attach db, user to request)
  ├─ Hook: requestLogHook
  │
  ├─ Route handler (routes/v1/**/*.route.ts)
  │     → Zod schema validation (request body, params, query)
  │     → Gọi Service (packages/application/)
  │           → Gọi Repository (packages/infra-postgres/)
  │                 → PostgreSQL (pg driver)
  │
  ├─ Response: { success: true, data: {...}, meta?: {...} }
  └─ Error: { success: false, error: { code, message } }
```

### 4.2 Authentication flow

```text
1. POST /api/v1/auth/login → { accessToken, refreshToken, user }
   - Tokens lưu vào localStorage: 'authToken', 'refreshToken'
   - User info: 'userEmail', 'userRole', 'userName'

2. Mọi request sau: Authorization: Bearer <accessToken>

3. Token hết hạn → httpClient tự động gọi POST /api/v1/auth/refresh
   (singleton refreshingPromise để không refresh song song)

4. Refresh thất bại → clearStoredSession() → redirect /login
```

### 4.3 Frontend API calls

Tất cả HTTP calls đi qua `apps/web-ui/src/lib/api/httpClient.ts`:

- `getStoredTokens()` / `setStoredTokens()` — quản lý localStorage
- `refreshAccessToken()` — singleton refresh với promise dedup
- Mỗi module (assets.ts, cmdb.ts, warehouse.ts...) export typed helper functions

### 4.4 Luồng Theme (Dark/Light)

```text
app.html  → inline script đọc localStorage('theme') → toggle class 'dark' trước khi paint
themeStore.ts → writable store → theme.toggle() → cập nhật html element + localStorage
tokens.css → :root (dark defaults) + html:not(.dark) { ... } (light overrides)
```

---

## 5. Database

### 5.1 Migration order

```text
pnpm db:reset = pnpm db:empty → pnpm db:migrate → pnpm db:seed

db:migrate chạy theo thứ tự:
  1. packages/infra-postgres/src/schema.sql         (base schema)
  2. packages/infra-postgres/src/migrations/020–042 (11 package migrations)
  3. db/migrations/007–057 (31 app migrations)
  4. db/migrations/20260319_001 → 004 (dated patches hiện tại)
  5. db/migrations/2026xxxx_*.sql (dated patches mới, theo thứ tự tên file)
```

### 5.2 Quy tắc migration

- **Chỉ DDL** — Không bao giờ đặt INSERT/seed trong migration
- **Đánh số tiếp** — File app migration mới: `db/migrations/058_xxx.sql`
- **Patch tức thời** — Dùng tên dated: `db/migrations/20260319_005_desc.sql` (tăng số thứ tự trong ngày)
- **Idempotent** — Dùng `IF NOT EXISTS` / `IF EXISTS` / `DO $$ IF ... $$`
- **Không xóa migration cũ** — Chỉ thêm migration mới để sửa

### 5.3 Các dated patches hiện tại (20260319)

| File | Nội dung |
| --- | --- |
| `20260319_001_organizations_hierarchy.sql` | Bảng organizations (OU tree), org_path |
| `20260319_002_assignments_location_org.sql` | Thêm organization_id vào asset_assignments |
| `20260319_003_locations_organization_link.sql` | FK locations → organizations |
| `20260319_004_stock_doc_asset_lines.sql` | line_type + asset columns trong stock_document_lines; location_id trong stock_documents; source_doc_line_id trong assets; sequence asset_code_seq |

### 5.4 Seed UUIDs chuẩn

| Entity | UUID pattern |
| --- | --- |
| Users | `00000000-0000-0000-0000-00000000000X` |
| Statuses | `c0100000-0000-0000-0000-00000000000X` |
| Locations | `a0000000-0000-0000-0000-00000000000X` |
| Vendors | `b0000000-0000-0000-0000-00000000000X` |
| Organizations | `d0000000-0000-0000-0000-00000000000X` |

### 5.5 Default accounts (sau seed)

| Vai trò | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `Benhvien@121` |
| IT Manager | `it_manager@example.com` | `Benhvien@121` |
| User | `user@example.com` | `Benhvien@121` |

---

## 6. API Conventions

### 6.1 Response format

```typescript
// Success
{ success: true, data: T, meta?: { total?, page?, limit? } }

// Error
{ success: false, error: { code: string, message: string } }
```

### 6.2 Auth

- Tất cả `/api/v1/*` đều yêu cầu `Authorization: Bearer <jwt>` — **trừ** `/api/v1/auth/*`
- Dev bypass: `DISABLE_AUTH=true` trong `.env`
- JWT payload: `{ sub: uuid, email, role, iat, exp }`

### 6.3 Các module API chính

| Prefix | Module |
| --- | --- |
| `/api/v1/assets` | Tài sản |
| `/api/v1/asset-models` | Model thiết bị |
| `/api/v1/assets/catalogs` | Danh mục (locations, vendors, categories...) |
| `/api/v1/cmdb` | Quản lý cấu hình |
| `/api/v1/warehouse` | Kho hàng, phiếu, tồn kho |
| `/api/v1/stock` | Stock assets in warehouse |
| `/api/v1/maintenance` | Bảo trì |
| `/api/v1/inventory` | Kiểm kê |
| `/api/v1/organizations` | Cơ cấu tổ chức |
| `/api/v1/reports` | Báo cáo |
| `/api/v1/analytics` | Analytics |
| `/api/v1/automation` | Automation |
| `/api/v1/integrations` | Tích hợp |
| `/api/v1/security` | Bảo mật |
| `/api/v1/admin` | Quản trị |
| `/api/v1/communications` | Thông báo |
| `/api/setup` | Setup wizard |

Swagger UI: `http://localhost:3000/docs`

---

## 7. Frontend Conventions

### 7.1 Svelte 5 Runes

Dự án dùng **Svelte 5 runes** — KHÔNG dùng Svelte 4 reactive stores cho local state:

```svelte
<!-- ✅ Đúng — Svelte 5 runes -->
let count = $state(0)
let doubled = $derived(count * 2)
$effect(() => { localStorage.setItem('x', count) })
let { children } = $props()
let { value = $bindable() } = $props()

<!-- ❌ Sai — Svelte 4 syntax -->
let count = 0; $: doubled = count * 2;
export let prop;
```

- `onMount` — dùng cho side effects cần DOM hoặc load data một lần khi mount
- `$effect` — dùng khi cần react với state changes (không phải khởi tạo một lần)
- `$derived.by(() => ...)` — khi logic derive phức tạp hơn một expression

### 7.2 i18n — QUAN TRỌNG: Dùng split domain files

**KHÔNG** sửa `locales/vi.json` hoặc `locales/en.json` (monolithic files — không được load).

Locale files được tách thành các domain files:

```text
apps/web-ui/src/lib/i18n/locales/
├── vi/
│   ├── common.json      # nav.*, common.*, auth.*, table.*, form.*
│   ├── assets.json      # assets.*
│   ├── warehouse.json   # warehouse.*, stockDoc.*, wfRequest.*
│   ├── cmdb.json        # cmdb.*
│   ├── requests.json    # requests.*
│   └── ...
└── en/
    ├── common.json
    ├── assets.json
    ├── warehouse.json
    └── ...
```

File `apps/web-ui/src/lib/i18n/index.ts` register từng domain file qua `register()`.

**Khi thêm key mới:**

1. Xác định domain → tìm đúng file (vd: key `warehouse.field.xxx` → `vi/warehouse.json`)
2. Thêm vào **cả hai** `vi/<domain>.json` VÀ `en/<domain>.json`
3. Không bao giờ sửa `locales/vi.json` hoặc `locales/en.json`

**Sử dụng trong component:**

```svelte
<script>
  import { _, isLoading } from '$lib/i18n'
</script>

<!-- Luôn có fallback khi đang load -->
{$isLoading ? 'Fallback text' : $_('module.key')}

<!-- Interpolation -->
{$isLoading ? `Total (${n}):` : $_('stockDoc.total', { values: { count: n } })}
```

- Key pattern: `domain.subSection.keyName` (camelCase)
- Missing key → svelte-i18n auto-convert camelCase → "Title Case" (không crash, nhưng trông sai)

### 7.3 CSS / Design System

**KHÔNG** hardcode hex color. Dùng CSS custom properties hoặc semantic Tailwind classes:

```svelte
<!-- ✅ Đúng -->
<p class="text-slate-400">...</p>
<div class="bg-surface-2">...</div>
<span style="color: var(--color-text-muted)">...</span>

<!-- ❌ Tránh khi có thể -->
<p style="color: #64748b">...</p>
```

Design token source of truth: `apps/web-ui/src/lib/styles/tokens.css`

- `:root` → dark mode defaults
- `html:not(.dark)` → light mode overrides

Tailwind custom colors (`tailwind.config.js`):

- `surface-bg / surface-1 / surface-2 / surface-3` — layered surfaces
- `primary / success / warning / error / info` — semantic colors
- `border / border-strong` — semantic borders

Component classes (`app.css`): `.card`, `.btn`, `.btn-primary`, `.badge-*`, `.data-table`, `.tabs-trigger`, `.input-base`, `.select-base`, `.modal-panel`, `.alert-*`, v.v.

**Thứ tự ưu tiên CSS:**

1. Component class trong `app.css` (`.btn-primary`, `.card`...)
2. Semantic Tailwind (`bg-surface-2`, `text-primary`...)
3. Slate utilities (`text-slate-400`...) — tự adapt qua tokens.css override
4. Hardcode hex — chỉ dùng khi không còn lựa chọn nào

### 7.4 RBAC client-side

```typescript
import { getCapabilities, isRouteAllowed } from '$lib/auth/capabilities'
const caps = getCapabilities(userRole) // userRole từ localStorage

// Roles: 'admin' | 'super_admin' | 'it_asset_manager' | 'warehouse_keeper'
//        | 'technician' | 'requester' | 'user' | 'viewer'
```

Capability matrix (`capabilities.ts`) bao gồm: assets, categories, cmdb, warehouse, inventory, licenses, accessories, consumables, components, checkout, maintenance, reports, analytics, admin, security, integrations, automation, communications.

---

## 8. Clean Architecture Layer Rules

Khi thêm tính năng mới, tuân thủ thứ tự dependency:

```text
Routes (apps/api/routes/v1/)
  ↓ gọi
Services (packages/application/)
  ↓ gọi
Repositories (packages/infra-postgres/repositories/)
  ↓ gọi
Database (PostgreSQL)

Contracts (packages/contracts/)
  ← dùng bởi tất cả layers (DTOs, interfaces, enums)

Domain (packages/domain/)
  ← chỉ chứa pure business logic, không import packages khác trong monorepo
```

**KHÔNG** import Application layer từ Domain.
**KHÔNG** import Infrastructure trực tiếp từ Routes (phải qua Service).

### 8.1 WarehouseTransactionContext

`packages/contracts/src/maintenanceWarehouse/transactions.ts` — context được inject vào mỗi database transaction của warehouse:

```typescript
interface WarehouseTransactionContext {
    documents:   IStockDocumentRepo
    stock:       IStockRepo
    movements:   IMovementRepo
    repairs:     IRepairOrderRepo
    repairParts: IRepairPartRepo
    assets:      IAssetRepo      // để tạo/cập nhật assets khi post phiếu
    opsEvents?:  IOpsEventRepo
}
```

> `IAssignmentRepo` **không** nằm trong WarehouseTransactionContext. Assignment được tạo thủ công qua "Gán tài sản", không tự động từ phiếu kho.

### 8.2 Queryable interface

Các Repo trong `infra-postgres` chấp nhận `Queryable` thay vì `PgClient` cụ thể:

```typescript
interface Queryable {
    query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>>
}
```

`PgClient` và `PoolClient` (transaction client) đều implement `Queryable`. Dùng `Queryable` trong constructor của Repo khi Repo cần hoạt động cả trong và ngoài transaction.

---

## 9. Asset Lifecycle — Luồng ITAM chuẩn

```text
[Phiếu nhập kho — receipt]
  Post → tự tạo Asset record
         status: 'in_stock'
         warehouseId: kho nhận
         source_doc_line_id: line.id (traceability)

[Phiếu xuất kho — issue]
  Post → cập nhật Asset record
         status: 'in_stock' → 'in_use'
         locationId: document.locationId
         warehouseId: null (ra khỏi kho)
  ⚠️ KHÔNG tạo assignment — đây là trách nhiệm của "Gán tài sản"

[Gán tài sản — AssignModal]
  Thủ công → tạo asset_assignment record
             assigneeType: person | department | system
             assigneeName, assigneeId, locationId, organizationId
  Có thể gán/gán lại bất cứ lúc nào, độc lập với luồng kho
```

**Phân tách trách nhiệm:**

- **Phiếu kho** = quản lý vật lý (asset ở kho nào, status in_stock/in_use)
- **Gán tài sản** = quản lý sử dụng (asset do ai dùng, phòng ban nào)

### 9.1 StockDocumentLine types

Mỗi dòng trong phiếu kho có `line_type`:

- `spare_part` — linh kiện dự phòng, tác động lên `spare_part_stock` table
- `asset` — thiết bị nguyên chiếc, tác động lên `assets` table

Receipt + asset line → tạo mới asset (status: in_stock)

Issue + asset line → cập nhật asset (status: in_use, ra khỏi kho)

Spare_part lines → điều chỉnh số lượng tồn kho như cũ

---

## 10. Environment Variables

File `.env` tại root (copy từ `.env.example`):

| Biến | Bắt buộc | Default | Mô tả |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | — | `postgresql://postgres:postgres@localhost:5432/qltb` |
| `JWT_SECRET` | ✅ prod | `dev-access-secret-key` | Access token signing key |
| `JWT_REFRESH_SECRET` | ✅ prod | — | Refresh token signing key |
| `PORT` | — | `3000` | API server port |
| `VITE_API_BASE` | — | `http://localhost:3000/api` | Frontend → API base URL |
| `DISABLE_AUTH` | — | `false` | Bỏ qua JWT auth (dev only!) |
| `REDIS_URL` | — | `redis://localhost:6379` | Redis connection |
| `REDIS_CACHE_ENABLED` | — | `true` | Bật/tắt cache |
| `LOG_LEVEL` | — | `info` | Pino log level |

Test environment: `.env.test` (API port 4010, Web port 4011, DB: `qltb_test`)

---

## 11. Commands tham khảo nhanh

```bash
# ── Phát triển ──────────────────────────────────────────────────
pnpm dev:infra          # Khởi PostgreSQL + pgAdmin (Docker)
pnpm dev:all            # API + Web UI + packages watch (concurrently)
pnpm dev                # Chỉ API (port 3000)
pnpm dev:web            # Chỉ Web UI (port 5173)

# ── Database ────────────────────────────────────────────────────
pnpm db:reset           # empty → migrate → seed (Full reset)
pnpm db:empty           # DROP SCHEMA + recreate
pnpm db:migrate         # Chạy tất cả migrations theo thứ tự
pnpm db:seed            # Chạy 3 seed files

# ── Build ───────────────────────────────────────────────────────
pnpm build:api          # Build API với tsup
pnpm build:web          # Build Web UI với Vite
pnpm build              # Build tất cả packages + apps

# ── Package builds (theo thứ tự dependency) ─────────────────────
pnpm --filter @qltb/contracts build
pnpm --filter @qltb/domain build
pnpm --filter @qltb/infra-postgres build
pnpm --filter @qltb/application build

# ── Testing ─────────────────────────────────────────────────────
pnpm test               # Vitest unit tests
pnpm test:e2e           # Playwright tất cả (API + UI)
pnpm test:api           # Playwright — chỉ API tests (port 4010)
pnpm test:ui            # Playwright — chỉ UI tests (port 4011)
npx playwright test --grep "@smoke"     # Chỉ smoke tests
npx playwright show-report              # Xem HTML report

# ── Type check & Lint ───────────────────────────────────────────
pnpm typecheck          # tsc --build
pnpm test:lint          # Lint tất cả
```

---

## 12. Testing

### Playwright config

```text
playwright.config.ts:
  projects:
    - api      → tests/api/    → baseURL: http://localhost:4010
    - chromium → tests/ui/     → baseURL: http://localhost:4011
  webServer (auto-start):
    - API:    pnpm --filter @qltb/api dev    → :4010/health
    - Web UI: vite dev --port 4011           → :4011/login
```

### Quy tắc viết test

- Playwright UI test: `test.describe('Tên module', () => { test('tên test', async ({ page }) => {...}) })`
- Login helper: dùng `tests/fixtures/` hoặc `page.goto('/login')` rồi fill form
- `data-testid` attribute: dùng cho các element cần assert trong test
- API test: dùng `@playwright/test` `request` fixture, không dùng `page`

---

## 13. Quy tắc tiên quyết (Prerequisites)

### 13.1 Trước khi sửa code

1. **Đọc file trước khi sửa** — Không đề xuất thay đổi dựa trên giả định.
2. **Hiểu clean architecture layer** — Đảm bảo sửa đúng layer.
3. **Kiểm tra i18n** — Nếu thêm text mới, thêm vào đúng split domain file (vi/ và en/).
4. **Kiểm tra types** — `packages/contracts/src/` là nguồn truth cho DTOs.

### 13.2 Database changes

1. **Thêm migration mới** — Không sửa migration đã tồn tại.
2. **Kiểm tra thứ tự** — Migration phải chạy được sau tất cả migration trước.
3. **Seed data** — Đặt trong `db/seed-*.sql`, không trong migration.
4. **Idempotent** — Dùng `IF NOT EXISTS` để migration có thể re-run an toàn.
5. **Patch số tiếp theo hôm nay** — Xem file cuối trong `db/migrations/` để đặt tên đúng.

### 13.3 API changes

1. **Schema validation** — Mọi route input phải có Zod schema.
2. **Response format** — Luôn trả `{ success: true, data: ... }` hoặc `{ success: false, error: ... }`.
3. **Auth** — `/api/v1/*` routes tự động cần JWT trừ `/api/v1/auth/*`.
4. **Error types** — Dùng các lớp error có sẵn trong `apps/api/src/shared/errors/`.

### 13.4 Frontend changes

1. **Svelte 5 runes** — Không dùng Svelte 4 store syntax cho local state.
2. **i18n bắt buộc** — Tất cả text cần có `$_('key')`, có fallback khi `$isLoading`.
3. **i18n đúng file** — Thêm vào `locales/vi/<domain>.json` và `locales/en/<domain>.json`, KHÔNG phải `vi.json`/`en.json`.
4. **Semantic CSS** — Dùng CSS custom properties / semantic Tailwind, không hardcode hex.
5. **Dark/light mode** — Dùng tokens.css overrides hoặc `dark:` prefix, không tạo điều kiện JS.
6. **RBAC check** — Kiểm tra `capabilities` trước khi hiển thị buttons/actions nhạy cảm.

### 13.5 Build verification

Sau khi sửa code, verify theo thứ tự dependency:

```bash
pnpm --filter @qltb/contracts build
pnpm --filter @qltb/infra-postgres build
pnpm --filter @qltb/application build
pnpm --filter @qltb/api build
pnpm --filter @qltb/web-ui build
```

---

## 14. Patterns thường dùng

### API route pattern

```typescript
// apps/api/src/routes/v1/module/module.route.ts
fastify.get('/', {
    preHandler: [requireRole(['admin', 'it_asset_manager'])], // nếu cần
    schema: { querystring: ListQuerySchema, response: { 200: ListResponseSchema } }
}, async (request, reply) => {
    const items = await service.list(request.query)
    return reply.send({ success: true, data: items, meta: { total: items.length } })
})
```

### Frontend API call pattern

```typescript
// apps/web-ui/src/lib/api/module.ts
import { API_BASE, requireAccessToken } from './httpClient'

export async function listItems(params?: Record<string, unknown>) {
    const token = requireAccessToken()
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    const res = await fetch(`${API_BASE}/v1/module${qs ? '?' + qs : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data
}
```

### Svelte page pattern

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { _, isLoading } from '$lib/i18n'
  import { listItems } from '$lib/api/module'

  let items = $state<Item[]>([])
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    try {
      items = await listItems()
    } catch (e) {
      error = String(e)
    } finally {
      loading = false
    }
  })
</script>

{#if loading}
  <div class="skeleton-row" />
{:else if error}
  <div class="alert alert-error">{error}</div>
{:else}
  <!-- content -->
{/if}
```

### Repository pattern

```typescript
// packages/infra-postgres/src/repositories/ModuleRepo.ts
import type { Queryable } from './types.js'

export class ModuleRepo {
    constructor(private db: Queryable) {}  // Queryable, không phải PgClient

    async findAll(filters?: Filters): Promise<Item[]> {
        const result = await this.db.query<ItemRow>(
            `SELECT * FROM module_table WHERE deleted_at IS NULL`,
            []
        )
        return result.rows.map(mapRow)
    }
}
```

> Dùng `Queryable` thay vì `PgClient` trong constructor để Repo có thể dùng cả trong và ngoài transaction.

---

## 15. Ports & URLs (Dev)

| Service | URL | Ghi chú |
| --- | --- | --- |
| Web UI | `http://localhost:5173` | Dev server |
| API | `http://localhost:3000` | Fastify |
| Swagger | `http://localhost:3000/docs` | API documentation |
| pgAdmin | `http://localhost:8080` | DB admin UI |
| Test API | `http://localhost:4010` | E2E test API |
| Test Web | `http://localhost:4011` | E2E test web |

PostgreSQL: `localhost:5432` — DB `qltb` (dev), `qltb_test` (test)

Credentials: `postgres` / `postgres`

---

## 16. Cấu trúc file khi thêm feature mới

Ví dụ thêm module "Suppliers":

```text
1. DB:
   db/migrations/058_suppliers.sql          ← DDL only, idempotent

2. Contracts:
   packages/contracts/src/suppliers/
     ├── supplier.dto.ts                    ← SupplierDto, CreateSupplierInput
     └── index.ts

3. Infrastructure:
   packages/infra-postgres/src/repositories/
     └── SupplierRepo.ts                    ← implements ISupplierRepo, constructor(private db: Queryable)

4. Application:
   packages/application/src/suppliers/
     └── SupplierService.ts                 ← business logic

5. API:
   apps/api/src/routes/v1/suppliers/
     ├── suppliers.route.ts                 ← Fastify route handlers
     ├── suppliers.schemas.ts               ← Zod schemas
     └── index.ts
   → import và register trong assets.module.ts

6. Frontend:
   apps/web-ui/src/lib/api/
     └── suppliers.ts                       ← HTTP client functions
   apps/web-ui/src/routes/(assets)/suppliers/
     └── +page.svelte                       ← UI page (Svelte 5 runes)

7. i18n — thêm vào ĐÚNG split files:
   apps/web-ui/src/lib/i18n/locales/vi/assets.json   ← "suppliers": {...}
   apps/web-ui/src/lib/i18n/locales/en/assets.json   ← mirror
   (hoặc tạo vi/suppliers.json + en/suppliers.json nếu domain đủ lớn,
    rồi register trong index.ts)
```

---

## 17. Các lỗi thường gặp & cách tránh

| Lỗi | Nguyên nhân | Cách tránh |
| --- | --- | --- |
| i18n key hiển thị dạng "Title Case" | Thêm key vào file sai (`vi.json` thay vì `vi/warehouse.json`) | Kiểm tra `index.ts` xem file nào được register |
| `Property 'transaction' does not exist on type 'Queryable'` | Repo dùng `PgClient.transaction()` nhưng nhận `Queryable` trong UnitOfWork | Dùng manual `BEGIN/COMMIT/ROLLBACK` qua `this.pg.query()` |
| Double interpolation `▲ ▲ Text` | Code prefix `'▲ '` + i18n value cũng có `▲` | Chỉ để arrow trong i18n value hoặc chỉ trong code, không cả hai |
| `{count}` hiển thị literal | Gọi `$_('key')` mà không truyền `{ values: { count: n } }` | `$_('key', { values: { count: n } })` |
| Build lỗi sau khi sửa contracts | Packages downstream chưa rebuild | Build theo thứ tự: contracts → infra-postgres → application → api |
| Assignment không được tạo sau khi post phiếu xuất | Đây là thiết kế đúng | Dùng "Gán tài sản" thủ công sau khi xuất kho |
