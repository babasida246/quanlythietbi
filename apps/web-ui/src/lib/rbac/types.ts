export const scopeValues = ['none', 'own', 'group', 'department', 'org', 'any'] as const;

export type Scope = (typeof scopeValues)[number];

export type PermissionKey = string;

export type Role = {
    id: string;
    name: string;
    description?: string;
    baseRoleId?: string | null;
    defaultScopePolicy?: Scope;
};

export type PermissionDef = {
    key: PermissionKey;
    resource: string;
    action: string;
    title: string;
    description: string;
    isDangerous: boolean;
    tags?: string[];
};

export type RolePermissionOverride = {
    roleId: string;
    permKey: PermissionKey;
    scope: Scope;
    updatedAt?: string;
    updatedBy?: string;
};

export type EffectivePermissionSource = 'explicit' | 'inherited' | 'default';

export type EffectivePermissionRecord = {
    scope: Scope;
    source: EffectivePermissionSource;
    isExplicit: boolean;
    inheritedFromRoleId?: string;
    resolvedRoleId?: string;
    inheritChain?: string[];
};

export type Group = {
    id: string;
    name: string;
    description?: string;
};

export type Department = {
    id: string;
    name: string;
};

export type Membership = {
    groupId: string;
    roleId: string;
};

export type User = {
    id: string;
    email: string;
    globalRoleId: string;
    memberships: Membership[];
    departmentId?: string;
    orgId?: string;
};

export type ExplainContext = {
    groupId?: string;
    departmentId?: string;
    ownerUserId?: string;
    orgId?: string;
};

export type ExplainSourceType = 'groupRole' | 'globalRole' | 'inherited' | 'default';

export type ExplainResult = {
    effectiveScope: Scope;
    source: {
        sourceType: ExplainSourceType;
        roleId?: string;
        inheritChain: string[];
    };
    steps: string[];
    resolved: {
        permKey: PermissionKey;
        scope: Scope;
        isExplicit: boolean;
        roleId?: string;
    };
};

export type AuditTargetType = 'role' | 'group' | 'user';

export type AuditEvent = {
    id: string;
    time: string;
    actorId: string;
    actorEmail: string;
    target: {
        type: AuditTargetType;
        id: string;
        name?: string;
    };
    action: string;
    reason?: string;
    diff: unknown;
    dangerous: boolean;
};
