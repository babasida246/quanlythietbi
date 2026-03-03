# Database Migrations

## Current Status

The database schema is **fully defined in**:
- **`db/init-complete.sql`** - Complete schema dump from production database
- **`packages/infra-postgres/src/schema.sql`** - Schema used by application (synced with init-complete.sql)

## Migration Files

### Active Migrations

- **`007_cmdb_core.sql`** - CMDB (Configuration Management Database) core tables
  - CI types, CI instances, relationships, services
  - Currently in use

### Deprecated Migrations (`.deprecated` extension)

The following migrations are **NO LONGER USED** and have been deprecated:

- `003_inventory_core.sql.deprecated` - Old inventory system with organizations, parties
- `004_inventory_documents.sql.deprecated` - Old document-based inventory operations  
- `005_inventory_costing.sql.deprecated` - Old inventory costing/valuation
- `006_inventory_seed.sql.deprecated` - Old inventory seed data

**Why deprecated?**  
The database was refactored from a generic inventory management system to a specialized **IT Asset Management & CMDB** system. The current schema focuses on:
- IT assets (network devices, servers, etc.)
- Asset models and categories
- Spare parts and warehouses (simplified)
- Inventory sessions (physical inventory checks)
- Stock documents (spare parts)
- CMDB for service mapping

## Database Initialization

### From Scratch

To initialize a new database with the complete current schema:

```bash
docker exec -i netopsai-gateway-postgres psql -U postgres -d netopsai_gateway -f /tmp/init-complete.sql
```

Or copy the file first:

```bash
docker cp db/init-complete.sql netopsai-gateway-postgres:/tmp/
docker exec -i netopsai-gateway-postgres psql -U postgres -d netopsai_gateway -f /tmp/init-complete.sql
```

### Seed Data

After initialization, load seed data:

```bash
docker cp db/seed-data.sql netopsai-gateway-postgres:/tmp/
docker exec -i netopsai-gateway-postgres psql -U postgres -d netopsai_gateway -f /tmp/seed-data.sql
```

## Schema Updates

When making schema changes:

1. **Update the running database** using ALTER statements
2. **Export the new schema**:
   ```bash
   docker exec -i netopsai-gateway-postgres pg_dump -U postgres -d netopsai_gateway --schema-only --no-owner --no-acl > db/init-complete.sql
   ```
3. **Sync to application schema**:
   ```bash
   cp db/init-complete.sql packages/infra-postgres/src/schema.sql
   ```
4. **Test** by recreating database from init-complete.sql

## Current Schema Overview

### Core Application Tables
- `conversations`, `messages` - Chat/conversation management
- `users`, `sessions` - Authentication
- `model_configs`, `ai_providers` - AI model configuration
- `orchestration_rules` - Model routing rules
- `usage_logs`, `audit_logs` - Telemetry

### IT Asset Management
- `assets`, `asset_models`, `asset_categories` - Asset inventory
- `asset_category_spec_defs`, `asset_category_spec_versions` - Dynamic asset specs
- `asset_assignments`, `asset_attachments`, `asset_events` - Asset lifecycle
- `vendors` - Vendors/suppliers
- `locations` - Physical locations hierarchy

### Warehouse & Spare Parts
- `warehouses` - Simplified warehouse (no org_id)
- `spare_parts`, `spare_part_stock`, `spare_part_movements` - Parts inventory
- `stock_documents`, `stock_document_lines` - Stock transactions
- `repair_orders`, `repair_order_parts` - Maintenance/repair

### Inventory Sessions
- `inventory_sessions` - Physical inventory check sessions
- `inventory_items` - Scanned items during inventory

### CMDB (Configuration Management)
- `cmdb_ci_types`, `cmdb_ci_type_versions` - CI type definitions
- `cmdb_cis`, `cmdb_ci_attr_values` - Configuration Items
- `cmdb_relationship_types`, `cmdb_relationships` - CI relationships
- `cmdb_services`, `cmdb_service_cis` - Business services mapped to CIs

### Other
- `maintenance_tickets` - Maintenance tracking
- `workflow_requests` - Workflow engine
- `reminders` - Scheduled reminders
- `ops_events` - Operational events
- `attachments`, `chat_contexts` - Supporting tables

## Notes

- **No `organizations` table** in current schema (multi-tenancy removed)
- **No `parties` table** (replaced by `vendors`)
- **`inventory_items`** is for inventory session scanning, NOT generic inventory
- **`warehouses`** is simplified (no org_id, warehouse_type, etc.)
- All migrations pre-007 are deprecated due to major refactor
