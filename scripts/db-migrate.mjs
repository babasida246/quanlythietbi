#!/usr/bin/env node
/**
 * db-migrate.mjs — Run all migration SQL files directly against PostgreSQL,
 * in the exact same order as the Setup API (schema.sql → package migrations → db/migrations).
 *
 * Usage: node scripts/db-migrate.mjs
 *
 * Environment variables:
 *   DATABASE_URL  — PostgreSQL connection string (default: postgresql://postgres:postgres@localhost:5432/qltb)
 */
import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PKG_MIGRATIONS = join(ROOT, 'packages', 'infra-postgres', 'src', 'migrations')
const DB_MIGRATIONS = join(ROOT, 'db', 'migrations')
const ENV_PATH = join(ROOT, '.env')
const ENV_LOCAL_PATH = join(ROOT, '.env.local')

if (existsSync(ENV_PATH)) config({ path: ENV_PATH })
if (existsSync(ENV_LOCAL_PATH)) config({ path: ENV_LOCAL_PATH, override: true })

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'

// Strip psql meta-commands (\i, \echo, \set, \connect, etc.) and BOM — mirrors setup.service.ts executeSqlFile()
function stripMetaCommands(sql) {
    return sql
        .replace(/^\uFEFF/, '')
        .replace(/^\\[a-zA-Z!?:].*/gm, '')
        .trim()
}

// Ordered list mirrors 000_assets_bundle.sql + setup.service.ts getMigrationPlan()
// NOTE: Migrations 005, 008, 010, 015 are already included in schema.sql (the base dump)
// and are NOT in 000_assets_bundle.sql, so they are skipped here.
const MIGRATIONS = [
    // 1. Base schema (infra-postgres/src/schema.sql)
    { label: 'schema.sql', path: join(ROOT, 'packages', 'infra-postgres', 'src', 'schema.sql') },

    // 2. Package-level migrations (from 000_assets_bundle.sql order — starting at 020)
    { label: '020_assets_management_phase2.sql', path: join(PKG_MIGRATIONS, '020_assets_management_phase2.sql') },
    { label: '030_maintenance_warehouse.sql', path: join(PKG_MIGRATIONS, '030_maintenance_warehouse.sql') },
    { label: '035_asset_category_spec_defs.sql', path: join(PKG_MIGRATIONS, '035_asset_category_spec_defs.sql') },
    { label: '036_asset_category_spec_versions.sql', path: join(PKG_MIGRATIONS, '036_asset_category_spec_versions.sql') },
    { label: '037_cmdb.sql', path: join(PKG_MIGRATIONS, '037_cmdb.sql') },
    { label: '038_stock_documents_approval_status.sql', path: join(PKG_MIGRATIONS, '038_stock_documents_approval_status.sql') },
    { label: '039_workflow_issue_stock_request_type.sql', path: join(PKG_MIGRATIONS, '039_workflow_issue_stock_request_type.sql') },
    { label: '040_cmdb_change_management.sql', path: join(PKG_MIGRATIONS, '040_cmdb_change_management.sql') },
    { label: '041_cmdb_relationship_type_column_alignment.sql', path: join(PKG_MIGRATIONS, '041_cmdb_relationship_type_column_alignment.sql') },
    { label: '042_asset_status_catalogs.sql', path: join(PKG_MIGRATIONS, '042_asset_status_catalogs.sql') },

    // 3. db/migrations (same as API order)
    { label: '007_cmdb_core.sql', path: join(DB_MIGRATIONS, '007_cmdb_core.sql') },
    { label: '025_add_asset_spec.sql', path: join(DB_MIGRATIONS, '025_add_asset_spec.sql') },
    { label: '026_phase1_workflow_foundation.sql', path: join(DB_MIGRATIONS, '026_phase1_workflow_foundation.sql') },
    { label: '030_licenses_module.sql', path: join(DB_MIGRATIONS, '030_licenses_module.sql') },
    { label: '031_accessories_module.sql', path: join(DB_MIGRATIONS, '031_accessories_module.sql') },
    { label: '032_consumables_module.sql', path: join(DB_MIGRATIONS, '032_consumables_module.sql') },
    { label: '033_components_module.sql', path: join(DB_MIGRATIONS, '033_components_module.sql') },
    { label: '034_checkout_module.sql', path: join(DB_MIGRATIONS, '034_checkout_module.sql') },
    { label: '035_requests_module.sql', path: join(DB_MIGRATIONS, '035_requests_module.sql') },
    { label: '036_audit_module.sql', path: join(DB_MIGRATIONS, '036_audit_module.sql') },
    { label: '037_labels_module.sql', path: join(DB_MIGRATIONS, '037_labels_module.sql') },
    { label: '038_depreciation_module.sql', path: join(DB_MIGRATIONS, '038_depreciation_module.sql') },
    { label: '039_reports_alerts_module.sql', path: join(DB_MIGRATIONS, '039_reports_alerts_module.sql') },
    { label: '040_messaging_hub.sql', path: join(DB_MIGRATIONS, '040_messaging_hub.sql') },
    { label: '041_asset_status_catalog.sql', path: join(DB_MIGRATIONS, '041_asset_status_catalog.sql') },
    { label: '042_workflow_automation.sql', path: join(DB_MIGRATIONS, '042_workflow_automation.sql') },
    { label: '043_analytics_dashboard.sql', path: join(DB_MIGRATIONS, '043_analytics_dashboard.sql') },
    { label: '044_cmdb_enhancement.sql', path: join(DB_MIGRATIONS, '044_cmdb_enhancement.sql') },
    { label: '045_integration_hub.sql', path: join(DB_MIGRATIONS, '045_integration_hub.sql') },
    { label: '046_security_compliance.sql', path: join(DB_MIGRATIONS, '046_security_compliance.sql') },
    { label: '047_documents_module.sql', path: join(DB_MIGRATIONS, '047_documents_module.sql') },
    { label: '048_rename_spec_defs_table.sql', path: join(DB_MIGRATIONS, '048_rename_spec_defs_table.sql') },
    { label: '049_warehouse_improvements.sql', path: join(DB_MIGRATIONS, '049_warehouse_improvements.sql') },
    { label: '050_rbac_permissions.sql', path: join(DB_MIGRATIONS, '050_rbac_permissions.sql') },
    { label: '051_rbac_ad_model.sql', path: join(DB_MIGRATIONS, '051_rbac_ad_model.sql') },
    { label: '052_wf_module.sql', path: join(DB_MIGRATIONS, '052_wf_module.sql') },
    { label: '053_inv_enhancements.sql', path: join(DB_MIGRATIONS, '053_inv_enhancements.sql') },
    { label: '054_asset_warehouse_link.sql', path: join(DB_MIGRATIONS, '054_asset_warehouse_link.sql') },
    { label: '055_stock_receipt_issue_enhancements.sql', path: join(DB_MIGRATIONS, '055_stock_receipt_issue_enhancements.sql') },
    { label: '056_wf_request_lines.sql', path: join(DB_MIGRATIONS, '056_wf_request_lines.sql') },
    { label: '057_wf_enhancements.sql', path: join(DB_MIGRATIONS, '057_wf_enhancements.sql') },
    { label: '058_site_visibility_permissions.sql', path: join(DB_MIGRATIONS, '058_site_visibility_permissions.sql') },
    { label: '059_permission_center_unification.sql', path: join(DB_MIGRATIONS, '059_permission_center_unification.sql') },
    { label: '060_unified_policies.sql', path: join(DB_MIGRATIONS, '060_unified_policies.sql') },
    { label: '061_unify_permission_namespace.sql', path: join(DB_MIGRATIONS, '061_unify_permission_namespace.sql') },
    { label: '062_remove_site_visibility_permissions.sql', path: join(DB_MIGRATIONS, '062_remove_site_visibility_permissions.sql') },
    { label: '20260304_001_fix_wf_definitions_request_types.sql', path: join(DB_MIGRATIONS, '20260304_001_fix_wf_definitions_request_types.sql') },
    { label: '20260304_002_business_integrity_constraints.sql', path: join(DB_MIGRATIONS, '20260304_002_business_integrity_constraints.sql') },
    { label: '20260310_001_add_unit_cost_to_spare_parts.sql', path: join(DB_MIGRATIONS, '20260310_001_add_unit_cost_to_spare_parts.sql') },
    { label: '20260319_001_organizations_hierarchy.sql', path: join(DB_MIGRATIONS, '20260319_001_organizations_hierarchy.sql') },
    { label: '20260319_002_assignments_location_org.sql', path: join(DB_MIGRATIONS, '20260319_002_assignments_location_org.sql') },
    { label: '20260319_003_locations_organization_link.sql', path: join(DB_MIGRATIONS, '20260319_003_locations_organization_link.sql') },
    { label: '20260319_004_stock_doc_asset_lines.sql', path: join(DB_MIGRATIONS, '20260319_004_stock_doc_asset_lines.sql') },
    { label: '20260322_001_root_role.sql', path: join(DB_MIGRATIONS, '20260322_001_root_role.sql') },
    { label: '20260322_002_cmdb_config_files.sql', path: join(DB_MIGRATIONS, '20260322_002_cmdb_config_files.sql') },
]

