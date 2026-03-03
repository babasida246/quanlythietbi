# 02 - Architecture Modules

## Muc luc
- [1. Kien truc tong the](#1-kien-truc-tong-the)
- [2. So do layer](#2-so-do-layer)
- [3. Danh sach module](#3-danh-sach-module)
- [4. Mapping module -> thu muc/file](#4-mapping-module---thu-mucfile)
- [5. Evidence](#5-evidence)

## 1. Kien truc tong the
Kien truc backend theo huong module + layer:
- Route layer (`apps/api/src/routes/*`): tiep nhan HTTP, parse input, check role, goi service.
- Application layer (`packages/application/src/*`): chua business workflow.
- Repository layer (`packages/infra-postgres/src/repositories/*`): truy van PostgreSQL.
- Schema/data layer (`packages/infra-postgres/src/schema.sql`, `db/migrations/*`, seeds).

Frontend theo SvelteKit pages + API client:
- Route pages (`apps/web-ui/src/routes/*`) + panels/components.
- API abstraction (`apps/web-ui/src/lib/api/*`) dung `authorizedFetch/apiJson`.
- Role gating UI tai layout/capabilities.

## 2. So do layer
```text
Web Pages (SvelteKit)
  -> lib/api/* (HTTP client)
    -> API Routes (Fastify)
      -> Application Services
        -> Repositories (pg)
          -> PostgreSQL schema/tables
```

## 3. Danh sach module
Bang duoi day map module nghiep vu toi code va API chinh.

| Module | Chuc nang | Files/Folders | API chinh |
|---|---|---|---|
| Setup Wizard | Kiem tra trang thai, migrate, seed, tao admin dau tien, finalize khoi tao | `apps/api/src/routes/setup/*` | `/api/setup/status`, `/api/setup/migrate`, `/api/setup/seed`, `/api/setup/admin`, `/api/setup/finalize` |
| Auth | Login/refresh/logout/me | `apps/api/src/routes/v1/auth/*` | `/api/v1/auth/login`, `/refresh`, `/logout`, `/me` |
| Asset Core | CRUD asset, assign/return/move/status, timeline | `apps/api/src/routes/v1/assets/assets.routes.ts`, `packages/application/src/assets/AssetService.ts` | `/api/v1/assets*` |
| Catalog + Specs dong | Quan ly category/vendor/model/location + spec defs/versions | `apps/api/src/routes/v1/assets/catalogs.routes.ts`, `category-specs.routes.ts`, `packages/application/src/assets/CatalogService.ts`, `CategorySpecService.ts` | `/api/v1/assets/catalogs*`, `/api/v1/asset-categories*`, `/api/v1/spec-*` |
| Attachments | Metadata va download file dinh kem tai san | `attachments.routes.ts`, `AttachmentService.ts` | `/api/v1/assets/:id/attachments*` |
| Import Assets | Preview/commit import du lieu tai san | `assets.import.routes.ts` | `/api/v1/assets/import/preview`, `/commit` |
| Maintenance | Mo dong ticket bao tri tai san | `maintenance.routes.ts`, `MaintenanceService.ts` | `/api/v1/maintenance*` |
| Inventory | Session kiem ke, scan, close, report | `inventory.routes.ts`, `InventoryService.ts` | `/api/v1/inventory/sessions*` |
| Workflow | Submit/approve/reject/execute request | `workflow.routes.ts`, `WorkflowService.ts` | `/api/v1/workflows*` |
| Warehouse + Stock Docs | Kho, spare parts, stock view, stock docs + post/cancel + ledger | `warehouse.routes.ts`, `stock-documents.routes.ts`, `packages/application/src/maintenanceWarehouse/StockDocumentService.ts` | `/api/v1/warehouses*`, `/api/v1/spare-parts*`, `/api/v1/stock-*` |
| Reporting + Reminders | Bao cao ton kho va nhac han tai san | `reports.routes.ts`, `reminders.routes.ts` | `/api/v1/reports/*`, `/api/v1/assets/reminders*` |
| Communications | Notifications + inbox thread/reply | `communications.routes.ts` | `/api/v1/notifications*`, `/api/v1/inbox*` |
| CMDB | CI type/version/schema, CI, relationship, service mapping, report/export | `cmdb.routes.ts`, `packages/application/src/cmdb/*` | `/api/v1/cmdb/*` |
| QLTS Purchase Plan | Phieu de xuat mua sam + approval + posting | `apps/api/src/modules/qlts/routes/purchasePlans.ts` | `/api/v1/assets/purchase-plans*` |
| QLTS Asset Increase | Chung tu ghi tang tai san + approval + post tao asset | `apps/api/src/modules/qlts/routes/assetIncreases.ts` | `/api/v1/assets/asset-increases*` |

## 4. Mapping module -> thu muc/file
Backend module assembly (Dependency Injection) duoc tap trung tai:
- `apps/api/src/routes/v1/assets/assets.module.ts`.
- File nay khoi tao service/repo va register cac route group duoi prefix `/api/v1`.

Cac business service trong application layer dang duoc wire:
- `AssetService`, `CatalogService`, `CategorySpecService`, `AttachmentService`, `MaintenanceService`, `InventoryService`, `WorkflowService`, `StockDocumentService`, `CMDB services`.

Ghi chu kien truc:
- Co `RepairService` trong application (`packages/application/src/maintenanceWarehouse/RepairService.ts`) nhung chua thay route Fastify dedicated de goi truc tiep.

## 5. Evidence
- Register setup/auth/assets modules: `apps/api/src/core/app.ts:108-132`.
- Setup prefix: `apps/api/src/routes/setup/setup.module.ts:18-24`.
- Auth prefix: `apps/api/src/routes/v1/auth/auth.module.ts:22-23`.
- Assets aggregate module va register route groups: `apps/api/src/routes/v1/assets/assets.module.ts:111-132`, `apps/api/src/routes/v1/assets/assets.module.ts:156-178`.
- QLTS prefix registration: `apps/api/src/routes/v1/assets/assets.module.ts:180-194`, `apps/api/src/modules/qlts/routes/index.ts:5-7`.
- Asset core routes: `apps/api/src/routes/v1/assets/assets.routes.ts:58-190`.
- Catalog/spec routes: `apps/api/src/routes/v1/assets/catalogs.routes.ts:28-157`, `apps/api/src/routes/v1/assets/category-specs.routes.ts:32-121`.
- Inventory/workflow/maintenance: `apps/api/src/routes/v1/inventory/inventory.routes.ts:22-72`, `apps/api/src/routes/v1/workflow/workflow.routes.ts:23-73`, `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:21-49`.
- Warehouse/stock docs/reports/reminders: `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:26-80`, `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:28-94`, `apps/api/src/routes/v1/reports/reports.routes.ts:25-93`, `apps/api/src/routes/v1/reports/reminders.routes.ts:16-32`.
- Communications: `apps/api/src/routes/v1/communications/communications.routes.ts:65-425`.
- CMDB routes: `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:61-415`.
- QLTS routes: `apps/api/src/modules/qlts/routes/purchasePlans.ts:78-241`, `apps/api/src/modules/qlts/routes/assetIncreases.ts:23-228`.
- Repair service hien dien o application layer: `packages/application/src/maintenanceWarehouse/RepairService.ts:43-197`.
