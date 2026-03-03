import type { AuditEvent, Department, Group, PermissionDef, Role, RolePermissionOverride, User } from '$lib/rbac/types';

function nowIso(): string {
    return new Date().toISOString();
}

function id(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Math.random().toString(16).slice(2)}`;
}

export type SeedRbacData = {
    roles: Role[];
    permissionDefs: PermissionDef[];
    overrides: RolePermissionOverride[];
    groups: Group[];
    departments: Department[];
    users: User[];
    audit: AuditEvent[];
};

export const seedRbacData: SeedRbacData = {
    roles: [
        {
            id: 'admin',
            name: 'Admin',
            description: 'Full administrative access',
            defaultScopePolicy: 'none'
        },
        {
            id: 'operator_base',
            name: 'Operator Base',
            description: 'Baseline operational access'
        },
        {
            id: 'operator',
            name: 'Operator',
            description: 'Network operator (inherits Operator Base)',
            baseRoleId: 'operator_base'
        },
        {
            id: 'auditor',
            name: 'Auditor',
            description: 'Read-only access for investigations',
            defaultScopePolicy: 'none'
        }
    ],
    permissionDefs: [
        {
            key: 'users.create',
            resource: 'users',
            action: 'create',
            title: 'Create users',
            description: 'Create new user accounts.',
            isDangerous: false
        },
        {
            key: 'users.read',
            resource: 'users',
            action: 'read',
            title: 'View users',
            description: 'Read user profile and access status.',
            isDangerous: false
        },
        {
            key: 'users.update',
            resource: 'users',
            action: 'update',
            title: 'Update users',
            description: 'Update user details and roles.',
            isDangerous: false
        },
        {
            key: 'users.delete',
            resource: 'users',
            action: 'delete',
            title: 'Delete users',
            description: 'Remove user accounts.',
            isDangerous: true,
            tags: ['sensitive']
        },
        {
            key: 'assets.create',
            resource: 'assets',
            action: 'create',
            title: 'Create assets',
            description: 'Create new asset records.',
            isDangerous: false
        },
        {
            key: 'assets.read',
            resource: 'assets',
            action: 'read',
            title: 'View assets',
            description: 'View asset inventory and details.',
            isDangerous: false
        },
        {
            key: 'assets.update',
            resource: 'assets',
            action: 'update',
            title: 'Update assets',
            description: 'Update asset metadata and assignments.',
            isDangerous: false
        },
        {
            key: 'assets.delete',
            resource: 'assets',
            action: 'delete',
            title: 'Delete assets',
            description: 'Delete asset records.',
            isDangerous: true,
            tags: ['sensitive']
        },
        {
            key: 'tools.execute',
            resource: 'tools',
            action: 'execute',
            title: 'Execute tools',
            description: 'Run operational tools (may impact production).',
            isDangerous: true,
            tags: ['execute']
        },
        {
            key: 'tools.execute.network-change',
            resource: 'tools',
            action: 'execute.network-change',
            title: 'Execute network changes',
            description: 'Run network change tools (SSH push, config apply, rollback).',
            isDangerous: true,
            tags: ['execute', 'network']
        },
        {
            key: 'logs.read',
            resource: 'logs',
            action: 'read',
            title: 'View audit logs',
            description: 'Read audit and operational logs.',
            isDangerous: false
        }
    ],
    overrides: [
        // Admin: full access (any).
        { roleId: 'admin', permKey: 'users.create', scope: 'any' },
        { roleId: 'admin', permKey: 'users.read', scope: 'any' },
        { roleId: 'admin', permKey: 'users.update', scope: 'any' },
        { roleId: 'admin', permKey: 'users.delete', scope: 'any' },
        { roleId: 'admin', permKey: 'assets.create', scope: 'any' },
        { roleId: 'admin', permKey: 'assets.read', scope: 'any' },
        { roleId: 'admin', permKey: 'assets.update', scope: 'any' },
        { roleId: 'admin', permKey: 'assets.delete', scope: 'any' },
        { roleId: 'admin', permKey: 'tools.execute', scope: 'any' },
        { roleId: 'admin', permKey: 'tools.execute.network-change', scope: 'any' },
        { roleId: 'admin', permKey: 'logs.read', scope: 'any' },

        // Operator base: group scoped.
        { roleId: 'operator_base', permKey: 'users.read', scope: 'group' },
        { roleId: 'operator_base', permKey: 'assets.read', scope: 'group' },
        { roleId: 'operator_base', permKey: 'assets.update', scope: 'group' },
        { roleId: 'operator_base', permKey: 'tools.execute', scope: 'group' },
        { roleId: 'operator_base', permKey: 'logs.read', scope: 'org' },

        // Operator: explicit overrides on top of base.
        { roleId: 'operator', permKey: 'assets.create', scope: 'group' },
        { roleId: 'operator', permKey: 'tools.execute.network-change', scope: 'group' },

        // Auditor: org-wide read.
        { roleId: 'auditor', permKey: 'users.read', scope: 'org' },
        { roleId: 'auditor', permKey: 'assets.read', scope: 'org' },
        { roleId: 'auditor', permKey: 'logs.read', scope: 'org' }
    ],
    groups: [
        { id: 'group_network', name: 'Network', description: 'Network operations team' },
        { id: 'group_server', name: 'Server', description: 'Server operations team' }
    ],
    departments: [
        { id: 'dept_it', name: 'IT' },
        { id: 'dept_security', name: 'Security' }
    ],
    users: [
        {
            id: 'user_a',
            email: 'operator@hospital.local',
            globalRoleId: 'operator',
            memberships: [{ groupId: 'group_network', roleId: 'operator' }],
            departmentId: 'dept_it',
            orgId: 'org_hospital'
        },
        {
            id: 'user_b',
            email: 'auditor@hospital.local',
            globalRoleId: 'auditor',
            memberships: [{ groupId: 'group_network', roleId: 'operator_base' }],
            departmentId: 'dept_security',
            orgId: 'org_hospital'
        },
        {
            id: 'user_admin',
            email: 'admin@hospital.local',
            globalRoleId: 'admin',
            memberships: [],
            departmentId: 'dept_it',
            orgId: 'org_hospital'
        }
    ],
    audit: [
        {
            id: id('audit'),
            time: nowIso(),
            actorId: 'user_admin',
            actorEmail: 'admin@hospital.local',
            target: { type: 'role', id: 'operator', name: 'Operator' },
            action: 'rbac.rolePermissions.patch',
            reason: 'Enable group-level network changes for operators',
            diff: {
                changes: [{ permKey: 'tools.execute.network-change', op: 'set', scope: 'group' }]
            },
            dangerous: true
        },
        {
            id: id('audit'),
            time: nowIso(),
            actorId: 'user_admin',
            actorEmail: 'admin@hospital.local',
            target: { type: 'group', id: 'group_network', name: 'Network' },
            action: 'rbac.groupMembers.patch',
            reason: 'Assign operator role for network team',
            diff: {
                changes: [{ userId: 'user_a', op: 'setRole', roleId: 'operator' }]
            },
            dangerous: false
        }
    ]
};
