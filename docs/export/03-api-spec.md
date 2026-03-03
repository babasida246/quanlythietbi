# 03 - API Spec

## Muc luc
- [1. Nguyen tac chung](#1-nguyen-tac-chung)
- [2. Auth](#2-auth)
- [3. Setup](#3-setup)
- [4. Asset + Catalog + Specs](#4-asset--catalog--specs)
- [5. Maintenance + Inventory + Workflow](#5-maintenance--inventory--workflow)
- [6. Warehouse + Reports + Reminders](#6-warehouse--reports--reminders)
- [7. Communications](#7-communications)
- [8. CMDB](#8-cmdb)
- [9. QLTS (Purchase Plan / Asset Increase)](#9-qlts-purchase-plan--asset-increase)
- [10. Evidence](#10-evidence)

## 1. Nguyen tac chung
- Base API runtime: `/api/v1/*` (ngoai tru setup dung `/api/setup/*`).
- Response envelope co dang `createSuccessResponse/createErrorResponse`.
- Phan lon route business can `x-user-id` (bat buoc) va `x-user-role` (de check role) qua `getUserContext/requireRole`.
- RBAC backend dang theo role string (`admin`, `super_admin`, `it_asset_manager`, `catalog_admin`, ...).

## 2. Auth
| Method | Path | Auth/RBAC | Input | Output | File trien khai |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | Email + password | Access token + refresh token + user profile | `apps/api/src/routes/v1/auth/auth.routes.ts:308` |
| POST | `/api/v1/auth/refresh` | Refresh token | `refreshToken` | Cap token moi | `apps/api/src/routes/v1/auth/auth.routes.ts:357` |
| POST | `/api/v1/auth/logout` | Refresh token (neu co) | `refreshToken` | `{success:true}` | `apps/api/src/routes/v1/auth/auth.routes.ts:412` |
| GET | `/api/v1/auth/me` | Bearer JWT | Header `Authorization: Bearer ...` | User hien tai | `apps/api/src/routes/v1/auth/auth.routes.ts:441-443` |

## 3. Setup
| Method | Path | Auth/RBAC | Input | Output | File trien khai |
|---|---|---|---|---|---|
| GET | `/api/setup/status` | Public trong giai doan setup | none | setup status (db/migrations/seed/admin) | `apps/api/src/routes/setup/setup.routes.ts:260` |
| POST | `/api/setup/migrate` | Bi khoa sau finalize; rate-limited | none | Job accepted (`202`) | `apps/api/src/routes/setup/setup.routes.ts:265` |
| POST | `/api/setup/seed` | Bi khoa sau finalize; rate-limited | none | Job accepted (`202`) | `apps/api/src/routes/setup/setup.routes.ts:309` |
| GET | `/api/setup/jobs/:jobId` | Theo dõi job | path `jobId` | Job state/logs | `apps/api/src/routes/setup/setup.routes.ts:353` |
| POST | `/api/setup/admin` | Tao admin dau tien, chuan hoa input | body tao admin | Admin record | `apps/api/src/routes/setup/setup.routes.ts:378` |
| POST | `/api/setup/finalize` | Khoa setup APIs sau khi dat dieu kien | body finalize | completedAt/completedBy/version | `apps/api/src/routes/setup/setup.routes.ts:418` |

## 4. Asset + Catalog + Specs
### 4.1 Asset core
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/assets` | `x-user-id` | Query filters/pagination | Danh sach assets | `apps/api/src/routes/v1/assets/assets.routes.ts:58` |
| GET | `/api/v1/assets/status-counts` | `x-user-id` | Query | Thong ke theo status | `apps/api/src/routes/v1/assets/assets.routes.ts:75` |
| GET | `/api/v1/assets/export` | `x-user-id` | Query export | File/du lieu export | `apps/api/src/routes/v1/assets/assets.routes.ts:119` |
| POST | `/api/v1/assets` | `requireRole(it_asset_manager)` | Body create asset | Asset moi | `apps/api/src/routes/v1/assets/assets.routes.ts:127` |
| GET | `/api/v1/assets/:id` | `x-user-id` | Path id | Asset detail | `apps/api/src/routes/v1/assets/assets.routes.ts:137` |
| PUT | `/api/v1/assets/:id` | `requireRole(it_asset_manager)` | Body patch | Asset updated | `apps/api/src/routes/v1/assets/assets.routes.ts:144` |
| POST | `/api/v1/assets/:id/assign` | `requireRole(it_asset_manager)` | Assignee payload | Asset + assignment | `apps/api/src/routes/v1/assets/assets.routes.ts:152` |
| POST | `/api/v1/assets/:id/return` | `requireRole(it_asset_manager)` | Return note | Asset + assignment | `apps/api/src/routes/v1/assets/assets.routes.ts:160` |
| POST | `/api/v1/assets/:id/move` | `requireRole(it_asset_manager)` | `locationId` | Asset moved | `apps/api/src/routes/v1/assets/assets.routes.ts:168` |
| POST | `/api/v1/assets/:id/status` | `requireRole(it_asset_manager)` | `status` | Asset updated | `apps/api/src/routes/v1/assets/assets.routes.ts:176` |
| GET | `/api/v1/assets/:id/timeline` | `x-user-id` | Path id + query | Asset events | `apps/api/src/routes/v1/assets/assets.routes.ts:184` |

### 4.2 Catalog + dynamic specs
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/assets/catalogs` | `x-user-id` | none | categories/vendors/models/locations | `apps/api/src/routes/v1/assets/catalogs.routes.ts:28` |
| GET | `/api/v1/assets/catalogs/categories` | `x-user-id` | none | categories | `apps/api/src/routes/v1/assets/catalogs.routes.ts:34` |
| POST | `/api/v1/assets/catalogs/categories` | `requireRole(catalog_admin)` | category body | category | `apps/api/src/routes/v1/assets/catalogs.routes.ts:40` |
| PUT/DELETE | `/api/v1/assets/catalogs/categories/:id` | manager/admin | patch/delete | updated/deleted | `apps/api/src/routes/v1/assets/catalogs.routes.ts:47`, `apps/api/src/routes/v1/assets/catalogs.routes.ts:55` |
| GET/POST/PUT/DELETE | `/api/v1/assets/catalogs/vendors*` | read: user, write: manager | vendor payload | vendor data | `apps/api/src/routes/v1/assets/catalogs.routes.ts:62-84` |
| POST/PUT/DELETE | `/api/v1/assets/catalogs/models*` | manager | model payload | model data | `apps/api/src/routes/v1/assets/catalogs.routes.ts:90-106` |
| GET | `/api/v1/assets/catalogs/locations` | user | none | locations | `apps/api/src/routes/v1/assets/catalogs.routes.ts:112` |
| POST/PUT/DELETE | `/api/v1/assets/catalogs/locations*` | manager | location payload | location data | `apps/api/src/routes/v1/assets/catalogs.routes.ts:137-153` |
| GET | `/api/v1/asset-models` | user | query category/spec filters | filtered models | `apps/api/src/routes/v1/assets/catalogs.routes.ts:118` |
| GET/POST | `/api/v1/asset-categories` | read: user, write: catalog_admin | category body | category/version | `apps/api/src/routes/v1/assets/category-specs.routes.ts:32-39` |
| GET/POST | `/api/v1/asset-categories/:id/spec-defs` | read: user, write: catalog_admin | spec def body | spec defs | `apps/api/src/routes/v1/assets/category-specs.routes.ts:45-53` |
| POST | `/api/v1/asset-categories/:id/spec-defs/apply-template` | `catalog_admin` | template key | spec defs | `apps/api/src/routes/v1/assets/category-specs.routes.ts:65` |
| PUT/DELETE | `/api/v1/spec-defs/:specDefId` | `catalog_admin` | patch/delete | spec def/deleted | `apps/api/src/routes/v1/assets/category-specs.routes.ts:72-80` |
| GET/POST | `/api/v1/asset-categories/:id/spec-versions` | read: user, write: catalog_admin | version body | versions/version | `apps/api/src/routes/v1/assets/category-specs.routes.ts:87-95` |
| POST | `/api/v1/spec-versions/:versionId/publish` | `catalog_admin` | none | active version + warnings | `apps/api/src/routes/v1/assets/category-specs.routes.ts:101` |
| GET/POST | `/api/v1/spec-versions/:versionId/defs` | read user, write catalog_admin | spec def body | defs/def | `apps/api/src/routes/v1/assets/category-specs.routes.ts:108-116` |

### 4.3 Attachments + import
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| POST | `/api/v1/assets/:id/attachments` | `requireRole(it_asset_manager)` | multipart/meta | attachment metadata | `apps/api/src/routes/v1/assets/attachments.routes.ts:32` |
| GET | `/api/v1/assets/:id/attachments` | `x-user-id` | path id | list attachments | `apps/api/src/routes/v1/assets/attachments.routes.ts:61` |
| GET | `/api/v1/assets/:id/attachments/:attachmentId/download` | `x-user-id` | path ids | file stream | `apps/api/src/routes/v1/assets/attachments.routes.ts:68` |
| POST | `/api/v1/assets/import/preview` | manager | import payload | preview result | `apps/api/src/routes/v1/assets/assets.import.routes.ts:16` |
| POST | `/api/v1/assets/import/commit` | manager | commit payload | commit result | `apps/api/src/routes/v1/assets/assets.import.routes.ts:23` |

## 5. Maintenance + Inventory + Workflow
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/maintenance` | `x-user-id` | query | maintenance tickets | `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:21` |
| POST | `/api/v1/maintenance` | `requireRole(it_asset_manager)` | ticket body | created ticket | `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:31` |
| PUT | `/api/v1/maintenance/:id/status` | `requireRole(it_asset_manager)` | status patch | updated ticket | `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:39` |
| POST | `/api/v1/inventory/sessions` | manager | session body | created session | `apps/api/src/routes/v1/inventory/inventory.routes.ts:22` |
| GET | `/api/v1/inventory/sessions` | user | query | sessions page | `apps/api/src/routes/v1/inventory/inventory.routes.ts:29` |
| GET | `/api/v1/inventory/sessions/:id` | user | path id | session detail + items | `apps/api/src/routes/v1/inventory/inventory.routes.ts:39` |
| POST | `/api/v1/inventory/sessions/:id/scan` | manager | scan payload | inventory item | `apps/api/src/routes/v1/inventory/inventory.routes.ts:47` |
| POST | `/api/v1/inventory/sessions/:id/close` | manager | none | counts report | `apps/api/src/routes/v1/inventory/inventory.routes.ts:55` |
| GET | `/api/v1/inventory/sessions/:id/report` | user | path id | counts report | `apps/api/src/routes/v1/inventory/inventory.routes.ts:62` |
| POST | `/api/v1/workflows` | manager | request body | workflow request | `apps/api/src/routes/v1/workflow/workflow.routes.ts:23` |
| GET | `/api/v1/workflows` | user | query | workflow list | `apps/api/src/routes/v1/workflow/workflow.routes.ts:30` |
| GET | `/api/v1/workflows/:id` | user | path id | workflow detail | `apps/api/src/routes/v1/workflow/workflow.routes.ts:42` |
| POST | `/api/v1/workflows/:id/approve` | manager | none | approved request | `apps/api/src/routes/v1/workflow/workflow.routes.ts:53` |
| POST | `/api/v1/workflows/:id/reject` | manager | reason | rejected request | `apps/api/src/routes/v1/workflow/workflow.routes.ts:60` |
| POST | `/api/v1/workflows/:id/execute` | manager | none | executed request | `apps/api/src/routes/v1/workflow/workflow.routes.ts:68` |

## 6. Warehouse + Reports + Reminders
### 6.1 Warehouse + stock docs
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/warehouses` | user | query | warehouses | `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:26` |
| POST/PUT | `/api/v1/warehouses*` | manager | warehouse body | warehouse | `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:32-40` |
| GET | `/api/v1/spare-parts` | user | query | spare parts | `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:47` |
| POST/PUT | `/api/v1/spare-parts*` | manager | spare part body | spare part | `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:54-62` |
| GET | `/api/v1/stock/view` | user | query | stock view | `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:69` |
| GET | `/api/v1/stock-documents` | user | query | stock docs list | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:28` |
| GET | `/api/v1/stock-documents/:id` | user | path id | stock doc detail | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:35` |
| POST | `/api/v1/stock-documents` | manager | doc + lines | created doc | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:42` |
| PUT | `/api/v1/stock-documents/:id` | manager | patch doc/lines | updated doc | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:60` |
| POST | `/api/v1/stock-documents/:id/post` | manager | none | posted doc | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:75` |
| POST | `/api/v1/stock-documents/:id/cancel` | manager | none | canceled doc | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:82` |
| GET | `/api/v1/stock/ledger` | user | query | stock movements | `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:89` |

### 6.2 Reports + reminders
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/reports/test` | user | none | test payload | `apps/api/src/routes/v1/reports/reports.routes.ts:25` |
| GET | `/api/v1/reports/stock-on-hand` | user | query warehouse/part | rows | `apps/api/src/routes/v1/reports/reports.routes.ts:31` |
| GET | `/api/v1/reports/stock-available` | user | query | rows | `apps/api/src/routes/v1/reports/reports.routes.ts:44` |
| GET | `/api/v1/reports/reorder-alerts` | user | query threshold | rows | `apps/api/src/routes/v1/reports/reports.routes.ts:57` |
| GET | `/api/v1/reports/fefo-lots` | user | query | rows | `apps/api/src/routes/v1/reports/reports.routes.ts:70` |
| GET | `/api/v1/reports/valuation` | user | query valuation params | valuation result | `apps/api/src/routes/v1/reports/reports.routes.ts:83` |
| GET | `/api/v1/assets/reminders` | user | query due/status | reminders | `apps/api/src/routes/v1/reports/reminders.routes.ts:16` |
| POST | `/api/v1/assets/reminders/run` | `requireRole(admin)` | none | run result | `apps/api/src/routes/v1/reports/reminders.routes.ts:26` |

## 7. Communications
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/notifications` | `x-user-id` | query pagination/type | notifications | `apps/api/src/routes/v1/communications/communications.routes.ts:65` |
| POST | `/api/v1/notifications/:id/read` | `x-user-id` | path id | mark read result | `apps/api/src/routes/v1/communications/communications.routes.ts:155` |
| GET | `/api/v1/inbox` | `x-user-id` | query folder/page | inbox threads | `apps/api/src/routes/v1/communications/communications.routes.ts:179` |
| GET | `/api/v1/inbox/:id` | `x-user-id` | path id | inbox thread detail | `apps/api/src/routes/v1/communications/communications.routes.ts:252` |
| POST | `/api/v1/inbox/:id/reply` | `x-user-id` | reply payload | sent message | `apps/api/src/routes/v1/communications/communications.routes.ts:342` |

## 8. CMDB
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET/POST | `/api/v1/cmdb/types` | read user, write `catalog_admin` | type body | type list/type | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:61-68` |
| GET/POST | `/api/v1/cmdb/types/:id/versions` | read user, write `catalog_admin` | version body | versions/version | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:74-82` |
| POST | `/api/v1/cmdb/versions/:versionId/publish` | `catalog_admin` | none | active version | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:88` |
| GET/POST | `/api/v1/cmdb/versions/:versionId/attr-defs` | read user, write `catalog_admin` | attr-def body | defs/def | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:95-103` |
| PUT/DELETE | `/api/v1/cmdb/attr-defs/:id` | `catalog_admin` | patch/delete | updated/deleted | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:110-118` |
| GET/POST | `/api/v1/cmdb/cis` | read user, write `it_asset_manager` | CI body + attrs | CI list/created CI | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:125-133` |
| GET/PUT | `/api/v1/cmdb/cis/:id` | read user, write `it_asset_manager` | path + patch | CI detail/updated CI | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:140-148` |
| GET | `/api/v1/cmdb/cis/:id/graph` | user | depth/direction | graph | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:156` |
| GET | `/api/v1/cmdb/graph` | user | query | full graph | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:165` |
| GET | `/api/v1/cmdb/cis/:id/dependency-path` | user | direction | path/chain | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:173` |
| GET | `/api/v1/cmdb/cis/:id/impact` | user | depth | affected CIs | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:182` |
| GET/POST/PUT/DELETE | `/api/v1/cmdb/relationship-types*` | read user, write `it_asset_manager` | rel-type body | rel-type data | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:189-211` |
| GET/POST | `/api/v1/cmdb/cis/:id/relationships` | read user, write `it_asset_manager` | rel body | relationships | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:217-226` |
| POST/DELETE | `/api/v1/cmdb/relationships*` | manager | rel create/delete | relation result | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:233-241` |
| GET/POST | `/api/v1/cmdb/services` | read user, write `it_asset_manager` | service body | services/service | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:247-255` |
| GET/PUT | `/api/v1/cmdb/services/:id` | read user, write `it_asset_manager` | patch | service detail/updated | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:261-269` |
| POST/DELETE | `/api/v1/cmdb/services/:id/members*` | manager | member payload | member result | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:276-285` |
| GET | `/api/v1/cmdb/services/:id/impact` | user | depth | graph impact | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:291` |
| GET | `/api/v1/cmdb/reports/ci-inventory` | user | filters | report | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:300` |
| GET | `/api/v1/cmdb/reports/relationship-analytics` | user | filters | report | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:311` |
| GET | `/api/v1/cmdb/reports/audit-trail` | user | ciId/start/end | report | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:322` |
| GET | `/api/v1/cmdb/reports/export/:reportType` | user | `format` query | CSV/PDF stream | `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:338` |

## 9. QLTS (Purchase Plan / Asset Increase)
| Method | Path | Auth/RBAC | Input | Output | File |
|---|---|---|---|---|---|
| GET | `/api/v1/assets/purchase-plans/suggestions` | user context (`request.user` fallback `system`) | query model/category | suggestions | `apps/api/src/modules/qlts/routes/purchasePlans.ts:78` |
| POST | `/api/v1/assets/purchase-plans` | user context | body doc + lines | created doc | `apps/api/src/modules/qlts/routes/purchasePlans.ts:85` |
| GET/GET by id/PUT | `/api/v1/assets/purchase-plans*` | user context | list/detail/update | docs/doc | `apps/api/src/modules/qlts/routes/purchasePlans.ts:103-128` |
| POST | `/api/v1/assets/purchase-plans/:id/submit` | workflow transition check | approvers | submitted + approvals | `apps/api/src/modules/qlts/routes/purchasePlans.ts:151` |
| POST | `/api/v1/assets/purchase-plans/:id/approve` | approval actor | approvalId + note | approved state | `apps/api/src/modules/qlts/routes/purchasePlans.ts:173` |
| POST | `/api/v1/assets/purchase-plans/:id/reject` | approval actor | approvalId + note | rejected state | `apps/api/src/modules/qlts/routes/purchasePlans.ts:191` |
| POST | `/api/v1/assets/purchase-plans/:id/post` | transition check | none | posted state | `apps/api/src/modules/qlts/routes/purchasePlans.ts:207` |
| DELETE | `/api/v1/assets/purchase-plans/:id/cancel` | draft/submitted only | none | cancelled state | `apps/api/src/modules/qlts/routes/purchasePlans.ts:226` |
| POST | `/api/v1/assets/asset-increases` | user context | body doc + lines | created doc | `apps/api/src/modules/qlts/routes/assetIncreases.ts:23` |
| GET/GET by id/PUT | `/api/v1/assets/asset-increases*` | user context | list/detail/update | docs/doc | `apps/api/src/modules/qlts/routes/assetIncreases.ts:31-56` |
| POST | `/api/v1/assets/asset-increases/:id/submit` | transition check | approvers | submitted + approvals | `apps/api/src/modules/qlts/routes/assetIncreases.ts:81` |
| POST | `/api/v1/assets/asset-increases/:id/approve` | approval actor | approvalId + note | approved state | `apps/api/src/modules/qlts/routes/assetIncreases.ts:103` |
| POST | `/api/v1/assets/asset-increases/:id/reject` | approval actor | approvalId + note | rejected state | `apps/api/src/modules/qlts/routes/assetIncreases.ts:121` |
| POST | `/api/v1/assets/asset-increases/:id/post` | transition check + transaction | none | posted + assetsCreated | `apps/api/src/modules/qlts/routes/assetIncreases.ts:137` |
| DELETE | `/api/v1/assets/asset-increases/:id/cancel` | draft/submitted only | none | cancelled state | `apps/api/src/modules/qlts/routes/assetIncreases.ts:213` |

## 10. Evidence
- Prefix registration: `apps/api/src/routes/v1/auth/auth.module.ts:23`, `apps/api/src/routes/setup/setup.module.ts:19`, `apps/api/src/routes/v1/assets/assets.module.ts:156-170`, `apps/api/src/routes/v1/assets/assets.module.ts:193`.
- Role/context helper: `apps/api/src/routes/v1/assets/assets.helpers.ts:18-29`.
- Auth routes: `apps/api/src/routes/v1/auth/auth.routes.ts:308-504`.
- Setup routes: `apps/api/src/routes/setup/setup.routes.ts:260-440`.
- Asset/catalog/spec/import/attachments: `apps/api/src/routes/v1/assets/assets.routes.ts:58-190`, `apps/api/src/routes/v1/assets/catalogs.routes.ts:28-157`, `apps/api/src/routes/v1/assets/category-specs.routes.ts:32-121`, `apps/api/src/routes/v1/assets/assets.import.routes.ts:16-28`, `apps/api/src/routes/v1/assets/attachments.routes.ts:32-89`.
- Maintenance/inventory/workflow: `apps/api/src/routes/v1/maintenance/maintenance.routes.ts:21-49`, `apps/api/src/routes/v1/inventory/inventory.routes.ts:22-72`, `apps/api/src/routes/v1/workflow/workflow.routes.ts:23-73`.
- Warehouse/report/reminder: `apps/api/src/routes/v1/warehouse/warehouse.routes.ts:26-80`, `apps/api/src/routes/v1/warehouse/stock-documents.routes.ts:28-94`, `apps/api/src/routes/v1/reports/reports.routes.ts:25-93`, `apps/api/src/routes/v1/reports/reminders.routes.ts:16-32`.
- Communications: `apps/api/src/routes/v1/communications/communications.routes.ts:65-425`.
- CMDB: `apps/api/src/routes/v1/cmdb/cmdb.routes.ts:61-415`.
- QLTS: `apps/api/src/modules/qlts/routes/purchasePlans.ts:78-241`, `apps/api/src/modules/qlts/routes/assetIncreases.ts:23-228`.
