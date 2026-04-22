# QLTB — Quản Lý Thiết Bị
## Hệ thống IT Asset Management cho Doanh nghiệp

> **Tài liệu thuyết minh kỹ thuật** — Mô tả chi tiết kiến trúc, tính năng, và code

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Stack công nghệ](#2-stack-công-nghệ)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Cấu trúc monorepo](#4-cấu-trúc-monorepo)
5. [Database Design](#5-database-design)
6. [Luồng xử lý Request](#6-luồng-xử-lý-request)
7. [Authentication & RBAC](#7-authentication--rbac)
8. [Các module chức năng](#8-các-module-chức-năng)
9. [Workflow Engine](#9-workflow-engine)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Infrastructure Layer](#11-infrastructure-layer)
12. [Testing](#12-testing)
13. [Deployment & DevOps](#13-deployment--devops)
14. [Thống kê dự án](#14-thống-kê-dự-án)

---

## 1. Tổng quan dự án

**QLTB** (Quản Lý Thiết Bị) là hệ thống **IT Asset Management** toàn diện dành cho doanh nghiệp vừa và nhỏ, được xây dựng từ đầu theo **Clean Architecture** trên kiến trúc **monorepo** với **pnpm workspaces**.

### Vấn đề được giải quyết

Doanh nghiệp thường gặp khó khăn trong việc:
- Theo dõi vòng đời thiết bị (nhập → phân công → bảo trì → thanh lý)
- Quản lý kho linh kiện, phụ tùng
- Phê duyệt đa bước khi mua sắm / yêu cầu thiết bị
- Kiểm kê tài sản định kỳ
- Tuân thủ quy định RBAC / audit trail

### Phạm vi hệ thống

| Module | Chức năng chính |
|--------|----------------|
| **Assets** | Vòng đời thiết bị, CRUD, gán người dùng, timeline |
| **Catalogs** | Loại thiết bị, model, vendor, vị trí, trạng thái |
| **CMDB** | Configuration Items, relationships, topology, services |
| **Warehouse** | Kho, phiếu nhập/xuất, tồn kho, sổ kho |
| **Maintenance** | Ticket bảo trì, lệnh sửa chữa |
| **Inventory** | Kiểm kê tài sản định kỳ |
| **Labels** | In nhãn tài sản (barcode/QR), template quản lý |
| **Licenses** | Quản lý bản quyền phần mềm, phân bổ seat |
| **Depreciation** | Khấu hao tài sản (nhiều phương pháp) |
| **Accessories** | Thiết bị phụ kiện, checkout/checkin |
| **Components** | Linh kiện (RAM, HDD…), lắp/tháo |
| **Consumables** | Vật tư tiêu hao, cấp phát |
| **Checkout** | Mượn/trả tài sản, gia hạn, chuyển giao |
| **Workflow** | Phê duyệt đa bước, inbox duyệt |
| **Analytics** | Dashboard, cost analysis, metrics |
| **Automation** | Rules engine, scheduled tasks |
| **Security** | RBAC, audit log, compliance |
| **Integrations** | Connectors, sync rules, webhooks |

---

## 2. Stack công nghệ

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  SvelteKit 2 + Svelte 5 (runes)   TailwindCSS 3.4               │
│  ECharts 6   Cytoscape 3.30   XYFlow   Mermaid                  │
│  svelte-i18n (vi/en)   Zod                                      │
├─────────────────────────────────────────────────────────────────┤
│                          API                                     │
│  Fastify 5   Node.js 20+   TypeScript                           │
│  JWT   bcryptjs   Zod   Pino (logging)                          │
│  @fastify/swagger   @fastify/multipart                          │
├─────────────────────────────────────────────────────────────────┤
│                        STORAGE                                   │
│  PostgreSQL 16          Redis 7                                  │
│  pg driver (pg pool)    ioredis / Bull                           │
├─────────────────────────────────────────────────────────────────┤
│                       TOOLING                                    │
│  pnpm workspaces   tsup   Vite   Docker Compose                 │
│  Playwright (E2E)   Vitest (unit)                               │
└─────────────────────────────────────────────────────────────────┘
```

### Lý do lựa chọn công nghệ

| Công nghệ | Lý do chọn |
|-----------|-----------|
| **Svelte 5** | Zero-runtime reactive, runes syntax rõ ràng, build size nhỏ |
| **Fastify 5** | ~30% nhanh hơn Express, schema-first validation tích hợp sẵn |
| **PostgreSQL 16** | ACID, JSON support tốt, full-text search, window functions |
| **Redis** | Cache report nặng, Bull queue cho async tasks |
| **pnpm workspaces** | Tiết kiệm disk, hoisting thông minh, monorepo management |
| **tsup** | Build TypeScript cực nhanh, CJS + ESM dual output |
| **Zod** | Runtime validation dùng chung client-server, TypeScript-first |

---

## 3. Kiến trúc hệ thống

### 3.1 Clean Architecture

Dự án tuân thủ nghiêm ngặt **Clean Architecture** với 4 layer:

```
┌────────────────────────────────────────────────────────────┐
│  ROUTES LAYER  (apps/api/src/routes/v1/)                   │
│  Fastify handlers, Zod schema validation, HTTP adapters    │
│                  ↓ calls                                   │
├────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER  (@qltb/application)                    │
│  Business logic, Service classes, IRepository interfaces   │
│                  ↓ calls                                   │
├────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER  (@qltb/infra-postgres)              │
│  Repository implementations, PgClient, SQL queries         │
│                  ↓ calls                                   │
├────────────────────────────────────────────────────────────┤
│  DATABASE  (PostgreSQL 16)                                 │
│  ~50 tables, views, indexes, constraints                   │
└────────────────────────────────────────────────────────────┘

         ↑  tất cả layers dùng chung
┌────────────────────────────────────────────────────────────┐
│  CONTRACTS  (@qltb/contracts)                              │
│  DTOs, Interfaces, Enums — single source of truth         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  DOMAIN  (@qltb/domain)                                    │
│  Pure business entities, Value Objects, custom Errors      │
│  KHÔNG import bất kỳ package nào trong monorepo           │
└────────────────────────────────────────────────────────────┘
```

**Dependency rule:** Mũi tên chỉ đi từ ngoài vào trong. Route không bao giờ import trực tiếp từ infra-postgres.

### 3.2 Bounded Context Factories

`assets.module.ts` được tách thành 6 **context factories** để giảm coupling:

```typescript
// assets.module.ts — thin orchestrator (27 dòng)
export async function registerAssetModule(fastify, deps) {
    const { assetService } = await registerAssetsContext(fastify, deps.pgClient)
    await registerWarehouseContext(fastify, deps.pgClient, { assetService })
    await registerCmdbContext(fastify, deps.pgClient, deps.cache)
    await registerAdvancedContext(fastify, deps.pgClient)
    await registerContentContext(fastify, deps.pgClient)
    await registerInventoryContext(fastify, deps.pgClient)
}
```

| Context Factory | Trách nhiệm |
|----------------|------------|
| `assets.context.ts` | Core assets, catalog, maintenance, inventory, QLTS DI |
| `warehouse.context.ts` | Warehouse, stock documents, repair orders, reports |
| `cmdb.context.ts` | CMDB core + enhancement + cached report services |
| `advanced.context.ts` | Analytics, automation, integrations, security, comms |
| `content.context.ts` | Documents, labels |
| `inventory.context.ts` | Accessories, audit, checkout, components, consumables, depreciation, licenses, wf |

---

## 4. Cấu trúc monorepo

```
QuanLyThietBi/
├── apps/
│   ├── api/                        # @qltb/api — Fastify backend
│   │   └── src/
│   │       ├── main.ts             # Entry → startServer()
│   │       ├── config/env.ts       # Zod env validation (13 vars)
│   │       ├── core/
│   │       │   ├── app.ts          # createApp() — plugins, hooks, modules
│   │       │   ├── server.ts       # startServer() — DB connect, listen
│   │       │   ├── middleware/     # 5 hooks + error handler
│   │       │   └── plugins/        # security, docs, redis
│   │       └── routes/
│   │           ├── setup/          # /api/setup — First-time wizard
│   │           └── v1/             # /api/v1 — 448 endpoints
│   │               ├── assets/     # 6 context factories
│   │               ├── accessories/
│   │               ├── audit/
│   │               ├── checkout/
│   │               ├── cmdb/
│   │               ├── components/
│   │               ├── consumables/
│   │               ├── depreciation/
│   │               ├── documents/
│   │               ├── labels/
│   │               ├── licenses/
│   │               ├── maintenance/
│   │               ├── warehouse/
│   │               └── wf/
│   │
│   └── web-ui/                     # @qltb/web-ui — SvelteKit SPA
│       └── src/
│           ├── app.html            # Anti-FOUC theme script
│           ├── app.css             # Global styles + component layer
│           ├── routes/
│           │   ├── (assets)/       # 16 module pages (sidebar layout)
│           │   ├── login/          # Shellless
│           │   ├── setup/          # First-time wizard
│           │   └── print/          # Shellless print view
│           └── lib/
│               ├── api/            # 30+ typed HTTP client modules
│               ├── auth/           # capabilities.ts — client RBAC matrix
│               ├── components/     # Shared UI components
│               ├── i18n/           # vi.json + en.json locales
│               ├── rbac/           # Permission engine
│               └── stores/         # themeStore, authStore, permsStore
│
└── packages/                       # Clean Architecture layers
    ├── contracts/                  # @qltb/contracts — 70 TS files
    │   └── src/
    │       ├── assets/             # Asset DTOs, enums
    │       ├── accessories/        # Accessory types
    │       ├── audit/              # Audit session types
    │       ├── checkout/           # Checkout types
    │       ├── cmdb/               # CI, relationship, service types
    │       ├── documents/          # Knowledge base types
    │       ├── labels/             # Label template types
    │       ├── licenses/           # License types
    │       ├── wf/                 # Workflow types & enums
    │       └── ...                 # 20+ more modules
    │
    ├── domain/                     # @qltb/domain — Pure business logic
    │   └── src/
    │       ├── core/errors/        # AppError (badRequest, notFound, …)
    │       └── entities/           # Domain entities
    │
    ├── application/                # @qltb/application — 337 KB bundled
    │   └── src/
    │       ├── assets/             # AssetService, CatalogService, …
    │       ├── accessories/        # AccessoryService + IAccessoryRepository
    │       ├── audit/              # AuditService + IAuditRepository
    │       ├── wf/                 # WfService (workflow engine)
    │       ├── cmdb/               # 8 CMDB services + caching
    │       └── ...                 # 17 domain service groups
    │
    └── infra-postgres/             # @qltb/infra-postgres — Data Access
        └── src/
            ├── PgClient.ts         # Connection pool + transactions
            ├── schema.sql          # Base DDL (~50 tables)
            ├── migrations/         # 020–042 package migrations
            └── repositories/       # 75 Repo classes
```

---

## 5. Database Design

### 5.1 Tổng quan schema

```
~50 bảng, được nhóm theo domain:

┌─ CORE ──────────────────────────────────────────┐
│  users, organizations, roles, permissions        │
│  locations, vendors, departments                 │
└─────────────────────────────────────────────────┘
┌─ ASSETS ────────────────────────────────────────┐
│  assets, asset_assignments, asset_events        │
│  asset_categories, asset_models, asset_statuses │
│  category_specs, category_spec_versions         │
│  attachments, audit_logs                        │
└─────────────────────────────────────────────────┘
┌─ WAREHOUSE ─────────────────────────────────────┐
│  warehouses, spare_parts, spare_part_lots       │
│  stock_receipts, stock_issues, stock_movements  │
│  stock_documents, repair_orders, repair_parts   │
└─────────────────────────────────────────────────┘
┌─ CMDB ──────────────────────────────────────────┐
│  ci_types, ci_type_versions, ci_schemas         │
│  configuration_items, ci_attr_values            │
│  relationship_types, relationships              │
│  cmdb_services, cmdb_changes                    │
└─────────────────────────────────────────────────┘
┌─ WORKFLOW ──────────────────────────────────────┐
│  wf_definitions, wf_steps                      │
│  wf_requests, wf_request_lines                 │
│  wf_approvals, wf_events                       │
└─────────────────────────────────────────────────┘
┌─ EXTENDED MODULES ──────────────────────────────┐
│  accessories, accessory_checkouts               │
│  components, component_assignments              │
│  consumables, consumable_issues                 │
│  label_templates, print_jobs, print_job_items   │
│  licenses, license_seats                        │
│  depreciation_schedules, depreciation_entries   │
│  audit_sessions, audit_items                    │
└─────────────────────────────────────────────────┘
┌─ SECURITY ──────────────────────────────────────┐
│  rbac_permissions, rbac_roles_permissions       │
│  security_audit_logs, compliance_records        │
│  org_units, rbac_groups, rbac_memberships       │
└─────────────────────────────────────────────────┘
```

### 5.2 Migration strategy

```
pnpm db:reset = db:empty → db:migrate → db:seed

Migration order:
  1. packages/infra-postgres/src/schema.sql    (base ~50 tables)
  2. packages/infra-postgres/src/migrations/   (020–042, package-level DDL)
  3. db/migrations/007–062                     (31 app migrations)
  4. db/migrations/2026xxxx_*.sql              (dated hot-fix patches)
```

**Quy tắc migration:**
- **Chỉ DDL** — Không bao giờ INSERT trong migration
- **Idempotent** — `IF NOT EXISTS` / `IF EXISTS` để re-run an toàn
- **Append-only** — Không sửa migration cũ, chỉ thêm migration mới
- **Numbered** — File mới: `058_description.sql` (tiếp nối số cuối)
- **Dated patch** — Fix khẩn: `20260312_001_desc.sql`

### 5.3 Seed data phân tầng

```sql
-- Tầng 1: Foundation data
db/seed-data.sql
  → users (admin, it_manager, user)
  → locations, vendors, statuses
  → organizations, roles

-- Tầng 2: Asset management demo
db/seed-assets-management.sql
  → 40+ tables: assets, assignments, warehouse, maintenance

-- Tầng 3: Advanced features demo
db/seed-qlts-demo.sql
  → CMDB (CIs, relationships, services)
  → Workflow definitions & demo requests
```

---

## 6. Luồng xử lý Request

### 6.1 HTTP Request Flow

```
Browser (SvelteKit SPA)
  │  HTTP/REST — Authorization: Bearer <JWT>
  ▼
Fastify (apps/api, port 3000)
  │
  ├─ Hook 1: requestIdHook
  │    → gen x-request-id (UUID) nếu chưa có
  │
  ├─ Hook 2: createApiV1AuthHook  ← QUAN TRỌNG
  │    → Skip: OPTIONS, non /api/v1/*, /api/v1/auth/*
  │    → Verify JWT Bearer token
  │    → Lookup user từ DB (kiểm tra status = 'active')
  │    → Set: request.user = { id, email, role, status, permissions }
  │
  ├─ Hook 3: contextHook
  │    → Attach: request.pgClient (PgClient instance)
  │
  ├─ Hook 4: requestLogHook
  │    → Log: method, url, userId, requestId
  │
  ├─ Hook 5: responseTimeHook
  │    → Đo thời gian xử lý (ms)
  │
  ├─ Route Handler (routes/v1/**/*.route.ts)
  │    → Zod schema validation (body/params/query)
  │    → Gọi Service (packages/application/)
  │         → Gọi Repository (packages/infra-postgres/)
  │               → PostgreSQL (pg pool query)
  │
  ├─ Nếu thành công:
  │    → { success: true, data: {...}, meta?: { total, page, limit } }
  │
  └─ Nếu lỗi (setErrorHandler):
       → { success: false, error: { code: string, message: string } }
```

### 6.2 Authentication Flow

```
1. POST /api/v1/auth/login
   Body: { email, password }
   Response: { accessToken, refreshToken, user }
   → Lưu vào localStorage:
     'authToken', 'refreshToken', 'userEmail', 'userRole', 'userName'

2. Mọi request sau:
   Header: Authorization: Bearer <accessToken>

3. Token hết hạn:
   → httpClient tự động gọi POST /api/v1/auth/refresh
   → Singleton refreshingPromise (ngăn parallel refresh)
   → Retry request gốc với token mới

4. Refresh thất bại:
   → clearStoredSession() → redirect /login
```

**Code httpClient (frontend):**

```typescript
// apps/web-ui/src/lib/api/httpClient.ts
let refreshingPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
    // Singleton pattern — chỉ 1 refresh tại 1 thời điểm
    if (!refreshingPromise) {
        refreshingPromise = doRefresh().finally(() => {
            refreshingPromise = null
        })
    }
    return refreshingPromise
}
```

### 6.3 PgClient — Database Abstraction

```typescript
// packages/infra-postgres/src/PgClient.ts
export class PgClient {
    // Connection pool với Zod-validated config
    constructor(config: PgConfig) {
        this.pool = new Pool({
            connectionString, max: 10, min: 2,
            idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000
        })
    }

    // Tự động cảnh báo slow query > 1000ms
    async query<T>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const start = Date.now()
        const result = await this.pool.query<T>(text, params)
        if (Date.now() - start > 1000) {
            console.warn('Slow query detected', { text, duration })
        }
        return result
    }

    // Transaction helper: BEGIN → callback → COMMIT (tự ROLLBACK nếu lỗi)
    async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient()
        try {
            await client.query('BEGIN')
            const result = await callback(client)
            await client.query('COMMIT')
            return result
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    async healthCheck(): Promise<boolean> {
        const result = await this.query('SELECT 1 as health')
        return result.rows.length === 1
    }
}
```

---

## 7. Authentication & RBAC

### 7.1 JWT-Based Authentication

```
Access Token (JWT):
  payload: { sub: userId, email, role, iat, exp }
  secret: JWT_SECRET (env var)
  expiry: 15 phút (short-lived)

Refresh Token (JWT):
  payload: { sub: userId }
  secret: JWT_REFRESH_SECRET
  expiry: 7 ngày

Lưu trữ: localStorage (accessToken, refreshToken)
```

### 7.2 Role Matrix

| Role | Tài sản | Kho | Bảo trì | CMDB | Phê duyệt | Admin |
|------|---------|-----|---------|------|----------|-------|
| `super_admin` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| `admin` | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| `it_asset_manager` | ✅ Full | ✅ Read | ✅ Full | ✅ Full | ✅ Approve | ❌ |
| `warehouse_keeper` | 👁 Read | ✅ Full | 👁 Read | ❌ | ❌ | ❌ |
| `technician` | 👁 Read | 👁 Read | ✅ Full | 👁 Read | ❌ | ❌ |
| `requester` | 👁 Read | ❌ | ❌ | ❌ | ✅ Submit | ❌ |
| `viewer` | 👁 Read | ❌ | ❌ | 👁 Read | ❌ | ❌ |

### 7.3 AD-style RBAC (nâng cao)

Ngoài role đơn giản, hệ thống còn có **AD-style RBAC**:

```
OrgUnit (phòng ban)
  └── RbacGroup (nhóm quyền)
       └── RbacMembership (user → group)
            └── AdRole (vai trò)
                 └── AdPermission (quyền cụ thể)
                      └── ACL (access control list)
```

**Permission format:** `resource:action` — ví dụ `assets:create`, `reports:export`, `admin:users`

**Client-side RBAC check:**
```typescript
// apps/web-ui/src/lib/auth/capabilities.ts
const caps = getCapabilities(userRole) // từ localStorage
if (caps.assets.canCreate) {
    // Hiển thị nút "Thêm thiết bị"
}
```

---

## 8. Các module chức năng

### 8.1 Assets Module — Lõi hệ thống

**Tính năng:**
- CRUD đầy đủ với phân trang, tìm kiếm, lọc đa tiêu chí
- Gán (assign) thiết bị cho user/phòng ban
- Timeline sự kiện: mua, giao, bảo trì, trả, thanh lý
- Import hàng loạt từ CSV/Excel
- Export báo cáo

**API mẫu:**
```
GET  /api/v1/assets              # Danh sách với filter, sort, paginate
POST /api/v1/assets              # Tạo thiết bị mới
GET  /api/v1/assets/:id          # Chi tiết
PUT  /api/v1/assets/:id          # Cập nhật
GET  /api/v1/assets/:id/timeline # Lịch sử sự kiện
POST /api/v1/assets/import       # Import từ file
```

**Repository pattern:**
```typescript
// packages/infra-postgres/src/repositories/AssetRepo.ts
export class AssetRepo {
    constructor(private db: PgClient) {}

    async findAll(filters: AssetListQuery): Promise<{ data: Asset[], total: number }> {
        const { page = 1, limit = 20, search, statusId, categoryId } = filters

        const conditions: string[] = ['a.deleted_at IS NULL']
        const params: unknown[] = []

        if (search) {
            conditions.push(`(a.asset_code ILIKE $${++n} OR a.hostname ILIKE $${n})`)
            params.push(`%${search}%`)
        }
        // … dynamic WHERE building

        const result = await this.db.query(`
            SELECT a.*, COUNT(*) OVER() as total_count
            FROM assets a
            LEFT JOIN asset_categories c ON a.category_id = c.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY a.created_at DESC
            LIMIT $${++n} OFFSET $${++n}
        `, [...params, limit, (page - 1) * limit])

        return {
            data: result.rows.map(this.mapRow),
            total: result.rows[0]?.total_count ?? 0
        }
    }
}
```

### 8.2 CMDB Module — Configuration Management Database

**Tính năng:**
- Quản lý Configuration Items (CI) theo schema động
- Định nghĩa kiểu CI (CI Type) với attributes schema
- Quan hệ giữa các CI (depends_on, runs_on, part_of…)
- Visualize topology bằng **Cytoscape.js**
- Service mapping: CI nào hỗ trợ service nào
- Change management tracking
- Reports: CI inventory, relationship analytics, audit trail

**Schema động (JSON Schema):**
```typescript
// CiType định nghĩa các thuộc tính của CI
interface CiTypeVersion {
    schema: {
        attributes: {
            name: string
            type: 'string' | 'number' | 'boolean' | 'date' | 'select'
            required: boolean
            options?: string[]  // cho type: 'select'
        }[]
    }
}

// CI lưu giá trị theo schema này
interface CiAttrValue {
    ciId: string
    attrName: string
    valueString?: string
    valueNumber?: number
    valueBoolean?: boolean
}
```

### 8.3 Warehouse Module — Quản lý kho

**Tính năng:**
- Quản lý kho, vị trí kho
- Linh kiện (spare parts) với lot tracking
- Phiếu nhập kho (stock receipt)
- Phiếu xuất kho (stock issue)
- Lệnh sửa chữa (repair orders) — tích hợp xuất kho linh kiện
- Báo cáo tồn kho, sổ kho

**Transaction ví dụ (StockDocumentService):**
```typescript
// packages/application/src/maintenanceWarehouse/StockDocumentService.ts
async issueStock(dto: IssueStockDto): Promise<IssueResult> {
    return this.warehouseUow.transaction(async (client) => {
        // 1. Kiểm tra tồn kho
        const stock = await this.stockRepo.findByWarehouseAndPart(
            dto.warehouseId, dto.sparePartId, client
        )
        if (stock.quantity < dto.quantity) {
            throw AppError.badRequest('Insufficient stock')
        }

        // 2. Tạo phiếu xuất
        const document = await this.stockDocumentRepo.create(dto, client)

        // 3. Trừ tồn kho
        await this.stockRepo.decrement(
            dto.warehouseId, dto.sparePartId, dto.quantity, client
        )

        // 4. Ghi chuyển động kho
        await this.movementRepo.record({
            documentId: document.id,
            type: 'issue',
            quantity: dto.quantity
        }, client)

        return { success: true, document }
    })
}
```

### 8.4 Labels Module — In nhãn tài sản

**Tính năng:**
- Quản lý template nhãn (barcode, QR code, combined)
- Kích thước: small/medium/large/custom (mm)
- Layout editor: text, barcode, QR, image, line, rectangle
- Print job: tạo job → queue → xử lý → PDF output
- Preview nhãn trước khi in
- Validate tài sản có đủ dữ liệu cần thiết

```typescript
// packages/application/src/labels/LabelsService.ts
async createPrintJob(dto: CreatePrintJobDto): Promise<PrintJobResult> {
    // Kiểm tra template active
    const template = await this.repository.findTemplateById(dto.templateId)
    if (!template?.isActive) {
        return { success: false, error: 'Template is not active' }
    }

    // Kiểm tra max batch size từ settings
    const maxSize = parseInt(
        await this.getSettingValue('max_batch_size') || '500', 10
    )
    if (dto.assetIds.length > maxSize) {
        return { success: false, error: `Maximum ${maxSize} assets per job` }
    }

    // Tạo job + items trong 1 transaction
    const job = await this.repository.withTransaction(async (client) => {
        const printJob = await this.repository.createPrintJob(dto, client)
        await this.repository.createPrintJobItems(
            printJob.id, dto.assetIds, dto.copiesPerAsset || 1
        )
        return printJob
    })

    return { success: true, job }
}
```

---

## 9. Workflow Engine

### 9.1 Mô hình phê duyệt đa bước

```
Requester                   Approver(s)                  Admin
    │                           │                           │
    │ POST /wf/me/requests       │                           │
    │ (tạo nháp)                 │                           │
    │                           │                           │
    │ POST /submit               │                           │
    │──────────────────────────► │                           │
    │              [STEP 1]      │                           │
    │              approve? ─────┤                           │
    │                reject? ────┤                           │
    │                            │                           │
    │              [STEP 2]      │                           │
    │              approve? ─────┤                           │
    │                            │                           │
    │◄──────────── APPROVED ─────┘                           │
    │                                                        │
    │                              POST /cancel ─────────────►
```

**Trạng thái request:**

```
DRAFT → SUBMITTED → APPROVED → COMPLETED
                ↘ REJECTED
         WITHDRAWN (requester rút lại)
         CANCELLED (admin hủy)
```

### 9.2 Approval Rules

Mỗi workflow step có thể cấu hình người duyệt theo 4 cách:

| Rule Type | Ý nghĩa |
|-----------|---------|
| `user` | Gán trực tiếp cho 1 user cụ thể |
| `role` | Người đầu tiên có role đó (vd: `it_asset_manager`) |
| `ou_head` | Trưởng phòng của requester |
| `any_manager` | Bất kỳ admin/manager nào (fallback) |

### 9.3 Inbox & Claims

```typescript
// packages/application/src/wf/WfService.ts
async getInbox(userId: string, role: string): Promise<WfApproval[]> {
    // Admin/manager thấy tất cả pending approvals
    // User thường chỉ thấy approvals gán cho mình
    const viewAll = ['admin', 'super_admin', 'it_asset_manager'].includes(role)
    return this.repo.findInboxApprovals(userId, viewAll)
}

async claimApproval(approvalId: string, claimerId: string): Promise<void> {
    // Lấy approval từ unassigned pool (chỉ admin/manager)
    const approval = await this.repo.findApproval(approvalId)
    if (approval.assignedTo) throw new WfForbiddenError('Already claimed')
    await this.repo.reassignApproval(approvalId, claimerId)
}

async delegateApproval(approvalId: string, toUserId: string): Promise<void> {
    // Chuyển approval sang người khác
    await this.repo.reassignApproval(approvalId, toUserId)
    await this.repo.createEvent({
        type: 'DELEGATED', requestId, actorId, targetUserId: toUserId
    })
}
```

---

## 10. Frontend Architecture

### 10.1 Svelte 5 Runes

Toàn bộ frontend dùng **Svelte 5 runes** (không phải Svelte 4 stores cho local state):

```svelte
<!-- ✅ Svelte 5 — runes syntax -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { _, isLoading } from '$lib/i18n'
  import { listAssets } from '$lib/api/assets'

  let assets = $state<Asset[]>([])
  let loading = $state(true)
  let search = $state('')

  // Reactive derived value
  let filteredCount = $derived(
    assets.filter(a => a.name.includes(search)).length
  )

  // Side effect khi search thay đổi
  $effect(() => {
    if (search) debouncedFetch(search)
  })

  onMount(async () => {
    try {
      assets = await listAssets()
    } finally {
      loading = false
    }
  })
</script>

<!-- i18n với fallback khi đang load -->
<h1>{$isLoading ? 'Assets' : $_('assets.title')}</h1>
<p>{filteredCount} {$_('common.results')}</p>
```

### 10.2 Theme System (Dark/Light)

**Anti-FOUC script** trong `app.html` chạy trước khi render:
```html
<!-- app.html — inline script (không async) -->
<script>
  const theme = localStorage.getItem('theme') || 'dark'
  document.documentElement.classList.toggle('dark', theme === 'dark')
</script>
```

**Design tokens** (`tokens.css`):
```css
/* Dark mode là default */
:root {
    --color-surface-1: #1e293b;
    --color-surface-2: #0f172a;
    --color-text:      #f1f5f9;
    --color-border:    #334155;
}

/* Light mode override */
html:not(.dark) {
    --color-surface-1: #ffffff;
    --color-surface-2: #f8fafc;
    --color-text:      #0f172a;
    --color-border:    #e2e8f0;
}
```

**Tailwind custom tokens:**
```javascript
// tailwind.config.js
colors: {
    'surface-bg':  'var(--color-surface-bg)',
    'surface-1':   'var(--color-surface-1)',
    'surface-2':   'var(--color-surface-2)',
    'primary':     'var(--color-primary)',
    'success':     'var(--color-success)',
    'warning':     'var(--color-warning)',
    'error':       'var(--color-error)',
}
```

### 10.3 i18n (Đa ngôn ngữ)

Hỗ trợ **Tiếng Việt** và **Tiếng Anh** với `svelte-i18n`:

```typescript
// apps/web-ui/src/lib/i18n/locales/vi.json
{
    "assets": {
        "title": "Quản lý Thiết bị",
        "searchPlaceholder": "Mã tài sản, hostname, IP...",
        "filters": {
            "status": "Trạng thái",
            "inStock": "Trong kho",
            "inUse": "Đang sử dụng"
        }
    },
    "common": {
        "save": "Lưu",
        "cancel": "Hủy",
        "search": "Tìm kiếm",
        "loading": "Đang tải..."
    }
}
```

**Sử dụng trong component:**
```svelte
<script>
  import { _, isLoading } from '$lib/i18n'
</script>

<!-- Fallback text khi chưa load locale -->
<label for="search">
  {$isLoading ? 'Search' : $_('common.search')}
</label>
```

### 10.4 Vite Bundle Optimization

Tách chunks theo thư viện lớn để lazy-load:

```typescript
// apps/web-ui/vite.config.ts
build: {
    rollupOptions: {
        output: {
            manualChunks(id) {
                if (id.includes('echarts') || id.includes('zrender'))
                    return 'vendor-echarts'    // ~500KB
                if (id.includes('cytoscape'))
                    return 'vendor-cytoscape'  // ~300KB (topology graph)
                if (id.includes('@xyflow'))
                    return 'vendor-xyflow'     // ~200KB (flow diagram)
                if (id.includes('mermaid'))
                    return 'vendor-mermaid'    // ~400KB
                if (id.includes('mammoth'))
                    return 'vendor-mammoth'    // Word document parser
                if (id.includes('html2pdf') || id.includes('jspdf'))
                    return 'vendor-pdf'        // PDF export
            }
        }
    }
}
```

### 10.5 API Client Pattern

```typescript
// apps/web-ui/src/lib/api/assets.ts
import { API_BASE, requireAccessToken } from './httpClient'

export async function listAssets(params?: AssetListQuery) {
    const token = requireAccessToken()
    const qs = new URLSearchParams(params as any).toString()
    const res = await fetch(
        `${API_BASE}/v1/assets${qs ? '?' + qs : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data  // Unwrap { success: true, data: [...] }
}
```

---

## 11. Infrastructure Layer

### 11.1 Fastify App Bootstrap

```typescript
// apps/api/src/core/app.ts
export async function createApp(deps: AppDependencies): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: {
            level: env.LOG_LEVEL,
            transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined
        },
        genReqId: () => randomUUID()
    })

    // 1. Plugins: CORS, Helmet, Rate-limit, Multipart, Redis, Swagger
    await registerSecurity(fastify, { cors: true, helmet: true, rateLimit: {...} })
    await fastify.register(multipart)
    await fastify.register(redisPlugin)
    await registerDocs(fastify, { title: 'QuanLyThietBi API', version: '1.0.0' })

    // 2. Hooks (global middleware pipeline)
    fastify.addHook('onRequest', requestIdHook)
    fastify.addHook('onRequest', createApiV1AuthHook(deps.pgClient))  // JWT verify
    fastify.addHook('onRequest', contextHook)                          // attach pgClient
    fastify.addHook('onRequest', requestLogHook)
    fastify.addHook('preValidation', responseTimeHook)
    fastify.setErrorHandler(errorHandler)

    // 3. Modules
    await registerSetupModule(fastify, { pgClient: deps.pgClient })
    await registerAuthModule(fastify, { pgClient: deps.pgClient })
    await registerAssetModule(fastify, { pgClient: deps.pgClient, cache: fastify.cache })

    return fastify
}
```

### 11.2 Environment Validation

```typescript
// apps/api/src/config/env.ts
const EnvSchema = z.object({
    NODE_ENV:              z.enum(['development', 'test', 'production']).default('development'),
    PORT:                  z.coerce.number().default(3000),
    DATABASE_URL:          z.string().url(),          // ← BẮT BUỘC
    DATABASE_POOL_MAX:     z.coerce.number().default(10),
    LOG_LEVEL:             z.enum(['trace','debug','info','warn','error']).default('info'),
    DISABLE_AUTH:          z.enum(['true','false']).default('false'),
    ENABLE_RATE_LIMIT:     z.enum(['true','false']).default('false'),
    REDIS_URL:             z.string().default('redis://localhost:6379'),
    REDIS_CACHE_ENABLED:   z.enum(['true','false']).default('true'),
    REDIS_CACHE_TTL:       z.coerce.number().default(900),
    JWT_SECRET:            z.string().min(8).default('dev-access-secret-key'),
    JWT_REFRESH_SECRET:    z.string().min(8).optional(),
})

// Fail fast với message rõ ràng nếu env sai
export const env = (() => {
    const result = EnvSchema.safeParse(process.env)
    if (!result.success) {
        console.error('❌ Invalid environment variables:', result.error.format())
        process.exit(1)
    }
    return result.data
})()
```

### 11.3 Error Handling Pattern

```typescript
// packages/domain/src/core/errors/AppError.ts
export class AppError extends Error {
    constructor(
        public readonly code: string,
        public readonly httpStatus: number,
        message: string
    ) { super(message) }

    static badRequest(msg: string) { return new AppError('BAD_REQUEST', 400, msg) }
    static notFound(res: string)   { return new AppError('NOT_FOUND', 404, `${res} not found`) }
    static forbidden(msg: string)  { return new AppError('FORBIDDEN', 403, msg) }
    static conflict(msg: string)   { return new AppError('CONFLICT', 409, msg) }
}

// apps/api/src/core/middleware/error.handler.ts
fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
        return reply.status(error.httpStatus).send({
            success: false,
            error: { code: error.code, message: error.message }
        })
    }
    if (error instanceof ZodError) {
        return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: error.errors }
        })
    }
    // Fallback: 500 Internal Server Error
    reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR' } })
})
```

---

## 12. Testing

### 12.1 Test Strategy

```
┌─────────────────────────────────────────────────────────┐
│  Playwright E2E Tests (65 test files)                   │
│                                                         │
│  Project: api       → tests/api/      → port 4010      │
│  Project: chromium  → tests/ui/       → port 4011      │
│                                                         │
│  Auto-start: pnpm dev (API) + vite dev (Web) khi test  │
├─────────────────────────────────────────────────────────┤
│  Vitest Unit Tests                                      │
│                                                         │
│  packages/application/src/**/*.test.ts                  │
│  apps/api/src/**/*.test.ts                              │
│  apps/web-ui/src/**/*.test.ts                           │
└─────────────────────────────────────────────────────────┘
```

### 12.2 API Test ví dụ

```typescript
// tests/api/assets.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Assets API', () => {
    let authToken: string

    test.beforeAll(async ({ request }) => {
        const email = process.env.E2E_ADMIN_EMAIL ?? '<admin-email-from-env>'
        const password = process.env.E2E_ADMIN_PASSWORD ?? '<admin-password-from-env>'
        const res = await request.post('/api/v1/auth/login', {
            data: { email, password }
        })
        authToken = (await res.json()).accessToken
    })

    test('GET /api/v1/assets returns paginated list', async ({ request }) => {
        const res = await request.get('/api/v1/assets', {
            headers: { Authorization: `Bearer ${authToken}` }
        })
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(body.success).toBe(true)
        expect(Array.isArray(body.data)).toBe(true)
        expect(body.meta).toHaveProperty('total')
    })

    test('POST /api/v1/assets creates asset', async ({ request }) => {
        const res = await request.post('/api/v1/assets', {
            headers: { Authorization: `Bearer ${authToken}` },
            data: {
                assetCode: 'TEST-001',
                name: 'Test Laptop',
                categoryId: 'valid-uuid'
            }
        })
        expect(res.status()).toBe(201)
    })
})
```

### 12.3 Commands

```bash
pnpm test:api     # API E2E (port 4010)
pnpm test:ui      # UI E2E (port 4011)
pnpm test:e2e     # Tất cả
npx playwright test --grep "@smoke"    # Chỉ smoke tests
npx playwright show-report             # HTML report
pnpm test:typecheck                    # TypeScript check
pnpm test:lint                         # ESLint
```

---

## 13. Deployment & DevOps

### 13.1 Docker Compose (6 services)

```yaml
# docker-compose.yml
services:
  postgres:          # PostgreSQL 16 Alpine
    image: postgres:16-alpine
    healthcheck:
      test: pg_isready -U postgres

  redis:             # Redis 7 Alpine — 256MB LRU
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  api:               # Fastify Node.js 20
    build: apps/api/
    ports: [3000:3000]
    healthcheck:
      test: wget -qO- http://localhost:3000/health/ready
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }

  web-ui:            # SvelteKit (SSR disabled — SPA mode)
    build: apps/web-ui/
    ports: [3001:3001]
    depends_on:
      api: { condition: service_healthy }

  pgadmin:           # pgAdmin 4 — port 8080
    image: dpage/pgadmin4:latest

  redis-insight:     # Redis Insight — port 8001
    image: redis/redisinsight:latest
```

### 13.2 Ports Reference

| Service | Dev Port | Production | Ghi chú |
|---------|----------|------------|---------|
| Web UI | 5173 | 3001 | SPA mode |
| API | 3000 | 3000 | Fastify |
| Swagger | 3000/docs | 3000/docs | OpenAPI |
| PostgreSQL | 5432 | 5432 | DB: `qltb` |
| Redis | 6379 | 6379 | Cache + Queue |
| pgAdmin | 8080 | 8080 | DB admin |
| Redis Insight | 8001 | 8001 | Cache viewer |
| Test API | 4010 | — | Playwright |
| Test Web | 4011 | — | Playwright |

### 13.3 Dev Commands

```bash
# Khởi động infrastructure (DB + Redis)
pnpm dev:infra

# Phát triển đồng thời API + Web
pnpm dev:all

# Hoặc riêng từng service
pnpm dev          # API (port 3000)
pnpm dev:web      # Web UI (port 5173)

# Database
pnpm db:reset     # empty → migrate → seed
pnpm db:migrate   # Chạy tất cả migrations
pnpm db:seed      # Seed demo data

# Build
pnpm build        # Build tất cả packages + apps
pnpm build:api    # Build API với tsup
pnpm build:web    # Build Web UI với Vite
```

---

## 14. Thống kê dự án

### Metrics tổng quan

| Metric | Số liệu |
|--------|---------|
| Tổng số file TS/Svelte | ~862 files |
| Tổng dòng code | ~56,180 dòng |
| API endpoints | **448 routes** |
| Database tables | ~50 bảng |
| Migration files | 39 files (007–062 + 3 patches) |
| Repository classes | **75 classes** |
| Application services | **17+ service groups** |
| Contracts types/DTOs | 70 TypeScript files |
| Frontend pages | 16 modules + 4 shellless |
| Docker services | 6 containers |
| Test files (Playwright) | 65 spec files |
| i18n keys | vi.json + en.json |
| Supported roles | 8 roles |

### Code phân tầng

| Layer | Package | Vai trò |
|-------|---------|---------|
| Routes | `@qltb/api` (apps/api) | HTTP handlers, Zod validation |
| Application | `@qltb/application` | Business logic, 337 KB bundled |
| Infrastructure | `@qltb/infra-postgres` | 75 repositories, SQL |
| Contracts | `@qltb/contracts` | DTOs, enums, interfaces |
| Domain | `@qltb/domain` | Entities, errors thuần |
| Frontend | `@qltb/web-ui` | 243 Svelte components |

### Dependency highlights

| Thư viện | Vai trò | Tại sao chọn |
|----------|---------|-------------|
| Fastify 5 | API framework | ~30% faster than Express, schema-first |
| Svelte 5 | UI framework | Zero-runtime reactive, runes |
| PostgreSQL 16 | Database | ACID, JSON, full-text, window functions |
| Zod | Validation | TypeScript-native, client-server shared |
| pnpm workspaces | Monorepo | Efficient hoisting, strict isolation |
| ECharts 6 | Charts | Performance với data lớn |
| Cytoscape 3.30 | Topology graph | Mature, performant, force-directed layout |
| XYFlow | Flow diagram | Svelte-native, interactive |

---

## Tài khoản Demo (sau seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | lấy từ biến môi trường local/test |
| IT Manager | it_manager@example.com | lấy từ biến môi trường local/test |
| User | user@example.com | lấy từ biến môi trường local/test |

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/babasida246/quanlythietbi.git
cd quanlythietbi
pnpm install

# 2. Copy env
cp .env.example .env

# 3. Start infrastructure
pnpm dev:infra    # PostgreSQL + Redis

# 4. Initialize database
pnpm db:reset     # migrate + seed

# 5. Start development
pnpm dev:all      # API (3000) + Web (5173)

# Access
# Web UI:  http://localhost:5173
# API:     http://localhost:3000
# Swagger: http://localhost:3000/docs
# pgAdmin: http://localhost:8080
```

---

*QLTB — Xây dựng theo Clean Architecture, đủ quy mô cho doanh nghiệp vừa và nhỏ.*
