// ============================================================================
// Single source of truth: System roles và default permission matrix
// Mirrors migration 050 (role_permissions seed data)
// Dùng bởi:
//   - packages/contracts (type exports)
//   - apps/api/src/routes/v1/assets/assets.helpers.ts (DB fallback)
//   - apps/web-ui/src/lib/auth/capabilities.ts (client-side capability matrix)
// ============================================================================

// ─── System Roles ─────────────────────────────────────────────────────────────

export type SystemRole =
  | 'admin'
  | 'super_admin'
  | 'it_asset_manager'
  | 'warehouse_keeper'
  | 'technician'
  | 'requester'
  | 'user'       // backward-compat alias của 'requester'
  | 'viewer'
  | string       // custom roles tương lai

export const SYSTEM_ROLES = [
  'admin',
  'super_admin',
  'it_asset_manager',
  'warehouse_keeper',
  'technician',
  'requester',
  'viewer',
] as const

// ─── Default permission matrix (mirrors DB seed migration 050) ───────────────
// Dùng làm fallback khi role_permissions chưa được seed vào DB.

export const SYSTEM_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  admin: ['*'],
  super_admin: ['*'],
  it_asset_manager: [
    'assets:read', 'assets:create', 'assets:update', 'assets:delete', 'assets:export', 'assets:import', 'assets:assign',
    'categories:read', 'categories:manage',
    'cmdb:read', 'cmdb:create', 'cmdb:update', 'cmdb:delete',
    'warehouse:read', 'warehouse:create', 'warehouse:approve',
    'inventory:read', 'inventory:create', 'inventory:manage',
    'licenses:read', 'licenses:manage',
    'accessories:read', 'accessories:manage',
    'consumables:read', 'consumables:manage',
    'components:read', 'components:manage',
    'checkout:read', 'checkout:create', 'checkout:approve',
    'requests:read', 'requests:create', 'requests:approve',
    'maintenance:read', 'maintenance:create', 'maintenance:manage',
    'reports:read', 'reports:export', 'analytics:read',
    'depreciation:read', 'depreciation:manage',
    'labels:read', 'labels:manage',
    'documents:read', 'documents:upload', 'documents:delete',
    'automation:read', 'automation:manage',
    'integrations:read', 'integrations:manage',
    'security:read',
  ],
  warehouse_keeper: [
    'assets:read', 'assets:create', 'assets:update', 'assets:export',
    'categories:read',
    'warehouse:read', 'warehouse:create',
    'inventory:read', 'inventory:create',
    'accessories:read', 'accessories:manage',
    'consumables:read', 'consumables:manage',
    'components:read', 'components:manage',
    'requests:read', 'requests:create',
    'audit:read', 'audit:create',
    'maintenance:read',
    'reports:read', 'reports:export',
    'depreciation:read',
    'labels:read', 'labels:manage',
    'documents:read', 'documents:upload',
  ],
  technician: [
    'assets:read', 'categories:read', 'cmdb:read',
    'warehouse:read', 'inventory:read',
    'accessories:read', 'consumables:read',
    'components:read', 'components:manage',
    'checkout:read', 'checkout:create',
    'requests:read', 'requests:create',
    'maintenance:read', 'maintenance:create', 'maintenance:manage',
    'reports:read', 'labels:read',
    'documents:read', 'documents:upload',
  ],
  requester: [
    'assets:read', 'categories:read', 'licenses:read',
    'checkout:read', 'checkout:create',
    'requests:read', 'requests:create',
    'maintenance:read', 'maintenance:create',
    'reports:read', 'documents:read',
  ],
  viewer: [
    'assets:read', 'categories:read', 'cmdb:read',
    'warehouse:read', 'inventory:read', 'licenses:read',
    'accessories:read', 'consumables:read', 'components:read',
    'checkout:read', 'requests:read', 'maintenance:read',
    'reports:read', 'analytics:read', 'depreciation:read',
    'labels:read', 'security:read', 'documents:read', 'automation:read',
  ],
}
// 'user' = backward-compat alias cho 'requester'
SYSTEM_ROLE_PERMISSIONS['user'] = SYSTEM_ROLE_PERMISSIONS['requester']
