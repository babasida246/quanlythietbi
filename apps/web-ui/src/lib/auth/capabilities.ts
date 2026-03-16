// ─── Danh sách vai trò hệ thống ──────────────────────────────────────────────
export type SystemRole =
  | 'admin'
  | 'super_admin'
  | 'it_asset_manager'
  | 'warehouse_keeper'
  | 'technician'
  | 'requester'
  | 'user'    // backward-compat alias của 'requester'
  | 'viewer'
  | string    // custom roles tương lai

// ─── Ma trận Capabilities ─────────────────────────────────────────────────────
export type Capabilities = {
  role: string

  // ── Tài sản ──────────────────────────────────────────────────────────────
  assets: {
    read: boolean
    create: boolean
    update: boolean
    delete: boolean
    export: boolean
    import: boolean
    assign: boolean
  }

  // ── Danh mục ─────────────────────────────────────────────────────────────
  categories: {
    read: boolean
    manage: boolean
  }

  // ── CMDB ─────────────────────────────────────────────────────────────────
  cmdb: {
    read: boolean
    create: boolean
    update: boolean
    delete: boolean
  }

  // ── Kho hàng ─────────────────────────────────────────────────────────────
  warehouse: {
    read: boolean
    create: boolean
    approve: boolean
  }

  // ── Kiểm kê ──────────────────────────────────────────────────────────────
  inventory: {
    read: boolean
    create: boolean
    manage: boolean
  }

  // ── License ──────────────────────────────────────────────────────────────
  licenses: {
    read: boolean
    manage: boolean
  }

  // ── Phụ kiện ─────────────────────────────────────────────────────────────
  accessories: {
    read: boolean
    manage: boolean
  }

  // ── Vật tư tiêu hao ──────────────────────────────────────────────────────
  consumables: {
    read: boolean
    manage: boolean
  }

  // ── Linh kiện ────────────────────────────────────────────────────────────
  components: {
    read: boolean
    manage: boolean
  }

  // ── Mượn/Trả ─────────────────────────────────────────────────────────────
  checkout: {
    read: boolean
    create: boolean
    approve: boolean
  }

  // ── Yêu cầu ──────────────────────────────────────────────────────────────
  requests: {
    read: boolean
    create: boolean
    approve: boolean
  }

  // ── Bảo trì/Sửa chữa ────────────────────────────────────────────────────
  maintenance: {
    read: boolean
    create: boolean
    manage: boolean
  }

  // ── Báo cáo ──────────────────────────────────────────────────────────────
  reports: {
    read: boolean
    export: boolean
  }

  // ── Phân tích ────────────────────────────────────────────────────────────
  analytics: {
    read: boolean
  }

  // ── Khấu hao ─────────────────────────────────────────────────────────────
  depreciation: {
    read: boolean
    manage: boolean
  }

  // ── Nhãn ─────────────────────────────────────────────────────────────────
  labels: {
    read: boolean
    manage: boolean
  }

  // ── Tài liệu ─────────────────────────────────────────────────────────────
  documents: {
    read: boolean
    upload: boolean
    delete: boolean
  }

  // ── Tự động hóa ──────────────────────────────────────────────────────────
  automation: {
    read: boolean
    manage: boolean
  }

  // ── Tích hợp ─────────────────────────────────────────────────────────────
  integrations: {
    read: boolean
    manage: boolean
  }

  // ── Bảo mật ──────────────────────────────────────────────────────────────
  security: {
    read: boolean
    manage: boolean
  }

  // ── Quản trị ─────────────────────────────────────────────────────────────
  admin: {
    users: boolean
    roles: boolean
    settings: boolean
  }

  // ── Shortcuts (backward-compat + convenience) ─────────────────────────────
  isAdmin: boolean
  canViewAssets: boolean
  canManageAssets: boolean
  canViewRequests: boolean
  canCreateRequests: boolean
  canApproveRequests: boolean
}

