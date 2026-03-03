# 06 - Security RBAC Audit

## Muc luc
- [1. Auth flow](#1-auth-flow)
- [2. Middleware va security controls](#2-middleware-va-security-controls)
- [3. RBAC model](#3-rbac-model)
- [4. Audit/Event logging](#4-auditevent-logging)
- [5. Rui ro va khoang trong](#5-rui-ro-va-khoang-trong)
- [6. Evidence](#6-evidence)

## 1. Auth flow
### 1.1 Login
1. `POST /api/v1/auth/login` nhan `email/password`.
2. Neu bang `users` ton tai thi query DB, neu chua co thi fallback sang mock users.
3. Verify password.
4. Phat hanh access JWT + refresh JWT.
5. Luu refresh token trong memory map (`refreshTokenStore`).

### 1.2 Refresh
1. `POST /api/v1/auth/refresh` verify refresh JWT.
2. Kiem tra token trong memory map va expire.
3. Neu hop le -> rotate refresh token, cap access token moi.

### 1.3 Logout
- `POST /api/v1/auth/logout` xoa refresh token khoi memory map (neu co).

### 1.4 Get current user
- `GET /api/v1/auth/me` dung `Authorization: Bearer`.
- preHandler verify access JWT, load user, gan `request.user`.

### 1.5 Auth context cho cac route nghiep vu
- Da so route `v1` khong verify JWT truc tiep tai preHandler.
- Route business su dung `x-user-id` va `x-user-role` qua `getUserContext/requireRole`.

## 2. Middleware va security controls
- CORS + Helmet duoc dang ky toan app.
- Rate limit plugin co the bat/tat theo env (`ENABLE_RATE_LIMIT`).
- Request hooks gan request-id, log request metadata, va gan `userContext` neu `request.user` da ton tai.

## 3. RBAC model
### 3.1 Backend RBAC
- Primitive RBAC helper:
- `requireRole(request, allowedRoles)`.
- Elevated roles always pass: `admin`, `super_admin`.

Role checks theo module:
- Asset write actions: `it_asset_manager`.
- Catalog/spec write: `catalog_admin` (mot so route dung manager).
- Warehouse/stock docs write: `it_asset_manager`.
- Reminders run: `admin`.
- CMDB write: `catalog_admin` hoac `it_asset_manager` tuy endpoint.

### 3.2 Frontend RBAC
- `getCapabilities(role)` map role -> flags (`canViewAssets`, `canManageAssets`, `canViewRequests`, ...).
- `isRouteAllowed(pathname, caps)` chan route khong du quyen.
- Layout loc menu theo capabilities (my assets/requests, cmdb, warehouse, reports...).

## 4. Audit/Event logging
### 4.1 Event store dang duoc dung
- `ops_events` duoc ghi qua `OpsEventRepo.append`.
- Nguon event:
- Asset attachment (`ATTACHMENT_ADDED`).
- Maintenance (`MAINT_OPEN`, `MAINT_CLOSE`, ...).
- Workflow request (`REQUEST_SUBMITTED/APPROVED/REJECTED`).
- Specs (`SPEC_VERSION_CREATED`, `SPEC_DEF_CHANGED`, `SPEC_VERSION_PUBLISHED`).
- CMDB (`CI_*`, `REL_*`, `SCHEMA_*`, `SERVICE_*`).

### 4.2 Audit trail report
- `AuditTrailService` doc `ops_events`, parse thanh 3 nhom:
- CI change history (`CI_*`).
- Relationship history (`REL_*`).
- Schema version history (`SCHEMA_*`).

### 4.3 Bang `audit_logs`
- Schema co bang `audit_logs` + indexes, nhung hien chua thay luong ghi tap trung ro rang tu route/service chinh.

## 5. Rui ro va khoang trong
- Refresh token store dang in-memory: restart API se mat token state.
- Token/JWT auth va header-based context (`x-user-id`, `x-user-role`) dang song song; can chuan hoa 1 co che xac thuc principal nhat quan.
- `audit_logs` co schema nhung implementation chu yeu ghi vao `ops_events`.

## 6. Evidence
- Auth routes + jwt/refresh store: `apps/api/src/routes/v1/auth/auth.routes.ts:81-85`, `apps/api/src/routes/v1/auth/auth.routes.ts:308-388`, `apps/api/src/routes/v1/auth/auth.routes.ts:412-452`.
- Users table check + fallback logic: `apps/api/src/routes/v1/auth/auth.routes.ts:150-235`.
- Role/context helper: `apps/api/src/routes/v1/assets/assets.helpers.ts:18-29`.
- Route-level role checks (mau): `apps/api/src/routes/v1/assets/assets.routes.ts:128-177`, `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:43-83`, `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:68-285`, `apps/api/src/routes/v1/reports/reminders.routes.ts:27`.
- Security plugin: `apps/api/src/core/plugins/security.plugin.ts:24-53`.
- Request hooks: `apps/api/src/core/middleware/request.hooks.ts:20-40`, `apps/api/src/core/middleware/request.hooks.ts:46-58`.
- Frontend capabilities + route guard/menu: `apps/web-ui/src/lib/auth/capabilities.ts:16-31`, `apps/web-ui/src/lib/auth/capabilities.ts:58-94`, `apps/web-ui/src/routes/+layout.svelte:48-159`.
- Ops event repo: `packages/infra-postgres/src/repositories/OpsEventRepo.ts:31-45`.
- Audit trail parse tu ops events: `packages/application/src/cmdb/AuditTrailService.ts:45-60`, `packages/application/src/cmdb/AuditTrailService.ts:81-139`.
- Event emitters (mau): `packages/application/src/assets/AttachmentService.ts:33-41`, `packages/application/src/assets/MaintenanceService.ts:54-105`, `packages/application/src/assets/WorkflowService.ts:185-193`, `packages/application/src/assets/CatalogService.ts:123-136`, `packages/application/src/cmdb/CiService.ts:49-72`, `packages/application/src/cmdb/RelationshipService.ts:82-89`, `packages/application/src/cmdb/ServiceMappingService.ts:24-63`.
- Schema `audit_logs` va `ops_events`: `packages/infra-postgres/src/schema.sql:241-249`, `packages/infra-postgres/src/schema.sql:609-619`, `packages/infra-postgres/src/schema.sql:1603-1610`, `packages/infra-postgres/src/schema.sql:1820`.
