# Huong Dan Day Du QLTB (User + Admin + Operator)

> Tai lieu van hanh tong hop cho toan bo he thong Quan Ly Thiet Bi.
> Muc tieu: giup team moi vao co the dung he thong dung quy trinh trong 1 tai lieu.

## 1. Khoi dong he thong

### 1.1 Yeu cau
- Node.js 20+
- pnpm workspace
- Docker Desktop (de chay PostgreSQL + pgAdmin)

### 1.2 Chay local tu dau
```bash
pnpm install
pnpm dev:infra
pnpm db:reset
pnpm dev:all
```

### 1.3 URL va tai khoan mac dinh
- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- pgAdmin: `http://localhost:8080`

Tai khoan:
- Admin: `admin@example.com` / `Benhvien@121`
- IT Manager: `it_manager@example.com` / `Benhvien@121`
- User: `user@example.com` / `Benhvien@121`

## 2. Luong nghiep vu chuan (end-to-end)

### 2.1 Vong doi tai san
1. Tao danh muc (`/assets/catalogs`): category, model, vendor, location, status.
2. Tao tai san (`/assets/new`) hoac import hang loat.
3. Cap phat tai san (`assign`) cho user.
4. Theo doi su dung (`/assets/[id]`, timeline).
5. Bao tri/sua chua (`/maintenance/*` + `/warehouse/repairs/*`).
6. Thu hoi (`return`) / thay doi vi tri (`move`) / cap nhat status.
7. Kiem ke dinh ky (`/inventory`).
8. Bao cao va phan tich (`/reports`, `/analytics`).

### 2.2 Luong yeu cau va phe duyet
1. User tao yeu cau (`/me/requests/new`).
2. Request vao inbox phe duyet (`/inbox`).
3. Approver approve/reject.
4. Ket qua cap nhat tren `/me/requests` va `/requests`.

### 2.3 Luong kho
1. Tao part trong `/warehouse/parts`.
2. Lap phieu nhap/xuat (`/warehouse/documents/new`).
3. Xu ly workflow phieu: draft -> submit -> approve -> post.
4. Doi chieu ton kho (`/warehouse/reconciliation`).
5. Theo doi lich su (`/warehouse/ledger`).

## 3. Huong dan theo vai tro

### 3.1 Admin
Tac vu chinh:
- Quan ly user/role/permission trong `/admin`.
- Quan tri AD/ACL (neu dung) thong qua route RBAC AD.
- Theo doi audit/security trong `/security` va audit routes.
- Cau hinh setup lan dau (`/setup`) khi he thong moi.

Checklist hang ngay:
- Kiem tra notifications, pending approvals, security alerts.
- Kiem tra user lock/disable bat thuong.
- Kiem tra dashboards va anomalous metrics.

### 3.2 IT Asset Manager
Tac vu chinh:
- Quan ly assets, catalogs, specs.
- Theo doi lifecycle, assignment, status.
- Chay reports assets va analytics.

KPI goi y:
- Ty le tai san dang su dung.
- Ty le hu hong/bao tri.
- Ty le tai san qua han bao hanh.

### 3.3 Warehouse Keeper
Tac vu chinh:
- Quan ly stock, parts, documents, ledger.
- Doi chieu ton kho va xu ly chenhlech.
- Phoi hop sua chua voi maintenance.

KPI goi y:
- Do chinh xac ton kho.
- Thoi gian xu ly phieu nhap/xuat.
- Ty le out-of-stock.

### 3.4 Technician
Tac vu chinh:
- Nhan va xu ly ticket bao tri.
- Ghi nhan part su dung, thoi gian, ket qua sua.
- Dong ticket dung quy trinh.

### 3.5 Requester/User
Tac vu chinh:
- Tao yeu cau cap phat/mua/sua.
- Theo doi trang thai xu ly.
- Quan ly danh sach thiet bi duoc cap.

## 4. Huong dan theo module man hinh

### 4.1 Assets
- Danh sach: `/assets`
- Tao moi: `/assets/new`
- Chi tiet: `/assets/[id]`
- Catalog: `/assets/catalogs`
- Purchase plans: `/assets/purchase-plans`
- Asset increases: `/assets/asset-increases/new`

Best practices:
- Luon tao catalog truoc khi tao tai san.
- Bat buoc serial/asset code unique.
- Khong xoa tai san da co lich su giao dich, uu tien soft-delete/archival.

### 4.2 CMDB
- Tong quan: `/cmdb`
- CIs: `/cmdb/cis`
- Types: `/cmdb/types`
- Services: `/cmdb/services`
- Changes: `/cmdb/changes`
- Reports: `/cmdb/reports`

