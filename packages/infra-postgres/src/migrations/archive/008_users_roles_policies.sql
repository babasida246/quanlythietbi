-- Migration 008: Users, Roles, Permissions & Policies (RBAC System)
-- Phase 9D: User, Roles & Policies Management

-- Ensure users table has required columns/constraints
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Allow username to be nullable for bootstrap/default admin creation
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,  -- e.g., 'tools', 'chat', 'admin'
  action VARCHAR(50) NOT NULL,    -- e.g., 'read', 'write'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Role-Permission mapping (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Policies table (JSON-based policies)
CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,  -- e.g., 'cost_limit', 'rate_limit', 'access_control'
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_policies_type ON policies(type);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);

-- Seed default roles
INSERT INTO roles (name, slug, description) VALUES
    ('Administrator', 'admin', 'Full system access'),
    ('Operator', 'operator', 'Manage tools and chat'),
    ('Viewer', 'viewer', 'Read-only access')
ON CONFLICT (slug) DO NOTHING;

-- Seed permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    ('tools:read', 'tools', 'read', 'View tools'),
    ('tools:write', 'tools', 'write', 'Create/edit tools'),
    ('chat:read', 'chat', 'read', 'View chat conversations'),
    ('chat:write', 'chat', 'write', 'Send messages'),
    ('admin:read', 'admin', 'read', 'View admin panel'),
    ('admin:write', 'admin', 'write', 'Manage system settings')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to Administrator role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- Assign limited permissions to Operator role (tools & chat, read/write)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.name IN ('tools:read', 'tools:write', 'chat:read', 'chat:write')
WHERE r.slug = 'operator'
ON CONFLICT DO NOTHING;

-- Assign read-only permissions to Viewer role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
    JOIN permissions p ON p.action = 'read'
WHERE r.slug = 'viewer'
ON CONFLICT DO NOTHING;

-- Create default admin user (password: admin123)
-- Bcrypt hash generated with salt rounds 10
INSERT INTO users (email, name, password_hash, role, status)
VALUES ('admin@NetOpsAI.local', 'Administrator', '$2b$10$BZp4co.945ezpZEiPLQxzuGGbJVOcg2MihhaT5Dkb/CQOPRH5zOB.', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- Seed example policies
INSERT INTO policies (name, type, config, status) VALUES
    ('Cost Limit', 'cost_limit', '{"maxCostPerDay": 10.00, "maxCostPerMonth": 300.00, "alertThreshold": 0.8}'::jsonb, 'active'),
    ('Rate Limit', 'rate_limit', '{"maxRequestsPerMinute": 60, "maxRequestsPerHour": 1000}'::jsonb, 'active'),
    ('Access Control', 'access_control', '{"allowedIPs": ["192.168.1.0/24"], "deniedIPs": []}'::jsonb, 'inactive')
ON CONFLICT (name) DO NOTHING;

