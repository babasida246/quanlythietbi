import { readLocal, writeLocal } from '$lib/admin/storage';
import { seedRbacData, type SeedRbacData } from '$lib/mocks/rbac';
import type { AuditEvent, RolePermissionOverride, User } from '$lib/rbac/types';

const STORAGE_KEY = 'admin.rbac.state.v1';

type PersistedRbacState = {
    overrides: RolePermissionOverride[];
    users: User[];
    audit: AuditEvent[];
};

export function loadRbacState(): SeedRbacData {
    const persisted = readLocal<PersistedRbacState | null>(STORAGE_KEY, null);
    if (!persisted) return seedRbacData;

    return {
        ...seedRbacData,
        overrides: Array.isArray(persisted.overrides) ? persisted.overrides : seedRbacData.overrides,
        users: Array.isArray(persisted.users) ? persisted.users : seedRbacData.users,
        audit: Array.isArray(persisted.audit) ? persisted.audit : seedRbacData.audit
    };
}

export function saveRbacState(next: PersistedRbacState): void {
    writeLocal(STORAGE_KEY, next);
}