Best practices:
- Quan tri version CI type truoc khi publish.
- Ghi ro relationship type de impact analysis dung.
- Duy tri lifecycle status cho CI nhat quan.

### 4.3 Warehouse
- Dashboard: `/warehouse`
- Parts: `/warehouse/parts`
- Stock: `/warehouse/stock`
- Documents: `/warehouse/documents`
- Ledger: `/warehouse/ledger`
- Reconciliation: `/warehouse/reconciliation`
- Repairs: `/warehouse/repairs`
- Reports: `/warehouse/reports`

Best practices:
- Khong post phieu khi line item chua du thong tin.
- Doi chieu ton kho dinh ky theo kho/nhom part.
- Luon ghi ly do adjustment de audit.

### 4.4 Inventory
- Sessions: `/inventory`
- Session detail: `/inventory/[id]`

Best practices:
- Chot danh sach pham vi kiem ke truoc khi scan.
- Dong bo nhan su scan va location.
- Luu evidence chenhlech truoc khi close session.

### 4.5 Workflow
- Admin requests: `/requests`
- User requests: `/me/requests`
- Tao request: `/me/requests/new`
- Inbox approvals: `/inbox`

Best practices:
- Dinh nghia ro SLA cho tung request type.
- Luu ly do reject day du.
- Theo doi pending approvals qua dashboard.

### 4.6 Analytics va Reports
- Analytics: `/analytics`
- Reports: `/reports`, `/reports/assets`

Best practices:
- Chot filter va date range truoc khi so sanh KPI.
- Snapshot dinh ky de tracking trend.

### 4.7 Admin va Security
- Admin: `/admin`
- Security: `/security`

Best practices:
- Role-based minimum privilege.
- Audit reset password va role changes.
- Kiem tra quyen route-level va action-level dong bo.

### 4.8 Automation va Integrations
- Automation: `/automation`
- Integrations: `/integrations`

Best practices:
- Test rules tren du lieu test truoc prod.
- Bat retry/backoff khi sync external.
- Logging day du cho webhook failures.

### 4.9 Print
- Print template custom: `/print/custom/[id]`
- Print theo type: `/print/[type]/[id]`
- Settings print: `/settings/print`

Best practices:
- Chuan hoa placeholder data.
- Preview truoc khi in.
- Version template neu co thay doi bieu mau.

## 5. API va tich hop cho team phat trien

- Base: `http://localhost:3000/api`
- Versioned routes: `/api/v1/*`
- Auth routes: `/api/v1/auth/*`
- Setup routes: `/api/setup/*`
- Chuan response:
  - Success: `{ success: true, data, meta? }`
  - Error: `{ success: false, error: { code, message } }`

Khi tich hop:
- Luon gui `Authorization: Bearer <token>` cho `/api/v1/*` (tru auth).
- Xu ly 401: clear session va ve login.
- Khong hardcode endpoint; dung API client modules trong `apps/web-ui/src/lib/api`.

## 6. Van hanh va su co thuong gap

### 6.1 Khong dang nhap duoc
- Kiem tra DB da seed chua: `pnpm db:reset`
- Kiem tra API dang chay `:3000`
- Kiem tra browser localStorage token cu

### 6.2 Vong lap login/logout
- Neu gap redirect loop, xoa localStorage va dang nhap lai.
- Luong da duoc fix: `/logout` la public route va redirect query da duoc sanitize.

### 6.3 API 401 lien tuc
- Access token het han + refresh fail.
- Kiem tra `JWT_SECRET`, `JWT_REFRESH_SECRET` trong `.env`.
- Kiem tra clock skew server/client.

### 6.4 Khong thay du lieu
- Kiem tra role/capabilities.
- Kiem tra hidden sites config.
- Kiem tra filter/date range tren UI.

## 7. Checklist release

Truoc khi release:
1. Chay typecheck + lint + test.
2. Chay smoke flow: login, assets list, request approve, warehouse post, report.
3. Verify migration moi idempotent.
4. Verify i18n key du ca `vi.json` va `en.json`.
5. Verify dark/light va print pages.

Lenh goi y:
```bash
pnpm typecheck
pnpm test:lint
pnpm test
pnpm test:e2e
pnpm --filter @qltb/api build
pnpm --filter @qltb/web-ui build
```

## 8. Tai lieu lien quan

- `README.md`
- `feature-inventory.md`
- `features.md`
- `api-reference.md`
- `architecture.md`
- `database.md`
- `testing.md`
- `deployment.md`
