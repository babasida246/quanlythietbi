#!/bin/bash

# Seed test data for Playwright tests
# Creates realistic test data for comprehensive testing

set -e

echo "🌱 Seeding test data for Playwright tests..."

# Database connection (adjust as needed)
DB_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/assets_test"}

# Function to execute SQL
run_sql() {
    psql "$DB_URL" -c "$1"
}

# Create test users with different roles
echo "👥 Creating test users..."
run_sql "
INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at) 
VALUES 
    ('test-admin-001', 'admin@test.com', '$2b$10$hash', 'Test Administrator', 'admin', NOW(), NOW()),
    ('test-manager-001', 'manager@test.com', '$2b$10$hash', 'Test Manager', 'manager', NOW(), NOW()),
    ('test-user-001', 'user@test.com', '$2b$10$hash', 'Test User', 'user', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();
"

# Create test assets
echo "📱 Creating test assets..."
run_sql "
INSERT INTO assets (id, name, category, status, location, assigned_to, created_at) 
VALUES 
    ('asset-001', 'Test Laptop Dell XPS 13', 'Computer', 'Available', 'IT Room 101', NULL, NOW()),
    ('asset-002', 'Test iPhone 14 Pro', 'Mobile Device', 'Assigned', 'Engineering Floor', 'test-user-001', NOW()),
    ('asset-003', 'Test Projector BenQ', 'AV Equipment', 'Maintenance', 'Conference Room A', NULL, NOW())
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    updated_at = NOW();
"

# Create test chat messages
echo "💬 Creating test chat messages..."
run_sql "
INSERT INTO chat_messages (id, user_id, message, created_at) 
VALUES 
    ('msg-001', 'test-admin-001', 'Welcome to the test environment!', NOW() - INTERVAL '1 hour'),
    ('msg-002', 'test-user-001', 'Testing chat functionality', NOW() - INTERVAL '30 minutes'),
    ('msg-003', 'test-manager-001', 'Asset management system is working well', NOW() - INTERVAL '15 minutes')
ON CONFLICT (id) DO UPDATE SET 
    message = EXCLUDED.message;
"

# Create test audit logs
echo "📝 Creating test audit logs..."
run_sql "
INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, created_at) 
VALUES 
    ('log-001', 'test-admin-001', 'CREATE', 'asset', 'asset-001', '{\"name\": \"Test Laptop\"}', NOW() - INTERVAL '2 hours'),
    ('log-002', 'test-user-001', 'VIEW', 'asset', 'asset-002', '{\"viewed_from\": \"dashboard\"}', NOW() - INTERVAL '1 hour'),
    ('log-003', 'test-manager-001', 'UPDATE', 'asset', 'asset-003', '{\"status\": \"Maintenance\"}', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO UPDATE SET 
    details = EXCLUDED.details;
"

# Create test notifications
echo "🔔 Creating test notifications..."
run_sql "
INSERT INTO notifications (id, user_id, title, message, type, read_at, created_at) 
VALUES 
    ('notif-001', 'test-user-001', 'Asset Assigned', 'iPhone 14 Pro has been assigned to you', 'assignment', NULL, NOW() - INTERVAL '45 minutes'),
    ('notif-002', 'test-admin-001', 'Maintenance Required', 'Projector BenQ requires maintenance', 'alert', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '1 hour'),
    ('notif-003', 'test-manager-001', 'Monthly Report', 'Asset utilization report is ready', 'info', NULL, NOW() - INTERVAL '10 minutes')
ON CONFLICT (id) DO UPDATE SET 
    message = EXCLUDED.message;
"

# Create test settings
echo "⚙️ Creating test settings..."
run_sql "
INSERT INTO system_settings (key, value, description, updated_by, updated_at) 
VALUES 
    ('maintenance_interval', '30', 'Days between maintenance checks', 'test-admin-001', NOW()),
    ('max_assignments', '5', 'Maximum assets per user', 'test-admin-001', NOW()),
    ('notification_email', 'true', 'Enable email notifications', 'test-admin-001', NOW())
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();
"

# Update statistics
echo "📊 Updating test statistics..."
run_sql "
UPDATE system_stats SET 
    total_assets = (SELECT COUNT(*) FROM assets),
    active_users = (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '30 days'),
    pending_requests = 0,
    updated_at = NOW()
WHERE id = 1;

INSERT INTO system_stats (id, total_assets, active_users, pending_requests, updated_at)
SELECT 1, COUNT(*) as total_assets, 3 as active_users, 0 as pending_requests, NOW()
FROM assets
WHERE NOT EXISTS (SELECT 1 FROM system_stats WHERE id = 1);
"

echo "✅ Test data seeding completed successfully!"
echo "📋 Summary:"
echo "   - 3 test users created (admin, manager, user)"
echo "   - 3 test assets created (laptop, phone, projector)"  
echo "   - 3 test chat messages created"
echo "   - 3 test audit log entries created"
echo "   - 3 test notifications created"
echo "   - System settings configured"
echo "   - Statistics updated"
echo ""
echo "🔑 Test credentials:"
echo "   - admin@test.com / password"
echo "   - manager@test.com / password"  
echo "   - user@test.com / password"