// ─── Permission set per role (mirrors migration 050) ──────────────────────────
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  admin: new Set(['*']),
  super_admin: new Set(['*']),
  it_asset_manager: new Set([
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
  ]),
  warehouse_keeper: new Set([
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
  ]),
  technician: new Set([
    'assets:read', 'categories:read', 'cmdb:read',
    'warehouse:read', 'inventory:read',
    'accessories:read', 'consumables:read',
    'components:read', 'components:manage',
    'checkout:read', 'checkout:create',
    'requests:read', 'requests:create',
    'maintenance:read', 'maintenance:create', 'maintenance:manage',
    'reports:read', 'labels:read',
    'documents:read', 'documents:upload',
  ]),
  requester: new Set([
    'assets:read', 'categories:read', 'licenses:read',
    'checkout:read', 'checkout:create',
    'requests:read', 'requests:create',
    'maintenance:read', 'maintenance:create',
    'reports:read', 'documents:read',
  ]),
  viewer: new Set([
    'assets:read', 'categories:read', 'cmdb:read',
    'warehouse:read', 'inventory:read', 'licenses:read',
    'accessories:read', 'consumables:read', 'components:read',
    'checkout:read', 'requests:read', 'maintenance:read',
    'reports:read', 'analytics:read', 'depreciation:read',
    'labels:read', 'security:read', 'documents:read', 'automation:read',
  ]),
}
// 'user' = alias cho 'requester'
ROLE_PERMISSIONS['user'] = ROLE_PERMISSIONS['requester']

export function normalizeRole(role: string | null | undefined): string {
  const value = (role ?? '').trim().toLowerCase()
  if (!value) return 'viewer'
  if (value === 'manager') return 'it_asset_manager'
  if (value === 'it_manager') return 'it_asset_manager'
  if (value === 'storekeeper' || value === 'warehouse_staff') return 'warehouse_keeper'
  if (value === 'it_staff') return 'technician'
  return value
}

function can(perms: Set<string>, perm: string): boolean {
  return perms.has('*') || perms.has(perm)
}

export function getCapabilities(
  roleInput: string | null | undefined,
  // Nếu server trả về permissions array trong JWT/login response → dùng ở đây
  permissionsOverride?: string[]
): Capabilities {
  const role = normalizeRole(roleInput)

  const perms: Set<string> = permissionsOverride && permissionsOverride.length > 0
    ? new Set(permissionsOverride)
    : (ROLE_PERMISSIONS[role] ?? new Set<string>())

  const isAdmin = role === 'admin' || role === 'super_admin'

  return {
    role,

    assets: {
      read: can(perms, 'assets:read'),
      create: can(perms, 'assets:create'),
      update: can(perms, 'assets:update'),
      delete: can(perms, 'assets:delete'),
      export: can(perms, 'assets:export'),
      import: can(perms, 'assets:import'),
      assign: can(perms, 'assets:assign'),
    },
    categories: {
      read: can(perms, 'categories:read'),
      manage: can(perms, 'categories:manage'),
    },
    cmdb: {
      read: can(perms, 'cmdb:read'),
      create: can(perms, 'cmdb:create'),
      update: can(perms, 'cmdb:update'),
      delete: can(perms, 'cmdb:delete'),
    },
    warehouse: {
      read: can(perms, 'warehouse:read'),
      create: can(perms, 'warehouse:create'),
      approve: can(perms, 'warehouse:approve'),
    },
    inventory: {
      read: can(perms, 'inventory:read'),
      create: can(perms, 'inventory:create'),
      manage: can(perms, 'inventory:manage'),
    },
    licenses: {
      read: can(perms, 'licenses:read'),
      manage: can(perms, 'licenses:manage'),
    },
    accessories: {
      read: can(perms, 'accessories:read'),
      manage: can(perms, 'accessories:manage'),
    },
    consumables: {
      read: can(perms, 'consumables:read'),
      manage: can(perms, 'consumables:manage'),
    },
    components: {
      read: can(perms, 'components:read'),
      manage: can(perms, 'components:manage'),
    },
    checkout: {
      read: can(perms, 'checkout:read'),
      create: can(perms, 'checkout:create'),
      approve: can(perms, 'checkout:approve'),
    },
    requests: {
      read: can(perms, 'requests:read'),
      create: can(perms, 'requests:create'),
      approve: can(perms, 'requests:approve'),
    },
    maintenance: {
      read: can(perms, 'maintenance:read'),
      create: can(perms, 'maintenance:create'),
      manage: can(perms, 'maintenance:manage'),
    },
    reports: {
      read: can(perms, 'reports:read'),
      export: can(perms, 'reports:export'),
    },
    analytics: {
      read: can(perms, 'analytics:read'),
    },
    depreciation: {
      read: can(perms, 'depreciation:read'),
      manage: can(perms, 'depreciation:manage'),
    },
    labels: {
      read: can(perms, 'labels:read'),
      manage: can(perms, 'labels:manage'),
    },
    documents: {
      read: can(perms, 'documents:read'),
      upload: can(perms, 'documents:upload'),
      delete: can(perms, 'documents:delete'),
    },
    automation: {
      read: can(perms, 'automation:read'),
      manage: can(perms, 'automation:manage'),
    },
    integrations: {
      read: can(perms, 'integrations:read'),
      manage: can(perms, 'integrations:manage'),
    },
    security: {
      read: can(perms, 'security:read'),
      manage: can(perms, 'security:manage'),
    },
    admin: {
      users: isAdmin || can(perms, 'admin:users'),
      roles: isAdmin || can(perms, 'admin:roles'),
      settings: isAdmin || can(perms, 'admin:settings'),
    },

    // ── Shortcuts backward-compat ─────────────────────────────────────────
    isAdmin,
    canViewAssets: can(perms, 'assets:read'),
    canManageAssets: can(perms, 'assets:create') || can(perms, 'assets:update'),
    canViewRequests: can(perms, 'requests:read'),
    canCreateRequests: can(perms, 'requests:create'),
    canApproveRequests: can(perms, 'requests:approve'),
  }
}

