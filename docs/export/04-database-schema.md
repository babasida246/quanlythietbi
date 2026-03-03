# 04 - Database Schema

## Muc luc
- [1. Nguon schema va cach quan ly](#1-nguon-schema-va-cach-quan-ly)
- [2. Danh sach bang](#2-danh-sach-bang)
- [3. Bang nghiep vu trong tam (cot chinh, PK/FK)](#3-bang-nghiep-vu-trong-tam-cot-chinh-pkfk)
- [4. Indexes va constraints](#4-indexes-va-constraints)
- [5. Business rules enforced in DB](#5-business-rules-enforced-in-db)
- [6. Transaction patterns quan trong](#6-transaction-patterns-quan-trong)
- [7. Seed data](#7-seed-data)
- [8. Evidence](#8-evidence)

## 1. Nguon schema va cach quan ly
Nguon DB trong repo hien tai dung ket hop:
- `packages/infra-postgres/src/schema.sql`: schema tong hop dang duoc app repositories su dung.
- `db/migrations/*.sql`: migrations theo pha/chuc nang (CMDB, asset spec, workflow QLTS, modules mo rong).
- Setup wizard (`/api/setup/*`) tu chay migration/seed bang script SQL + deterministic seed.

Luu y quan trong:
- Khong thay ORM migration tool (Prisma/TypeORM/Sequelize/Drizzle/Knex).
- QLTS tables (`purchase_plan_docs`, `asset_increase_docs`, `approvals`) xuat hien trong migration `026_phase1_workflow_foundation.sql`, nhung khong nam trong danh sach `CREATE TABLE` cua `schema.sql` hien tai.

## 2. Danh sach bang
### 2.1 Danh sach day du tu `schema.sql`
`schema.sql` hien co 43 bang (line range CREATE TABLE):

| Bang | Line range |
|---|---|
| `ai_providers` | `packages/infra-postgres/src/schema.sql:43-59` |
| `asset_assignments` | `packages/infra-postgres/src/schema.sql:66-76` |
| `asset_attachments` | `packages/infra-postgres/src/schema.sql:83-94` |
| `asset_categories` | `packages/infra-postgres/src/schema.sql:101-105` |
| `asset_category_spec_defs` | `packages/infra-postgres/src/schema.sql:112-141` |
| `asset_category_spec_versions` | `packages/infra-postgres/src/schema.sql:148-156` |
| `asset_events` | `packages/infra-postgres/src/schema.sql:163-171` |
| `asset_models` | `packages/infra-postgres/src/schema.sql:178-187` |
| `assets` | `packages/infra-postgres/src/schema.sql:194-214` |
| `attachments` | `packages/infra-postgres/src/schema.sql:221-234` |
| `audit_logs` | `packages/infra-postgres/src/schema.sql:241-249` |
| `chat_contexts` | `packages/infra-postgres/src/schema.sql:256-266` |
| `cmdb_ci_attr_values` | `packages/infra-postgres/src/schema.sql:273-281` |
| `cmdb_ci_schemas` | `packages/infra-postgres/src/schema.sql:288-301` |
| `cmdb_ci_type_versions` | `packages/infra-postgres/src/schema.sql:308-317` |
| `cmdb_ci_types` | `packages/infra-postgres/src/schema.sql:324-330` |
| `cmdb_cis` | `packages/infra-postgres/src/schema.sql:337-353` |
| `cmdb_relationship_types` | `packages/infra-postgres/src/schema.sql:360-368` |
| `cmdb_relationships` | `packages/infra-postgres/src/schema.sql:375-383` |
| `cmdb_service_cis` | `packages/infra-postgres/src/schema.sql:390-396` |
| `cmdb_services` | `packages/infra-postgres/src/schema.sql:403-416` |
| `conversation_token_usage` | `packages/infra-postgres/src/schema.sql:423-434` |
| `conversations` | `packages/infra-postgres/src/schema.sql:441-451` |
| `inventory_items` | `packages/infra-postgres/src/schema.sql:458-468` |
| `inventory_sessions` | `packages/infra-postgres/src/schema.sql:475-486` |
| `locations` | `packages/infra-postgres/src/schema.sql:493-499` |
| `maintenance_tickets` | `packages/infra-postgres/src/schema.sql:506-520` |
| `messages` | `packages/infra-postgres/src/schema.sql:527-544` |
| `model_configs` | `packages/infra-postgres/src/schema.sql:551-571` |
| `model_performance` | `packages/infra-postgres/src/schema.sql:578-589` |
| `model_usage_history` | `packages/infra-postgres/src/schema.sql:596-602` |
| `ops_events` | `packages/infra-postgres/src/schema.sql:609-619` |
| `orchestration_rules` | `packages/infra-postgres/src/schema.sql:626-638` |
| `provider_usage_history` | `packages/infra-postgres/src/schema.sql:645-651` |
| `reminders` | `packages/infra-postgres/src/schema.sql:658-670` |
| `repair_order_parts` | `packages/infra-postgres/src/schema.sql:677-692` |
| `repair_orders` | `packages/infra-postgres/src/schema.sql:699-724` |
| `sessions` | `packages/infra-postgres/src/schema.sql:731-744` |
| `spare_part_movements` | `packages/infra-postgres/src/schema.sql:751-765` |
| `spare_part_stock` | `packages/infra-postgres/src/schema.sql:772-779` |
| `spare_parts` | `packages/infra-postgres/src/schema.sql:786-797` |
| `stock_document_lines` | `packages/infra-postgres/src/schema.sql:804-815` |
| `stock_documents` | `packages/infra-postgres/src/schema.sql:822-840` |
| `usage_logs` | `packages/infra-postgres/src/schema.sql:847-859` |
| `user_token_stats` | `packages/infra-postgres/src/schema.sql:866-875` |
| `users` | `packages/infra-postgres/src/schema.sql:882-895` |
| `vendors` | `packages/infra-postgres/src/schema.sql:902-910` |
| `warehouses` | `packages/infra-postgres/src/schema.sql:917-923` |
| `workflow_requests` | `packages/infra-postgres/src/schema.sql:930-945` |

### 2.2 Bang bo sung tu migration QLTS
Migration `026_phase1_workflow_foundation.sql` bo sung:
- `approvals`
- `purchase_plan_docs`
- `purchase_plan_lines`
- `asset_increase_docs`
- `asset_increase_lines`

## 3. Bang nghiep vu trong tam (cot chinh, PK/FK)
| Bang | Cot chinh | PK/Unique/FK quan trong |
|---|---|---|
| `assets` | `id`, `asset_code`, `model_id`, `vendor_id`, `location_id`, `status`, `purchase_date`, `warranty_end` | PK `assets_pkey`; unique `assets_asset_code_key`; FK den `asset_models/vendors/locations` |
| `asset_assignments` | `asset_id`, `assignee_type`, `assignee_id`, `assigned_at`, `returned_at` | PK `asset_assignments_pkey`; FK `asset_id -> assets` |
| `asset_events` | `asset_id`, `event_type`, `payload`, `actor_user_id`, `correlation_id` | PK `asset_events_pkey`; FK `asset_id -> assets` |
| `maintenance_tickets` | `asset_id`, `title`, `severity`, `status`, `opened_at`, `closed_at` | PK `maintenance_tickets_pkey`; FK `asset_id -> assets`; check severity/status |
| `inventory_sessions` | `code`, `location_id`, `status`, `started_at`, `closed_at`, `created_by` | PK `inventory_sessions_pkey`; FK `location_id -> locations`; check status |
| `inventory_items` | `session_id`, `asset_id`, `expected_location_id`, `scanned_location_id`, `status` | PK `inventory_items_pkey`; FK den `inventory_sessions/assets/locations`; check status |
| `workflow_requests` | `request_type`, `asset_id`, `requested_by`, `approved_by`, `status`, `payload` | PK `workflow_requests_pkey`; FK `asset_id -> assets`; check request_type/status |
| `warehouses` | `code`, `name`, `location_id`, `is_active` | PK `warehouses_pkey`; unique `warehouses_code_key`; FK `location_id -> locations` |
| `spare_parts` | `part_code`, `name`, `unit`, `min_qty`, `is_active` | PK `spare_parts_pkey`; unique `spare_parts_part_code_key` |
| `spare_part_stock` | `warehouse_id`, `part_id`, `on_hand`, `reserved` | PK `spare_part_stock_pkey`; unique `(warehouse_id,part_id)`; FK den warehouse/part |
| `spare_part_movements` | `warehouse_id`, `part_id`, `movement_type`, `qty`, `ref_type`, `ref_id` | PK `spare_part_movements_pkey`; check movement_type, qty>0 |
| `stock_documents` | `code`, `doc_type`, `status`, `warehouse_id`, `target_warehouse_id`, `doc_date`, `posted_at` | PK `stock_documents_pkey`; unique `stock_documents_code_key`; check doc_type/status; FK den warehouses |
| `stock_document_lines` | `document_id`, `part_id`, `qty`, `unit_cost`, `adjust_direction` | PK `stock_document_lines_pkey`; FK den stock_documents/spare_parts; check qty>0, adjust_direction |
| `repair_orders` | `code`, `asset_id`, `status`, `repair_type`, `severity`, `opened_at`, `closed_at` | PK `repair_orders_pkey`; unique `repair_orders_code_key`; FK den assets/vendors; check enums |
| `repair_order_parts` | `repair_order_id`, `part_id`, `warehouse_id`, `action`, `qty`, `stock_document_id` | PK `repair_order_parts_pkey`; FK den repair_orders/spare_parts/warehouses/stock_documents; check action/qty |
| `cmdb_ci_types` | `code`, `name`, `description` | PK `cmdb_ci_types_pkey`; unique `cmdb_ci_types_code_key` |
| `cmdb_ci_type_versions` | `type_id`, `version`, `status`, `published_by` | PK `cmdb_ci_type_versions_pkey`; unique `(type_id,version)`; check status, version>0 |
| `cmdb_ci_schemas` | `version_id`, `attr_key`, `data_type`, `required`, `display_order` | PK `cmdb_ci_schemas_pkey`; unique `(version_id,attr_key)`; check data_type |
| `cmdb_cis` | `ci_code`, `type_id`, `asset_id`, `location_id`, `status`, `environment` | PK `cmdb_cis_pkey`; unique `cmdb_cis_ci_code_key`; FK den type/assets/locations; check status/environment |
| `cmdb_ci_attr_values` | `ci_id`, `schema_id`, `attr_key`, `value` | PK `cmdb_ci_attr_values_pkey`; unique `(ci_id,attr_key)`; FK den ci/schema |
| `cmdb_relationship_types` | `code`, `name`, `allowed_from_type_id`, `allowed_to_type_id` | PK `cmdb_relationship_types_pkey`; unique `cmdb_relationship_types_code_key`; FK den ci_types |
| `cmdb_relationships` | `type_id`, `from_ci_id`, `to_ci_id`, `status`, `metadata` | PK `cmdb_relationships_pkey`; unique `(type_id,from_ci_id,to_ci_id)`; check no self relationship |
| `cmdb_services` | `code`, `name`, `owner`, `criticality`, `status` | PK `cmdb_services_pkey`; unique `cmdb_services_code_key`; check criticality |
| `cmdb_service_cis` | `service_id`, `ci_id`, `role`, `is_primary` | PK `cmdb_service_cis_pkey`; unique `(service_id,ci_id)`; FK den service/ci |
| `users` | `username`, `email`, `password_hash`, `role`, `status`, `is_active` | PK `users_pkey`; unique `users_email_key`, `users_username_key` |
| `sessions` | `user_id`, `token`, `refresh_token`, `expires_at` | PK `sessions_pkey`; unique token/refresh token; FK `user_id -> users` |
| `ops_events` | `entity_type`, `entity_id`, `event_type`, `payload`, `actor_user_id`, `correlation_id` | PK `ops_events_pkey`; check `entity_type` enum |
| `audit_logs` | `user_id`, `action`, `entity_type`, `entity_id`, `details`, `correlation_id` | PK `audit_logs_pkey`; index by `user_id/action/correlation_id` |

## 4. Indexes va constraints
### 4.1 Index mau quan trong
- Assets: `idx_assets_status`, `idx_assets_location_id`, `idx_assets_warranty_end`.
- Stock: `idx_stock_documents_status`, `idx_stock_document_lines_doc`, `idx_spare_part_stock_lookup`, `idx_spare_part_movements_part`.
- Workflow/Inventory: `idx_workflow_requests_status`, `idx_inventory_sessions_status`, `idx_inventory_items_session`.
- CMDB: `idx_cis_type`, `idx_cis_status`, `idx_relationships_from/to/type`, `idx_services_code`.
- Audit/ops: `idx_audit_logs_user_action`, `idx_audit_logs_correlation`, `idx_ops_events_entity`.

### 4.2 Unique/consistency constraints mau
- `assets_asset_code_key` (ma tai san duy nhat).
- `spare_part_stock_warehouse_id_part_id_key` (1 record ton cho 1 part trong 1 kho).
- `cmdb_relationships_type_id_from_ci_id_to_ci_id_key` (quan he khong trung).
- `cmdb_cis_ci_code_key`, `cmdb_services_code_key`, `cmdb_ci_types_code_key`.

## 5. Business rules enforced in DB
Dang co enforce o cap DB bang `CHECK/UNIQUE/FK`, vi du:
- Asset status enum (`in_stock`, `in_use`, `in_repair`, ...).
- Stock document type/status enum (`receipt/issue/adjust/transfer`, `draft/posted/canceled`).
- Workflow request type/status enum.
- Repair order status/severity/type enum.
- No self relationship trong `cmdb_relationships`.

`CHUA TIM THAY`:
- Trigger/function DB de auto-posting/auto-audit.
- Stored procedure nghiep vu phuc tap.

## 6. Transaction patterns quan trong
- Posting stock document duoc thuc thi trong transaction (`unitOfWork.withTransaction`) de cap nhat ton + ghi movement + doi status document.
- Repair service co transaction khi post linh kien/xuat kho lien quan sua chua.
- Category specs/CMDB schema versioning dung transaction khi tao/publish version va clone defs.

## 7. Seed data
- `db/seed-assets-management.sql`: seed mau vendors/categories/locations/models/assets/assignments/events/maintenance/workflow/reminders/inventory.
- `db/seed-qlts-demo.sql`: seed du lieu purchase plan + asset increase + approvals + tao assets mau khi chung tu posted.
- `packages/infra-postgres/src/seeds/deterministic-seed.mjs`: seed deterministic theo schema introspection, co truncate/reseed/verify FK.

## 8. Evidence
- Schema nguon va create table list: `packages/infra-postgres/src/schema.sql:43-945`.
- PK constraints: `packages/infra-postgres/src/schema.sql:953-1505`.
- Unique constraints: `packages/infra-postgres/src/schema.sql:993-1489`.
- FK constraints: `packages/infra-postgres/src/schema.sql:2087-2479`.
- Indexes: `packages/infra-postgres/src/schema.sql:1512-2079`.
- Check constraints (mau): `packages/infra-postgres/src/schema.sql:213`, `packages/infra-postgres/src/schema.sql:485`, `packages/infra-postgres/src/schema.sql:839`, `packages/infra-postgres/src/schema.sql:944`.
- QLTS tables trong migration 026: `db/migrations/026_phase1_workflow_foundation.sql:68-150`, `db/migrations/026_phase1_workflow_foundation.sql:157-256`, `db/migrations/026_phase1_workflow_foundation.sql:7-26`.
- Setup service migration + seed execution: `apps/api/src/routes/setup/setup.service.ts:138-229`, `apps/api/src/routes/setup/setup.service.ts:599-600`.
- Transaction stock docs: `packages/application/src/maintenanceWarehouse/StockDocumentService.ts:90-130`, `packages/infra-postgres/src/repositories/WarehouseUnitOfWork.ts:13-24`.
- Repair transaction/event posting: `packages/application/src/maintenanceWarehouse/RepairService.ts:43-76`, `packages/application/src/maintenanceWarehouse/RepairService.ts:166`.
- Seed SQL files: `db/seed-assets-management.sql:8-181`, `db/seed-qlts-demo.sql:64-418`.
- Deterministic seed: `packages/infra-postgres/src/seeds/deterministic-seed.mjs:1284-1376`.
- Migration README note: `db/migrations/README.md:5-8`, `db/migrations/README.md:13-25`.
