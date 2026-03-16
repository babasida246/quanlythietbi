# Inventory Chuc Nang Day Du (Code-Verified)

> Cap nhat theo codebase ngay 2026-03-14.
> Pham vi quet: `apps/web-ui/src/routes`, `apps/api/src/routes/v1`, `apps/api/src/modules`, `packages/*`.

## Tong quan

- Frontend pages (`+page.svelte`): `59`
- Backend business modules (`apps/api/src/modules`): `16`
- API route files theo `v1` + module route docs: bao gom assets, auth, admin, cmdb, warehouse, maintenance, inventory, reports, analytics, automation, integrations, security, communications, wf, qlts.
- Kien truc: Clean Architecture voi `contracts -> domain -> application -> infra-postgres`.

## 1. Chuc nang theo module nghiep vu

### 1.1 Auth va Setup
- Dang nhap, refresh token, dang xuat, lay thong tin user hien tai.
- Setup lan dau: migrate, seed, tao admin, finalize.
- Guard route frontend + auto refresh token + clear session khi token khong hop le.

Frontend:
- `/login`, `/logout`, `/setup`, `/forbidden`

API families:
- `/api/v1/auth/*`
- `/api/setup/*`

### 1.2 Assets (Quan ly tai san)
- CRUD tai san.
- Assign/return/move/update status.
- Timeline su kien theo tung tai san.
- Import preview + import commit.
- Attachment tai lieu cho tai san.
- Catalog: categories, vendors, models, locations, statuses.
- Category specs va spec versioning.
- Purchase plans va asset increases.

Frontend:
- `/assets`
- `/assets/new`
- `/assets/[id]`
- `/assets/catalogs`
- `/assets/purchase-plans`
- `/assets/purchase-plans/new`
- `/assets/asset-increases/new`

API families:
- `/api/v1/assets/*`
- `/api/v1/assets/catalogs/*`
- `/api/v1/assets/import/*`
- `/api/v1/assets/attachments/*`

### 1.3 CMDB
- Quan ly CI, CI types, services, changes.
- Quan he giua CIs, import relationships.
- Reports, impact/dependency graph.
- Discovery rules, smart tags, change assessments.

Frontend:
- `/cmdb`
- `/cmdb/cis`
- `/cmdb/cis/[id]`
- `/cmdb/types`
- `/cmdb/services`
- `/cmdb/changes`
- `/cmdb/reports`
- `/cmdb/relationships/import`

API families:
- `/api/v1/cmdb/*`

### 1.4 Warehouse
- Quan ly kho.
- Spare parts.
- Stock real-time, reserve/release.
- Stock documents (nhap/xuat) va workflow.
- Ledger, reconciliation.
- Repair orders + su dung linh kien.
- Warehouse reports va purchase plans.

Frontend:
- `/warehouse`
- `/warehouse/warehouses`
- `/warehouse/parts`
- `/warehouse/stock`
- `/warehouse/documents`
- `/warehouse/documents/new`
- `/warehouse/documents/[id]`
- `/warehouse/ledger`
- `/warehouse/reconciliation`
- `/warehouse/repairs`
- `/warehouse/repairs/[id]`
- `/warehouse/purchase-plans`
- `/warehouse/reports`

API families:
- `/api/v1/warehouse/*`
- `/api/v1/maintenance-warehouse/*`

### 1.5 Maintenance
- Ticket bao tri/sua chua.
- Trang thai xu ly.
- Chi phi, linh kien, lich su sua chua.

Frontend:
- `/maintenance`
- `/maintenance/repairs`
- `/maintenance/repairs/[id]`

API families:
- `/api/v1/maintenance/*`

### 1.6 Inventory (Kiem ke)
- Tao phien kiem ke.
- Quet tai san trong phien.
- Doi chieu ton tai san he thong va thuc te.
- Dong phien va tao ket qua.

Frontend:
- `/inventory`
- `/inventory/[id]`

API families:
- `/api/v1/inventory/*`

### 1.7 Workflow va Requests
- My requests, create request, theo doi trang thai.
- Admin requests view.
- Inbox phe duyet va chi tiet task phe duyet.
- Resolver approver va cac buoc approval.

Frontend:
- `/requests`
- `/me/requests`
- `/me/requests/new`
- `/inbox`
- `/inbox/[id]`
- `/me/assets`

API families:
- `/api/v1/wf/*`

