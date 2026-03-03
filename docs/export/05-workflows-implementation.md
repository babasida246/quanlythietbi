# 05 - Workflows Implementation

## Muc luc
- [1. Tong quan state machines](#1-tong-quan-state-machines)
- [2. Nhap kho / Xuat kho (stock documents)](#2-nhap-kho--xuat-kho-stock-documents)
- [3. Cap phat tai san](#3-cap-phat-tai-san)
- [4. Work order / sua chua + linh kien](#4-work-order--sua-chua--linh-kien)
- [5. Workflow request tong quat](#5-workflow-request-tong-quat)
- [6. Specs dong](#6-specs-dong)
- [7. CMDB change workflow](#7-cmdb-change-workflow)
- [8. QLTS purchase plan / asset increase](#8-qlts-purchase-plan--asset-increase)
- [9. Evidence](#9-evidence)

## 1. Tong quan state machines
| Luong | Trang thai |
|---|---|
| Stock documents | `draft -> posted` hoac `draft -> canceled` |
| Inventory session | `draft/in_progress -> closed` hoac `canceled` |
| Workflow request | `submitted -> approved/rejected`; neu approved: `approved -> in_progress -> done` |
| Maintenance ticket | `open/in_progress -> closed` hoac `canceled` |
| Category spec version | `draft -> active`; ban active cu bi `retired` |
| CMDB type version | `draft -> active`; version active cu bi `deprecated` (hoac retired logic tu service) |
| Purchase plan (QLTS) | `draft -> submitted -> approved/rejected -> posted`; co the `cancelled` tu `draft/submitted` |
| Asset increase (QLTS) | `draft -> submitted -> approved/rejected -> posted`; co the `cancelled` tu `draft/submitted` |

## 2. Nhap kho / Xuat kho (stock documents)
### 2.1 Nhap kho (`doc_type = receipt`)
1. Tao chung tu nhap o trang thai `draft`.
2. Them dong chi tiet (`stock_document_lines`) voi `qty > 0`.
3. Khi `postDocument`, service kiem tra chung tu van o `draft`.
4. Thuc thi transaction: tinh delta ton, cap nhat `spare_part_stock`, ghi `spare_part_movements` (`movementType = in`), doi status doc sang `posted`.
5. Ghi su kien ops `STOCK_DOC_POSTED`.

### 2.2 Xuat kho (`doc_type = issue`)
1. Tao chung tu xuat `draft`.
2. Kiem tra ton kho, ap delta am.
3. Khi post: ghi movement `out`, cap nhat ton, chuyen doc sang `posted` trong transaction.

### 2.3 Dieu chuyen/Dieu chinh
- `adjust`: movement `adjust_in/adjust_out` theo dau delta.
- `transfer`: tao cap movement `transfer_out` o kho nguon va `transfer_in` o kho dich.

## 3. Cap phat tai san
Co 2 nhom cap phat:
- Cap phat truc tiep tren asset (`/assets/:id/assign`):
1. Validate asset ton tai.
2. Dong assignment dang hoat dong cu (neu co), tao assignment moi.
3. Chuyen status asset sang `in_use` neu can.
4. Ghi asset event.

- Cap phat qua workflow request:
1. Tao request `request_type = assign` o `submitted`.
2. Approve request.
3. Execute request -> goi `AssetService.assignAsset`.
4. Request sang `done`.

## 4. Work order / sua chua + linh kien
### 4.1 Maintenance ticket (route dang expose)
1. Mo ticket: tao maintenance record, chuyen asset sang `in_repair` neu can, ghi event `MAINT_OPEN`.
2. Cap nhat ticket status.
3. Neu dong ticket: service tinh trang thai asset tiep theo (`in_use` neu con assignment, nguoc lai `in_stock`) va ghi `MAINT_CLOSE`.

### 4.2 Repair order + parts (application layer)
1. Tao `repair_order`.
2. Them parts thay the (`repair_order_parts`) voi action `replace/add/remove/upgrade`.
3. Khi post parts, service tao stock document lien quan va post kho.
4. Ghi su kien `STOCK_DOC_POSTED` va su kien repair.

`CHUA TÌM THẤY`:
- Route Fastify dedicated cho `RepairService` trong `v1/maintenance` (hien route maintenance moi xu ly ticket).

## 5. Workflow request tong quat
1. Submit request (`assign/return/move/repair/dispose`) -> status `submitted`.
2. Approve hoac reject chi hop le khi dang `submitted`.
3. Execute chi hop le khi dang `approved`.
4. Execute se dispatch theo `requestType`:
- `assign`: goi assign asset.
- `return`: goi return asset.
- `move`: goi move asset.
- `repair`: goi open maintenance ticket.
- `dispose`: doi status asset `disposed`.
5. Sau execute, request sang `done`.

## 6. Specs dong
1. Tao category -> auto tao spec version `1` active + apply template (neu co).
2. Tao draft version moi: clone defs tu version active.
3. Them/sua/xoa spec def trong version.
4. Publish version: version moi sang `active`, version active cu bi retire.
5. Khi tao/cap nhat model: validate dynamic spec theo defs cua version active/duoc chon.

## 7. CMDB change workflow
1. Tao CI type + version + attribute defs.
2. Publish type version de bat dau dung schema active.
3. Tao/cap nhat CI: validate attributes theo schema active, upsert attr values.
4. Tao/xoa relationship giua cac CI, build graph/dependency/impact.
5. Tao service va map thanh vien CI.
6. Moi thay doi ghi `ops_events` (CI_*, REL_*, SCHEMA_*, SERVICE_*).

## 8. QLTS purchase plan / asset increase
### 8.1 Purchase Plan
1. Tao document `draft`.
2. Submit voi danh sach approvers -> status `submitted` + tao records approvals.
3. Approve tung buoc; khi tat ca approved thi doc sang `approved`.
4. Reject thi doc sang `rejected`.
5. Post tu `approved` theo workflow transition rules -> `posted`.
6. Chi cho `cancel` khi `draft` hoac `submitted`.

### 8.2 Asset Increase
1. Tao document `draft` + lines.
2. Submit/approve/reject tuong tu purchase plan.
3. Khi post, route mo transaction de tao rows moi trong `assets` theo lines, sau do update doc `posted`.
4. Chi cho cancel khi `draft/submitted`.

Canh bao ky thuat:
- SQL insert asset trong route asset increase dang dung cot `code/name/category_id/...`, trong khi `schema.sql` khai bao cot chinh cua `assets` la `asset_code/model_id/...`; can doi chieu schema runtime de tranh loi.

## 9. Evidence
- Stock document workflow + transaction + movement mapping: `packages/application/src/maintenanceWarehouse/StockDocumentService.ts:38-218`.
- Unit of work transaction: `packages/infra-postgres/src/repositories/WarehouseUnitOfWork.ts:13-24`.
- Asset assign/return/move/status: `packages/application/src/assets/AssetService.ts:164-254`.
- Maintenance workflow: `packages/application/src/assets/MaintenanceService.ts:33-153`.
- Repair workflow: `packages/application/src/maintenanceWarehouse/RepairService.ts:43-76`, `packages/application/src/maintenanceWarehouse/RepairService.ts:166`.
- Maintenance routes hien co: `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:21-49`.
- Inventory workflow: `packages/application/src/assets/InventoryService.ts:39-125`.
- Workflow request transitions: `packages/application/src/assets/WorkflowService.ts:25-181`.
- Category specs dynamic: `packages/application/src/assets/CategorySpecService.ts:46-112`, `packages/application/src/assets/CatalogService.ts:158-197`.
- Spec validation/normalize/template/extractor: `packages/application/src/assets/catalogSpecValidation.ts:22-243`, `packages/application/src/assets/categorySpecNormalize.ts:3-31`, `packages/application/src/assets/categorySpecTemplates.ts:8-129`, `packages/application/src/assets/categorySpecExtractor.ts:8-97`.
- CMDB services: `packages/application/src/cmdb/SchemaService.ts:38-85`, `packages/application/src/cmdb/CiService.ts:39-82`, `packages/application/src/cmdb/RelationshipService.ts:70-223`, `packages/application/src/cmdb/ServiceMappingService.ts:19-80`.
- QLTS purchase plan transitions: `apps/api/src/modules/qlts/routes/purchasePlans.ts:151-241`.
- QLTS asset increase transitions + posting: `apps/api/src/modules/qlts/routes/assetIncreases.ts:81-228`.
- Cot bang `assets` trong schema: `packages/infra-postgres/src/schema.sql:194-214`.
- Insert assets trong QLTS post: `apps/api/src/modules/qlts/routes/assetIncreases.ts:156-163`.