export function defaultLandingPath(caps: Capabilities): string {
  if (caps.isAdmin) return '/admin'
  if (caps.canManageAssets) return '/assets'
  if (caps.canViewAssets) return '/me/assets'
  if (caps.requests.read) return '/me/requests'
  return '/login'
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function isRouteAllowed(pathname: string, caps: Capabilities): boolean {
  if (pathname === '/' || pathname === '') return true

  // Admin-only
  if (pathname.startsWith('/admin')) return caps.admin.users || caps.admin.settings

  // Asset management
  if (pathname.startsWith('/assets')) {
    const parts = pathname.split('/').filter(Boolean)
    const maybeId = parts[1] ?? ''
    if (parts.length === 2 && isUuidLike(maybeId)) return caps.assets.read
    return caps.assets.read
  }

  // CMDB
  if (pathname.startsWith('/cmdb')) return caps.cmdb.read

  // Warehouse & Inventory
  if (pathname.startsWith('/warehouse')) return caps.warehouse.read
  if (pathname.startsWith('/inventory')) return caps.inventory.read

  // Requests
  if (pathname.startsWith('/requests')) {
    if (pathname === '/requests/new') return caps.requests.create
    return caps.requests.read
  }

  // Maintenance
  if (pathname.startsWith('/maintenance')) return caps.maintenance.read

  // Reports & Analytics
  if (pathname.startsWith('/reports')) return caps.reports.read
  if (pathname.startsWith('/analytics')) return caps.analytics.read

  // Modules
  if (pathname.startsWith('/licenses')) return caps.licenses.read
  if (pathname.startsWith('/accessories')) return caps.accessories.read
  if (pathname.startsWith('/consumables')) return caps.consumables.read
  if (pathname.startsWith('/components')) return caps.components.read
  if (pathname.startsWith('/checkout')) return caps.checkout.read

  // Quản lý nâng cao
  if (pathname.startsWith('/depreciation')) return caps.depreciation.read
  if (pathname.startsWith('/labels')) return caps.labels.read
  if (pathname.startsWith('/documents')) return caps.documents.read
  if (pathname.startsWith('/automation')) return caps.automation.read
  if (pathname.startsWith('/integrations')) return caps.integrations.read
  if (pathname.startsWith('/security')) return caps.security.read

  // Inbox/notifications: ai cũng xem được
  if (pathname.startsWith('/inbox')) return caps.requests.read || caps.requests.approve
  if (pathname.startsWith('/notifications') || pathname.startsWith('/me')) return true
  if (pathname.startsWith('/settings/theme')) return true
  if (pathname.startsWith('/settings/print')) return caps.reports.read
  if (pathname === '/profile' || pathname === '/logout' || pathname === '/forbidden' || pathname === '/help') return true

  // Default: cho phép (không lock-out route chưa được định nghĩa)
  return true
}

