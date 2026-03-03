# Assets Clone — Inventory (Nguồn ➜ Đích)

> Bản đồ đầy đủ các file/module đã copy từ nguồn sang `QuanLyThietBi/`.
> Tuyệt đối không có import trỏ ngược lại nguồn.

---

## 1. Packages (shared libraries)

### @qltb/domain (từ @domain/core)
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| packages/domain/src/assets/*.ts | packages/domain/src/assets/*.ts | Domain entities: Asset, Assignment, Maintenance, Attachment, Inventory, Workflow, CategorySpec, Event, types |
| packages/domain/src/core/** | packages/domain/src/core/** | Core: AppError, DomainError, Conversation, Value Objects |
| packages/domain/src/maintenanceWarehouse/** | packages/domain/src/maintenanceWarehouse/** | Warehouse domain types |
| packages/domain/src/cmdb/** | packages/domain/src/cmdb/** | CMDB domain: Ci, CiSchema, Relationship, Service, types |
| packages/domain/src/index.ts | packages/domain/src/index.ts | Barrel export |

### @qltb/contracts (từ @contracts/shared)
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| packages/contracts/src/assets/** | packages/contracts/src/assets/** | Asset contracts: index, catalogs, categorySpecs, attachments, inventory, reminders, workflow |
| packages/contracts/src/maintenanceWarehouse/** | packages/contracts/src/maintenanceWarehouse/** | Warehouse contracts: warehouses, spareParts, stockDocuments, stockMovements, repairs, reports, attachments, transactions |
| packages/contracts/src/cmdb/** | packages/contracts/src/cmdb/** | CMDB contracts: types, repos, index |
| packages/contracts/src/index.ts | packages/contracts/src/index.ts | Barrel export |

### @qltb/application (từ @application/core)
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| packages/application/src/assets/** | packages/application/src/assets/** | 26 files: AssetService, CatalogService, CategorySpecService, AttachmentService, InventoryService, MaintenanceService, ReminderService, WorkflowService + spec helpers + tests |
| packages/application/src/maintenanceWarehouse/** | packages/application/src/maintenanceWarehouse/** | 14 files: WarehouseCatalogService, StockDocumentService, StockReportService, StockService, RepairService, OpsAttachmentService + tests |
| packages/application/src/core/** | packages/application/src/core/** | types.ts, PolicyEngine, RouterEngine, QualityChecker, ExecutorEngine, ChatOrchestrator + tests |
| packages/application/src/index.ts | packages/application/src/index.ts | Barrel export |

### @qltb/infra-postgres (từ @infra/postgres)
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| packages/infra-postgres/src/PgClient.ts | packages/infra-postgres/src/PgClient.ts | Pg pool wrapper |
| packages/infra-postgres/src/repositories/** | packages/infra-postgres/src/repositories/** | 63 files: AssetRepo, CatalogRepo, InventoryRepo, MaintenanceRepo, WorkflowRepo, WarehouseRepo, CiRepo, etc. |
| packages/infra-postgres/src/index.ts | packages/infra-postgres/src/index.ts | Barrel export |

---

## 2. API (apps/api)

### Route modules
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| apps/api/src/routes/v1/assets/** (19 files) | apps/api/src/routes/v1/assets/** | Asset CRUD, catalogs, category-specs, attachments, import, schemas, module wiring |
| apps/api/src/routes/v1/maintenance/** (3 files) | apps/api/src/routes/v1/maintenance/** | Maintenance routes & schemas |
| apps/api/src/routes/v1/inventory/** (3 files) | apps/api/src/routes/v1/inventory/** | Inventory routes & schemas |
| apps/api/src/routes/v1/workflow/** (3 files) | apps/api/src/routes/v1/workflow/** | Workflow routes & schemas |
| apps/api/src/routes/v1/reports/** (4 files) | apps/api/src/routes/v1/reports/** | Reminders & reports routes |
| apps/api/src/routes/v1/warehouse/** (2 files) | apps/api/src/routes/v1/warehouse/** | Warehouse & stock-docs routes |
| apps/api/src/routes/v1/cmdb/** (3 files) | apps/api/src/routes/v1/cmdb/** | CMDB routes & schemas |

### QLTS module
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| apps/api/src/modules/qlts/** (7 files) | apps/api/src/modules/qlts/** | Purchase plans, asset increases routes/schemas/services |

### Core/shared
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| apps/api/src/core/middleware/** | apps/api/src/core/middleware/** | error.handler, request.hooks |
| apps/api/src/core/plugins/** | apps/api/src/core/plugins/** | security.plugin, docs.plugin |
| apps/api/src/shared/** | apps/api/src/shared/** | HTTP errors, API types, response utils |
| apps/api/src/locales/** | apps/api/src/locales/** | i18n translation files (en, vi) |
| apps/api/src/config/i18n.ts | apps/api/src/config/i18n.ts | i18n init |

### New/modified in QLTB
| File | Mục đích |
|------|----------|
| apps/api/src/core/app.ts | **MỚI** — Simplified app factory (assets-only, no Redis/Chat/MessagingHub) |
| apps/api/src/core/server.ts | **MỚI** — Simplified server startup (no Redis) |
| apps/api/src/config/env.ts | **SỬA** — Removed Redis/JWT/LLM/ChatOps env vars, kept DATABASE_URL + basics |

---

## 3. Database

| Nguồn | Đích | Mục đích |
|-------|------|----------|
| db/migrations/007_cmdb_core.sql | db/migrations/007_cmdb_core.sql | CMDB tables |
| db/migrations/025_add_asset_spec.sql | db/migrations/025_add_asset_spec.sql | Asset specifications |
| db/migrations/026_phase1_workflow_foundation.sql | db/migrations/026_phase1_workflow_foundation.sql | Workflow foundation |
| db/migrations/030-039_*.sql | db/migrations/030-039_*.sql | Licenses, accessories, consumables, components, checkout, requests, audit, labels, depreciation, reports/alerts |
| db/seed-data.sql | db/seed-data.sql | Base data |
| db/seed-assets-management.sql | db/seed-assets-management.sql | Asset management seed |
| db/seed-qlts-demo.sql | db/seed-qlts-demo.sql | QLTS demo data |

---

## 4. Web UI (apps/web-ui)

### Routes
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| apps/web-ui/src/routes/(assets)/** | apps/web-ui/src/routes/(assets)/** | All asset pages: list, [id], catalogs, purchase-plans, asset-increases, CMDB, inventory, maintenance, warehouse, reports, requests, me/* |
| apps/web-ui/src/routes/+layout.svelte | apps/web-ui/src/routes/+layout.svelte | Root layout with sidebar navigation |
| apps/web-ui/src/routes/+layout.ts | apps/web-ui/src/routes/+layout.ts | SSR config |
| apps/web-ui/src/routes/+page.svelte | apps/web-ui/src/routes/+page.svelte | Root redirect |

### Libraries
| Nguồn | Đích | Mục đích |
|-------|------|----------|
| apps/web-ui/src/lib/assets/** | apps/web-ui/src/lib/assets/** | Asset components (table, filters, modal, import wizard) |
| apps/web-ui/src/lib/api/** | apps/web-ui/src/lib/api/** | API client functions |
| apps/web-ui/src/lib/auth/** | apps/web-ui/src/lib/auth/** | Capabilities/RBAC checks |
| apps/web-ui/src/lib/components/** | apps/web-ui/src/lib/components/** | Shared components (LanguageSwitcher, etc.) |
| apps/web-ui/src/lib/i18n/** | apps/web-ui/src/lib/i18n/** | i18n setup |
| apps/web-ui/src/lib/stores/** | apps/web-ui/src/lib/stores/** | Svelte stores |
| apps/web-ui/src/lib/types/** | apps/web-ui/src/lib/types/** | Shared types |
| apps/web-ui/src/lib/warehouse/** | apps/web-ui/src/lib/warehouse/** | Warehouse components |
| apps/web-ui/src/lib/cmdb/** | apps/web-ui/src/lib/cmdb/** | CMDB components |

---

## 5. Import dependency map

```
@qltb/domain          ← no deps (base)
@qltb/contracts       ← @qltb/domain
@qltb/application     ← @qltb/domain, @qltb/contracts
@qltb/infra-postgres  ← @qltb/domain, @qltb/contracts
@qltb/api             ← @qltb/application, @qltb/contracts, @qltb/domain, @qltb/infra-postgres
```

## 6. Files NOT cloned (intentionally excluded)

- Chat/Conversations modules (IntegratedChatService, etc.)
- Auth module (JWT/RBAC — using x-user-id header stub)
- Messaging Hub (Telegram/Discord/Email ChatOps)
- NetOps module
- Tools module
- External servers
- Redis infrastructure
- LLM providers
- Observability/monitoring
- Gateway CLI
- Gateway MCP

---

*Generated on 2026-02-08 during assets clone from source workspace.*