### 1.8 Reports va Analytics
- Dashboards thong ke.
- Reports tong hop theo module.
- Reminder routes.
- Report aggregation.

Frontend:
- `/analytics`
- `/reports`
- `/reports/assets`

API families:
- `/api/v1/analytics/*`
- `/api/v1/reports/*`

### 1.9 Admin va Security
- User management.
- RBAC management.
- AD + ACL (rbac-ad routes).
- Security/compliance module.
- Audit route module.

Frontend:
- `/admin`
- `/security`

API families:
- `/api/v1/admin/*`
- `/api/v1/rbac-ad/*`
- `/api/v1/security/*`
- `/api/v1/audit/*`

### 1.10 Automation va Integrations
- Rules, tasks, notifications automation.
- Connector management.
- Sync rules, webhook integration.

Frontend:
- `/automation`
- `/integrations`

API families:
- `/api/v1/automation/*`
- `/api/v1/integrations/*`

### 1.11 Communications, Labels, Licenses, Depreciation, Documents, Accessories...
- Communications events/notification routes.
- Labels/barcode management.
- Licenses management.
- Depreciation workflows.
- Documents management.
- Accessories/components/consumables/checkout modules.

API module files:
- `apps/api/src/modules/accessories/*`
- `apps/api/src/modules/components/*`
- `apps/api/src/modules/consumables/*`
- `apps/api/src/modules/checkout/*`
- `apps/api/src/modules/licenses/*`
- `apps/api/src/modules/depreciation/*`
- `apps/api/src/modules/documents/*`
- `apps/api/src/modules/labels/*`

## 2. Danh sach route frontend (theo nhom)

### Public/Shellless
- `/`
- `/login`
- `/logout`
- `/setup`
- `/forbidden`
- `/print/custom/[id]`
- `/print/[type]/[id]`
- `/[legacy]`
- `/[legacy]/[...rest]`

### Main shell (assets group)
- `/admin`
- `/analytics`
- `/assets`, `/assets/new`, `/assets/[id]`
- `/assets/catalogs`
- `/assets/purchase-plans`, `/assets/purchase-plans/new`
- `/assets/asset-increases/new`
- `/automation`
- `/cmdb`, `/cmdb/cis`, `/cmdb/cis/[id]`, `/cmdb/types`, `/cmdb/services`, `/cmdb/changes`, `/cmdb/reports`, `/cmdb/relationships/import`
- `/help`
- `/integrations`
- `/inventory`, `/inventory/[id]`
- `/maintenance`, `/maintenance/repairs`, `/maintenance/repairs/[id]`
- `/me/assets`
- `/me/requests`, `/me/requests/new`
- `/reports`, `/reports/assets`
- `/requests`
- `/security`
- `/settings/theme`, `/settings/print`
- `/warehouse`, `/warehouse/warehouses`, `/warehouse/parts`, `/warehouse/stock`, `/warehouse/documents`, `/warehouse/documents/new`, `/warehouse/documents/[id]`, `/warehouse/ledger`, `/warehouse/reconciliation`, `/warehouse/repairs`, `/warehouse/repairs/[id]`, `/warehouse/purchase-plans`, `/warehouse/reports`

### Out-of-group but auth-aware
- `/inbox`
- `/inbox/[id]`
- `/notifications`

## 3. Coverage huong dan (docs) va de xuat bo sung

Da co:
- `architecture.md`, `database.md`, `api-reference.md`, `features.md`, `testing.md`, `deployment.md`.

Da bo sung trong dot cap nhat nay:
- `feature-inventory.md` (file nay): danh sach chuc nang theo code thuc te.
- `huong-dan-day-du.md`: huong dan su dung va van hanh end-to-end.

Can tiep tuc mo rong (neu muon chi tiet hon nua):
- Chen sequence diagram luong nghiep vu cho tung module (asset lifecycle, request approval, warehouse posting).
- Bo sung screenshot cho tung man hinh trong `features.md`.
- Sinh endpoint matrix tu Swagger de co bang 1-1 endpoint-level tu dong.

## 4. Ghi chu ki thuat quan trong

- Frontend su dung Svelte 5 runes.
- i18n bat buoc cho text hien thi.
- Auth guard: neu token invalid, clear session va redirect login.
- Route `/logout` duoc coi la route public de tranh loop `login -> logout`.
- Migration policy: chi them file moi, khong sua migration cu.
