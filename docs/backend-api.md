# Backend API

## 1. Entry points

| File | Vai trò |
| --- | --- |
| [apps/api/src/main.ts](../apps/api/src/main.ts) | Entry point → `startServer()` |
| [apps/api/src/core/server.ts](../apps/api/src/core/server.ts) | DB connect, port listen |
| [apps/api/src/core/app.ts](../apps/api/src/core/app.ts) | `createApp()` — register plugins, hooks, modules |
| [apps/api/src/config/env.ts](../apps/api/src/config/env.ts) | Zod env validation |

## 2. Cấu hình môi trường

DB connection có 2 cách:

- `DATABASE_URL` — connection string đầy đủ
- Hoặc `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`

Redis: `REDIS_URL` (fallback `redis://localhost:6379`).

Dev bypass auth: `DISABLE_AUTH=true` hoặc `VITE_DISABLE_AUTH=true`.

## 3. Auth

Auth hook tại `apps/api/src/core/middleware/api-auth.hook.ts` áp dụng cho `/api/v1/*`, bỏ qua:

- `OPTIONS` (CORS preflight)
- Đường dẫn ngoài `/api/v1/*`
- `/api/v1/auth/*` (login, refresh, logout)

JWT payload: `{ sub: uuid, email, role, iat, exp }`.

Token flow:

```text
POST /api/v1/auth/login    → { accessToken }  +  Set-Cookie: refreshToken (HttpOnly)
POST /api/v1/auth/refresh  → { accessToken }  (dùng cookie)
POST /api/v1/auth/logout   → xóa cookie
```

## 4. Response format

Mọi route phải trả về format chuẩn qua utils tại `apps/api/src/shared/utils/response.utils.ts`:

```typescript
// Success
{ success: true, data: T, meta?: { total?, page?, limit? } }

// Error
{ success: false, error: { code: string, message: string } }
```

## 5. Route pattern

```typescript
// apps/api/src/routes/v1/<module>/<module>.route.ts
fastify.get('/', {
    preHandler: [requireRole(['admin', 'it_asset_manager'])],
    schema: {
        querystring: ListQuerySchema,
        response: { 200: ListResponseSchema }
    }
}, async (request, reply) => {
    const items = await service.list(request.query)
    return reply.send({ success: true, data: items, meta: { total: items.length } })
})
```

## 6. Error classes

Dùng các lớp error có sẵn trong `apps/api/src/shared/errors/`:

| Class | HTTP status |
| --- | --- |
| `NotFoundError` | 404 |
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `ConflictError` | 409 |

## 7. Service pattern (Clean Architecture)

Routes không được gọi repo trực tiếp — phải qua service:

```typescript
// Route → Service
const service = new AssetService(new AssetRepo(pgClient), new CatalogRepo(pgClient))

// Service → Repository
class AssetService {
    constructor(private repo: IAssetRepo) {}
    async list(filters: AssetFilters): Promise<Asset[]> {
        return this.repo.findAll(filters)
    }
}

// Repository — dùng Queryable thay vì PgClient cụ thể
class AssetRepo {
    constructor(private db: Queryable) {}
    async findAll(filters: AssetFilters) {
        const result = await this.db.query<AssetRow>(`SELECT * FROM assets WHERE ...`, [])
        return result.rows.map(mapRow)
    }
}
```

`Queryable` interface cho phép repo hoạt động cả trong và ngoài transaction.

## 8. WarehouseTransactionContext

Context inject vào mỗi database transaction của warehouse:

```typescript
interface WarehouseTransactionContext {
    documents:   IStockDocumentRepo
    stock:       IStockRepo
    movements:   IMovementRepo
    repairs:     IRepairOrderRepo
    repairParts: IRepairPartRepo
    assets:      IAssetRepo
    opsEvents?:  IOpsEventRepo
}
```

`IAssignmentRepo` **không** nằm trong context này — assignment được tạo thủ công, không tự động từ phiếu kho.

## 9. RBAC (server-side)

Role-based: dùng `requireRole([...])` preHandler trên route cần restrict.

Roles hệ thống: `root`, `admin`, `super_admin`, `it_asset_manager`, `warehouse_keeper`, `technician`, `requester`, `user`, `viewer`.

Policy system (AD model): `admin` và `super_admin` có `isAdmin=true` cho routing, nhưng permissions thực tế đến từ `effectivePerms` (DENY/ALLOW policies có thể override).

## 10. Build

```bash
pnpm build:api
```

Output: `apps/api/dist/main.js` (tsup bundle).

Swagger UI: <http://localhost:3000/docs> (dev).
