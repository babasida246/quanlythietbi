-- Database Optimization: Composite Indexes for CMDB Performance
-- Sprint 1.4 - Phase 4: Database Optimization
-- Created: 2026-01-22
-- Purpose: Add composite indexes to support 100K+ CIs with sub-100ms query times

-- ============================================================================
-- CI Table Indexes
-- ============================================================================

-- Index for filtering CIs by type, status, and environment
-- Supports queries like: SELECT * FROM configuration_items WHERE type = 'server' AND status = 'active' AND environment = 'production'
CREATE INDEX IF NOT EXISTS idx_ci_type_status_environment 
ON configuration_items (type, status, environment) 
WHERE deleted_at IS NULL;

-- Index for CI discovery and inventory queries
-- Supports queries: SELECT * FROM configuration_items WHERE type = 'network_device' AND environment = 'production'
CREATE INDEX IF NOT EXISTS idx_ci_type_environment 
ON configuration_items (type, environment) 
WHERE deleted_at IS NULL;

-- Index for status-based filtering
-- Supports queries: SELECT * FROM configuration_items WHERE status = 'active' ORDER BY last_discovered_at DESC
CREATE INDEX IF NOT EXISTS idx_ci_status_discovered 
ON configuration_items (status, last_discovered_at DESC) 
WHERE deleted_at IS NULL;

-- Index for CI name searches (case-insensitive)
-- Supports queries: SELECT * FROM configuration_items WHERE LOWER(name) LIKE '%server%'
CREATE INDEX IF NOT EXISTS idx_ci_name_lower 
ON configuration_items (LOWER(name)) 
WHERE deleted_at IS NULL;

-- Index for finding CIs by external ID
-- Supports queries: SELECT * FROM configuration_items WHERE external_id = 'ext-12345'
CREATE INDEX IF NOT EXISTS idx_ci_external_id 
ON configuration_items (external_id) 
WHERE external_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- CI Relationships Table Indexes
-- ============================================================================

-- Index for finding relationships by source CI
-- Supports queries: SELECT * FROM ci_relationships WHERE source_ci_id = 123
CREATE INDEX IF NOT EXISTS idx_relationships_source 
ON ci_relationships (source_ci_id, relationship_type);

-- Index for finding relationships by target CI
-- Supports queries: SELECT * FROM ci_relationships WHERE target_ci_id = 456
CREATE INDEX IF NOT EXISTS idx_relationships_target 
ON ci_relationships (target_ci_id, relationship_type);

-- Composite index for bidirectional relationship queries
-- Supports queries: Finding all relationships between two CIs regardless of direction
CREATE INDEX IF NOT EXISTS idx_relationships_source_target_type 
ON ci_relationships (source_ci_id, target_ci_id, relationship_type);

-- Index for relationship type analytics
-- Supports queries: SELECT relationship_type, COUNT(*) FROM ci_relationships GROUP BY relationship_type
CREATE INDEX IF NOT EXISTS idx_relationships_type 
ON ci_relationships (relationship_type);

-- ============================================================================
-- Audit Log Indexes
-- ============================================================================

-- Index for audit queries by CI and timestamp
-- Supports queries: SELECT * FROM ci_audit_log WHERE ci_id = 123 ORDER BY changed_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_ci_timestamp 
ON ci_audit_log (ci_id, changed_at DESC);

-- Index for audit queries by user and timestamp
-- Supports queries: SELECT * FROM ci_audit_log WHERE changed_by = 'user@example.com' ORDER BY changed_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp 
ON ci_audit_log (changed_by, changed_at DESC);

-- Index for audit queries by operation type
-- Supports queries: SELECT * FROM ci_audit_log WHERE operation = 'UPDATE' AND changed_at >= NOW() - INTERVAL '24 hours'
CREATE INDEX IF NOT EXISTS idx_audit_operation_timestamp 
ON ci_audit_log (operation, changed_at DESC);

-- Index for recent audit entries (last 30 days)
-- Supports queries: SELECT * FROM ci_audit_log WHERE changed_at >= NOW() - INTERVAL '30 days' ORDER BY changed_at DESC
CREATE INDEX IF NOT EXISTS idx_audit_recent 
ON ci_audit_log (changed_at DESC) 
WHERE changed_at >= NOW() - INTERVAL '30 days';

-- ============================================================================
-- CI Attributes Indexes (if using JSON attributes)
-- ============================================================================

-- GIN index for JSON attribute searches (if attributes stored as JSONB)
-- Supports queries: SELECT * FROM configuration_items WHERE attributes @> '{"cpu_cores": 8}'
-- Note: Uncomment if using JSONB column for attributes
-- CREATE INDEX IF NOT EXISTS idx_ci_attributes_gin 
-- ON configuration_items USING GIN (attributes);

-- ============================================================================
-- Performance Statistics
-- ============================================================================

-- Create a table to track index usage and query performance
CREATE TABLE IF NOT EXISTS index_performance_stats (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    index_name VARCHAR(255) NOT NULL,
    query_description TEXT,
    avg_execution_time_ms DECIMAL(10, 2),
    queries_per_second DECIMAL(10, 2),
    last_measured_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(table_name, index_name)
);

-- ============================================================================
-- Maintenance Recommendations
-- ============================================================================

-- To monitor index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- To find unused indexes:
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_toast%'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- To analyze table and index sizes:
-- SELECT tablename,
--        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
--        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
--        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Run VACUUM ANALYZE after creating indexes
VACUUM ANALYZE configuration_items;
VACUUM ANALYZE ci_relationships;
VACUUM ANALYZE ci_audit_log;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify indexes were created
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    tablename = 'configuration_items'
    OR tablename = 'ci_relationships'
    OR tablename = 'ci_audit_log'
)
ORDER BY tablename, indexname;
