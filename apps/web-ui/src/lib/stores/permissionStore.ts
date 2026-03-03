import { derived, get } from 'svelte/store';
import { sessionStore, getUserGrantsFor } from './sessionStore';
import { contextStore } from './contextStore';
import type { AppRole } from '$lib/types/inventory';

export type Permission =
    | 'inventory.view'
    | 'inventory.create'
    | 'inventory.edit'
    | 'inventory.approve'
    | 'inventory.post'
    | 'inventory.void'
    | 'reservation.view'
    | 'reservation.create'
    | 'reservation.activate'
    | 'reservation.commit'
    | 'admin.uom'
    | 'admin.currency'
    | 'admin.roles';

// Permission matrix by role
const ROLE_PERMISSIONS: Record<AppRole['code'], Permission[]> = {
    SYSTEM_ADMIN: [
        'inventory.view',
        'inventory.create',
        'inventory.edit',
        'inventory.approve',
        'inventory.post',
        'inventory.void',
        'reservation.view',
        'reservation.create',
        'reservation.activate',
        'reservation.commit',
        'admin.uom',
        'admin.currency',
        'admin.roles'
    ],
    ORG_ADMIN: [
        'inventory.view',
        'inventory.create',
        'inventory.edit',
        'inventory.approve',
        'inventory.post',
        'inventory.void',
        'reservation.view',
        'reservation.create',
        'reservation.activate',
        'reservation.commit',
        'admin.uom',
        'admin.currency',
        'admin.roles'
    ],
    WH_MANAGER: [
        'inventory.view',
        'inventory.create',
        'inventory.edit',
        'inventory.approve',
        'inventory.post',
        'inventory.void',
        'reservation.view',
        'reservation.create',
        'reservation.activate',
        'reservation.commit'
    ],
    WH_CLERK: [
        'inventory.view',
        'inventory.create',
        'inventory.edit',
        'reservation.view',
        'reservation.create'
    ],
    VIEWER: [
        'inventory.view',
        'reservation.view'
    ]
};

// Check if user has permission
export function hasPermission(permission: Permission, orgId?: string, warehouseId?: string): boolean {
    const session = get(sessionStore);
    const context = get(contextStore);

    if (!session.user || !session.isAuthenticated) return false;

    // Use context if not explicitly provided
    const targetOrgId = orgId ?? context.selectedOrgId;
    const targetWarehouseId = warehouseId ?? context.selectedWarehouseId;

    // Get user's grants for this org/warehouse
    const grants = getUserGrantsFor(targetOrgId, targetWarehouseId);

    // Check if any grant's role has the permission
    return grants.some((grant) => {
        if (!grant.role?.code) return false;
        const rolePermissions = ROLE_PERMISSIONS[grant.role.code] || [];
        return rolePermissions.includes(permission);
    });
}

// Derived store: current permissions based on context
export const currentPermissions = derived(
    [sessionStore, contextStore],
    ([$session, $context]) => {
        if (!$session.user || !$session.isAuthenticated) return [];

        const grants = getUserGrantsFor($context.selectedOrgId, $context.selectedWarehouseId);

        // Collect all permissions from all applicable grants
        const permissions = new Set<Permission>();
        grants.forEach((grant) => {
            if (grant.role?.code) {
                const rolePerms = ROLE_PERMISSIONS[grant.role.code] || [];
                rolePerms.forEach((p) => permissions.add(p));
            }
        });

        return Array.from(permissions);
    }
);

// Derived store: permission checker function
export const can = derived(
    currentPermissions,
    ($permissions) => (permission: Permission) => $permissions.includes(permission)
);

// Helper: check multiple permissions (AND logic)
export function hasAllPermissions(permissions: Permission[], orgId?: string, warehouseId?: string): boolean {
    return permissions.every((p) => hasPermission(p, orgId, warehouseId));
}

// Helper: check multiple permissions (OR logic)
export function hasAnyPermission(permissions: Permission[], orgId?: string, warehouseId?: string): boolean {
    return permissions.some((p) => hasPermission(p, orgId, warehouseId));
}
