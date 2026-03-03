# 09 - Gaps and TODOs

## Muc luc
- [1. Gaps ky thuat phat hien](#1-gaps-ky-thuat-phat-hien)
- [2. Noi dung CHUA TIM THAY](#2-noi-dung-chua-tim-thay)
- [3. De xuat bo sung cho Chuong 2/3](#3-de-xuat-bo-sung-cho-chuong-23)
- [4. Evidence](#4-evidence)

## 1. Gaps ky thuat phat hien
| Gap | Tac dong | Muc uu tien | De xuat |
|---|---|---|---|
| CMDB endpoint `GET /cmdb/cis/:id/relationships` dang goi `listRelationshipTypes` thay vi list quan he CI | UI/bao cao quan he CI co the sai du lieu | Cao | Sua route goi dung service/repo lay relationships theo CI |
| QLTS `asset-increases/:id/post` insert vao `assets` voi cot `code/name/category_id...` trong khi schema chinh la `asset_code/model_id...` | Co nguy co loi runtime hoac lech schema production | Cao | Doi chieu schema runtime, cap nhat SQL insert cho dong nhat |
| `RepairService` co business logic day du nhung khong thay route Fastify dedicated | Chuc nang work order + linh kien kho chua expose API chuan | Cao | Them route `/api/v1/repairs*` hoac mo rong module maintenance |
| Co 2 co che identity song song: JWT (`/auth/me`) va header `x-user-id/x-user-role` tren nhieu route business | Rui ro security/nhat quan auth context | Cao | Chuan hoa preHandler xac thuc JWT va derive user context server-side |
| Refresh token dang luu memory map | Mat token state khi restart, khong phu hop scale ngang | Trung binh | Dua refresh token vao DB/Redis |
| Bang `audit_logs` co schema nhung implementation chu yeu ghi `ops_events` | Kho dong bo audit model, de gay nham lan khi viet tai lieu | Trung binh | Chot 1 kenh audit chinh hoac viet adapter dong bo |
| Frontend co doan goi `fetch('/api/v1/...')` truc tiep thay vi qua `lib/api/*` | Kho thong nhat xu ly auth/error/cache | Trung binh | Refactor ve API client module chung |
| Frontend co module API admin/audit (`/v1/admin/*`, `/v1/audit*`) nhung backend hien khong thay route tuong ung | Co nguy co dead code/API mismatch | Trung binh | Bo sung backend route hoac loai bo API client khong dung |
| `db/migrations/README.md` mo ta migration status co dau hieu lech voi migration files hien co | De nham khi trinh bay quy trinh DB | Thap | Cap nhat README migrations theo thuc te |
| File duoc tham chieu trong README migration `db/init-complete.sql` dang thieu | Kho khoi tao theo tai lieu cu | Thap | Tao lai file hoac sua tai lieu |
| Script test seeding (`scripts/test/seed-test-data.sh`) co dau hieu schema cu | E2E/test data co the fail hoac sinh data khong hop schema | Trung binh | Dong bo script voi schema hien tai |

## 2. Noi dung CHUA TIM THAY
- `CHUA TÌM THẤY` script backup/restore chinh thuc cho production (chi thay migrate/seed/reset).
- `CHUA TÌM THẤY` trigger/stored procedure DB cho nghiep vu posting/audit (logic dang nam o service layer).
- `CHUA TÌM THẤY` route backend cong khai cho module admin users/audit ma frontend API modules dang khai bao.
- `CHUA TÌM THẤY` route Fastify de expose truc tiep `RepairService`.

Dau vet da tim:
- Quet shell scripts trong `scripts/`, `docker/scripts/`, `db/`.
- Quet route definitions trong `apps/api/src/routes/**`.
- Quet API client definitions trong `apps/web-ui/src/lib/api/**`.

## 3. De xuat bo sung cho Chuong 2/3
### 3.1 De day du Chuong 2 (phan tich/thiet ke)
1. Them ERD chinh thuc cho cac cum bang: Asset, Warehouse, Workflow, CMDB, QLTS.
2. Ve state diagrams rieng cho:
- Stock documents.
- Workflow requests.
- Purchase plan + asset increase.
- Category specs versioning.
3. Chot ma tran Role -> Permission -> Endpoint de tranh mo ho auth model.

### 3.2 De day du Chuong 3 (hien thuc)
1. Them sequence diagrams cho 5 luong bat buoc:
- Nhap kho posted.
- Xuat kho posted.
- Cap phat tai san qua workflow.
- Work order sua chua co linh kien.
- Publish spec version + validate model spec.
2. Bo sung test case integration cho:
- Transition invalid states (409/400).
- Transaction rollback stock doc post.
- CMDB relationship/impact queries.
- QLTS post asset increase tao assets.
3. Mo ta ro strategy audit (ops_events vs audit_logs) va de xuat hop nhat.

## 4. Evidence
- CMDB relationships route mismatch: `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:217-223`.
- QLTS asset insert: `apps/api/src/modules/qlts/routes/assetIncreases.ts:156-163`.
- Assets table schema cot chinh: `packages/infra-postgres/src/schema.sql:194-214`.
- Repair service ton tai: `packages/application/src/maintenanceWarehouse/RepairService.ts:43-197`.
- Maintenance routes hien co: `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:21-49`.
- Header-based user context: `apps/api/src/routes/v1/assets/assets.helpers.ts:18-29`.
- JWT auth `/me`: `apps/api/src/routes/v1/auth/auth.routes.ts:441-467`.
- Refresh token in-memory: `apps/api/src/routes/v1/auth/auth.routes.ts:81`, `apps/api/src/routes/v1/auth/auth.routes.ts:374-388`.
- Ops events append: `packages/infra-postgres/src/repositories/OpsEventRepo.ts:31-45`.
- audit_logs table co san: `packages/infra-postgres/src/schema.sql:241-249`, `packages/infra-postgres/src/schema.sql:1603-1610`.
- Frontend direct fetch CMDB/QLTS: `apps/web-ui/src/routes/(assets)/cmdb/reports/+page.svelte:57-71`, `apps/web-ui/src/routes/(assets)/assets/purchase-plans/new/+page.svelte:74-89`, `apps/web-ui/src/routes/(assets)/assets/asset-increases/new/+page.svelte:91-106`.
- Frontend admin/audit API declarations: `apps/web-ui/src/lib/api/admin.ts:48-84`, `apps/web-ui/src/lib/api/audit.ts:54-58`.
- Backend khong thay `/v1/admin` route (ngoai setup admin): ket qua quet route trong `apps/api/src/routes/**`, co `apps/api/src/routes/setup/setup.routes.ts:378`.
- Migration README status: `db/migrations/README.md:5-8`, `db/migrations/README.md:13-25`.
- `init-complete.sql` duoc nhac trong README: `db/migrations/README.md:6`, `db/migrations/README.md:68-73`.
- Backup/restore scripts: quet `scripts`, `docker/scripts`, `db`; tim thay `docker/scripts/migrate-assets.sh:12-22`, `docker/scripts/seed-assets.sh:14-23`, `docker/scripts/reset-assets.sh:9-12`.
- Script test seeding co dau hieu schema cu: `scripts/test/seed-test-data.sh:21-107`.