const client = new pg.Client(DATABASE_URL)
await client.connect()

// Tạo bảng tracking migrations nếu chưa có
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

// Lấy danh sách migrations đã chạy
const { rows: applied_rows } = await client.query('SELECT label FROM schema_migrations')
const applied_set = new Set(applied_rows.map(r => r.label))

console.log(`\n📦  Running ${MIGRATIONS.length} migrations...`)
let applied = 0
let skipped = 0

try {
    for (const { label, path: filePath } of MIGRATIONS) {
        const rawSql = readFileSync(filePath, 'utf8')
        const sql = stripMetaCommands(rawSql)
        process.stdout.write(`  → ${label} ... `)
        // Bỏ qua nếu đã được apply
        if (applied_set.has(label)) {
            console.log('⏭  (already applied)')
            skipped++
            continue
        }
        if (!sql) {
            console.log('⏭  (empty after stripping)')
            continue
        }
        try {
            await client.query(sql)
            // schema.sql sets search_path='' — restore it for subsequent migrations
            if (label === 'schema.sql') {
                await client.query("SET search_path TO public")
            }
            // Ghi lại migration đã apply
            await client.query('INSERT INTO schema_migrations (label) VALUES ($1) ON CONFLICT DO NOTHING', [label])
            console.log('✅')
            applied++
        } catch (err) {
            // Các lỗi "already exists" (42P07=duplicate_table, 42701=duplicate_column,
            // 42710=duplicate_object, 42P16=invalid_table_definition) được coi là đã apply
            const ignoreCodes = new Set(['42P07', '42701', '42710', '42P16', '23505'])
            if (ignoreCodes.has(err.code)) {
                console.log('⚠️  (already exists, marking applied)')
                await client.query('INSERT INTO schema_migrations (label) VALUES ($1) ON CONFLICT DO NOTHING', [label])
                skipped++
            } else {
                console.log('❌')
                console.error(`\nError in ${label}:\n${err.message}`)
                process.exit(1)
            }
        }
    }
} finally {
    await client.end()
}

console.log(`\n✅ Migrations complete — ${applied} applied, ${skipped} skipped/${MIGRATIONS.length} total\n`)
