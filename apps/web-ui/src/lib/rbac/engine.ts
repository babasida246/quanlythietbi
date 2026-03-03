import type {
    EffectivePermissionRecord,
    ExplainContext,
    ExplainResult,
    PermissionKey,
    Role,
    RolePermissionOverride,
    Scope,
    User
} from '$lib/rbac/types';

export type RbacDataIndex = {
    rolesById: Map<string, Role>;
    overridesByRoleId: Map<string, Map<PermissionKey, RolePermissionOverride>>;
};

export function indexRbacData(roles: Role[], overrides: RolePermissionOverride[]): RbacDataIndex {
    const rolesById = new Map<string, Role>(roles.map((role) => [role.id, role]));
    const overridesByRoleId = new Map<string, Map<PermissionKey, RolePermissionOverride>>();

    for (const override of overrides) {
        const roleOverrides = overridesByRoleId.get(override.roleId) ?? new Map<PermissionKey, RolePermissionOverride>();
        roleOverrides.set(override.permKey, override);
        overridesByRoleId.set(override.roleId, roleOverrides);
    }

    return { rolesById, overridesByRoleId };
}

export type ResolveRolePermissionResult = {
    record: EffectivePermissionRecord;
    inheritChain: string[];
};

export function resolveRolePermission(roleId: string, permKey: PermissionKey, index: RbacDataIndex): ResolveRolePermissionResult {
    const inheritChain: string[] = [];
    let currentRoleId: string | undefined = roleId;

    while (currentRoleId) {
        inheritChain.push(currentRoleId);

        const roleOverrides = index.overridesByRoleId.get(currentRoleId);
        const override = roleOverrides?.get(permKey);
        if (override) {
            const isExplicit = currentRoleId === roleId;
            const source = isExplicit ? 'explicit' : 'inherited';
            const inheritedFromRoleId = isExplicit ? undefined : currentRoleId;

            return {
                record: {
                    scope: override.scope,
                    source,
                    isExplicit,
                    inheritedFromRoleId,
                    resolvedRoleId: currentRoleId,
                    inheritChain
                },
                inheritChain
            };
        }

        const role = index.rolesById.get(currentRoleId);
        currentRoleId = role?.baseRoleId ? String(role.baseRoleId) : undefined;
    }

    const role = index.rolesById.get(roleId);
    const defaultScope: Scope = role?.defaultScopePolicy ?? 'none';
    return {
        record: {
            scope: defaultScope,
            source: 'default',
            isExplicit: false,
            resolvedRoleId: undefined,
            inheritChain
        },
        inheritChain
    };
}

export function resolveInheritedScope(roleId: string, permKey: PermissionKey, index: RbacDataIndex): Scope {
    const role = index.rolesById.get(roleId);
    const baseRoleId = role?.baseRoleId ? String(role.baseRoleId) : undefined;
    if (!baseRoleId) {
        return role?.defaultScopePolicy ?? 'none';
    }
    return resolveRolePermission(baseRoleId, permKey, index).record.scope;
}

export type ExplainInput = {
    user: User;
    permKey: PermissionKey;
    context: ExplainContext;
    index: RbacDataIndex;
};

export function explainEffectiveScope(input: ExplainInput): ExplainResult {
    const { user, permKey, context, index } = input;

    const steps: string[] = [];
    const inheritChain: string[] = [];

    const membership = context.groupId
        ? user.memberships.find((item) => item.groupId === context.groupId)
        : undefined;

    const contextRoleId = membership?.roleId ?? user.globalRoleId;
    const contextRoleSource = membership ? 'groupRole' : 'globalRole';

    if (membership) {
        steps.push(`Context groupId=${context.groupId} → use GroupRole=${membership.roleId}`);
    } else {
        steps.push(`No group role match → use GlobalRole=${user.globalRoleId}`);
    }

    const resolution = resolveRolePermission(contextRoleId, permKey, index);
    inheritChain.push(...resolution.inheritChain);

    const record = resolution.record;
    const resolvedRoleId = record.resolvedRoleId;

    if (record.source === 'explicit') {
        steps.push(`Permission ${permKey} found as scope=${record.scope} (explicit)`);
    } else if (record.source === 'inherited') {
        steps.push(`Permission ${permKey} found as scope=${record.scope} (inherited from ${record.inheritedFromRoleId})`);
    } else {
        steps.push(`Permission ${permKey} not set → fallback scope=${record.scope}`);
    }

    steps.push(`Effective scope=${record.scope}`);

    const sourceType = record.source === 'explicit' ? contextRoleSource : record.source === 'inherited' ? 'inherited' : 'default';

    return {
        effectiveScope: record.scope,
        source: {
            sourceType,
            roleId: resolvedRoleId,
            inheritChain
        },
        steps,
        resolved: {
            permKey,
            scope: record.scope,
            isExplicit: record.source === 'explicit',
            roleId: resolvedRoleId
        }
    };
}

export type CsvMatrixRow = {
    permKey: string;
    resource: string;
    action: string;
    title: string;
    roleId: string;
    scope: Scope;
    source: string;
};
