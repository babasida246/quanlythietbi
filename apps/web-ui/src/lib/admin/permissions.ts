export type AdminRoleId = 'user' | 'admin' | 'super_admin'

export type AdminPermissionId =
    | 'users.view'
    | 'users.manage'
    | 'audit.view'
    | 'audit.export'
    | 'stats.view'
    | 'models.view'
    | 'models.manage'
    | 'providers.view'
    | 'providers.manage'
    | 'routing.view'
    | 'routing.manage'
    | 'security.view'
    | 'security.manage'
    | 'ops.view'
    | 'ops.manage'
    | 'sessions.view'
    | 'sessions.manage'
    | 'impersonation.use'
    | 'permissions.manage'

export type PermissionGroup =
    | 'users'
    | 'audit'
    | 'stats'
    | 'models'
    | 'providers'
    | 'routing'
    | 'security'
    | 'ops'
    | 'sessions'
    | 'impersonation'
    | 'permissions'

export type PermissionDefinition = {
    id: AdminPermissionId
    label: string
    description: string
    group: PermissionGroup
    sensitive?: boolean
}

export const adminRoles: Array<{ id: AdminRoleId; label: string }> = [
    { id: 'user', label: 'User' },
    { id: 'admin', label: 'Admin' },
    { id: 'super_admin', label: 'Super Admin' }
]

export const groupLabels: Record<PermissionGroup, string> = {
    users: 'User Management',
    audit: 'Audit & Compliance',
    stats: 'Usage & Stats',
    models: 'Models & Governance',
    providers: 'AI Providers',
    routing: 'Routing & Fallback',
    security: 'Security & Access',
    ops: 'Operations',
    sessions: 'Sessions',
    impersonation: 'Impersonation',
    permissions: 'Permission Admin'
}

export const adminPermissions: PermissionDefinition[] = [
    { id: 'users.view', label: 'View Users', description: 'Read-only access to users list', group: 'users' },
    { id: 'users.manage', label: 'Manage Users', description: 'Create, update, lock or delete users', group: 'users', sensitive: true },
    { id: 'audit.view', label: 'View Audit Logs', description: 'Access audit logs and exports', group: 'audit' },
    { id: 'audit.export', label: 'Export Audit Logs', description: 'Export audit logs for compliance', group: 'audit', sensitive: true },
    { id: 'stats.view', label: 'View Usage Stats', description: 'Access cost and usage insights', group: 'stats' },
    { id: 'models.view', label: 'View Models', description: 'Read model catalog and status', group: 'models' },
    { id: 'models.manage', label: 'Manage Models', description: 'Enable, disable, and reprioritize models', group: 'models', sensitive: true },
    { id: 'providers.view', label: 'View Providers', description: 'See provider list and status', group: 'providers' },
    { id: 'providers.manage', label: 'Manage Providers', description: 'Configure provider credentials and status', group: 'providers', sensitive: true },
    { id: 'routing.view', label: 'View Routing Rules', description: 'Read orchestration and fallback rules', group: 'routing' },
    { id: 'routing.manage', label: 'Manage Routing', description: 'Adjust orchestration and fallback rules', group: 'routing', sensitive: true },
    { id: 'security.view', label: 'View Security Policies', description: 'Review MFA, SSO, allowlists', group: 'security' },
    { id: 'security.manage', label: 'Manage Security Policies', description: 'Change MFA, SSO, IP allowlists', group: 'security', sensitive: true },
    { id: 'ops.view', label: 'View Ops Metrics', description: 'View operational KPIs and metrics', group: 'ops' },
    { id: 'ops.manage', label: 'Manage Ops Settings', description: 'Feature flags, notifications, metrics', group: 'ops', sensitive: true },
    { id: 'sessions.view', label: 'View Sessions', description: 'See active admin sessions', group: 'sessions' },
    { id: 'sessions.manage', label: 'Manage Sessions', description: 'Revoke active sessions', group: 'sessions', sensitive: true },
    { id: 'impersonation.use', label: 'Use Impersonation', description: 'Impersonate user sessions', group: 'impersonation', sensitive: true },
    { id: 'permissions.manage', label: 'Manage Permissions', description: 'Edit roles, overrides, approvals', group: 'permissions', sensitive: true }
]

export const permissionIds = adminPermissions.map((permission) => permission.id)

export const sensitivePermissions = new Set<AdminPermissionId>(
    adminPermissions.filter((permission) => permission.sensitive).map((permission) => permission.id)
)

export const defaultRoleGrants: Record<AdminRoleId, AdminPermissionId[]> = {
    user: ['stats.view', 'models.view', 'providers.view', 'routing.view', 'audit.view', 'ops.view'],
    admin: [
        'users.view',
        'users.manage',
        'audit.view',
        'audit.export',
        'stats.view',
        'models.view',
        'models.manage',
        'providers.view',
        'providers.manage',
        'routing.view',
        'routing.manage',
        'security.view',
        'security.manage',
        'ops.view',
        'ops.manage',
        'sessions.view',
        'sessions.manage',
        'impersonation.use',
        'permissions.manage'
    ],
    super_admin: permissionIds
}

export type RoleTemplate = {
    id: string
    label: string
    description: string
    grants: AdminPermissionId[]
}

export const roleTemplates: RoleTemplate[] = [
    {
        id: 'ops-admin',
        label: 'Ops Admin',
        description: 'Operations-focused access for monitoring and triage.',
        grants: [
            'users.view',
            'audit.view',
            'stats.view',
            'ops.view',
            'ops.manage',
            'sessions.view',
            'providers.view',
            'models.view'
        ]
    },
    {
        id: 'security-admin',
        label: 'Security Admin',
        description: 'Security policy control and audit visibility.',
        grants: [
            'users.view',
            'audit.view',
            'audit.export',
            'security.view',
            'security.manage',
            'sessions.view',
            'sessions.manage'
        ]
    },
    {
        id: 'ai-admin',
        label: 'AI Admin',
        description: 'AI providers, models, and routing governance.',
        grants: [
            'models.view',
            'models.manage',
            'providers.view',
            'providers.manage',
            'routing.view',
            'routing.manage',
            'stats.view'
        ]
    },
    {
        id: 'report-viewer',
        label: 'Report Viewer',
        description: 'Read-only access to audit and usage data.',
        grants: ['audit.view', 'stats.view', 'models.view', 'providers.view', 'routing.view']
    }
]
