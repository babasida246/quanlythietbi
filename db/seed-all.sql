-- ============================================================================
-- seed-all.sql — Chạy toàn bộ seed data theo thứ tự phụ thuộc
-- Sử dụng:
--   docker cp db/ qltb-postgres:/tmp/db/
--   docker exec -i qltb-postgres psql -U postgres -d qltb -f /tmp/db/seed-all.sql
-- Hoặc chạy từng file:
--   docker cp db/seed-data.sql qltb-postgres:/tmp/
--   docker exec -i qltb-postgres psql -U postgres -d qltb -f /tmp/seed-data.sql
-- ============================================================================

\echo '=== [1/3] Seeding foundation data (users, CMDB types) ==='
\i /tmp/seed-data.sql

\echo '=== [2/3] Seeding assets management (vendors, assets, warehouse, repairs, licenses, accessories, components) ==='
\i /tmp/seed-assets-management.sql

\echo '=== [3/3] Seeding CMDB CIs, services, purchase plans, workflows ==='
\i /tmp/seed-qlts-demo.sql

\echo '=== DONE — All seed data loaded successfully ==='
