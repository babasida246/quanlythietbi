-- ============================================================================
-- seed-all.sql — Docker psql orchestrator
-- Usage: psql -U postgres -d qltb -f /tmp/seed-all.sql
-- Run order matters due to FK dependencies
-- ============================================================================

-- 1. Foundation: users, locations, vendors, orgs, categories
\i seed-data.sql

-- 2. Asset catalog: models, warehouses, spare parts catalog, categories
\i seed-assets-management.sql

-- 3. Assets (50 units) + transactions: assignments, checkouts, maintenance, requests
\i seed-assets.sql

-- 4. Accessories, consumables, components, licenses
\i seed-accessories.sql

-- 5. Warehouse stock, purchase plans
\i seed-warehouse.sql

-- 6. Inventory audit, depreciation, CMDB extras, compliance, documents
\i seed-inventory-audit.sql

-- 7. Analytics: reports, dashboards, labels, print jobs, asset metrics
\i seed-analytics.sql

-- 8. AI/Chat: providers, models, channels, conversations, usage
\i seed-chat-ai.sql

-- 9. Workflows: WF definitions, automation rules, events, attachments
\i seed-workflows.sql

-- 10. Ops: alerts, notifications, integrations, sessions, RBAC
\i seed-ops.sql

-- 11. CMDB & WF demo data (depends on assets existing)
\i seed-qlts-demo.sql

-- 12. CMDB services extended data
\i seed-cmdb.sql
