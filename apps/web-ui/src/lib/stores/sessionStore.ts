import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { AppUser, UserRoleGrant } from '$lib/types/inventory';

interface SessionState {
    user: AppUser | null;
    grants: UserRoleGrant[];
    isAuthenticated: boolean;
    isLoading: boolean;
}

const STORAGE_KEY = 'inventory_session';

function loadInitialState(): SessionState {
    if (!browser) {
        return { user: null, grants: [], isAuthenticated: false, isLoading: true };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            return {
                user: parsed.user || null,
                grants: parsed.grants || [],
                isAuthenticated: !!parsed.user,
                isLoading: false
            };
        } catch (e) {
            console.error('Failed to parse stored session:', e);
        }
    }

    return { user: null, grants: [], isAuthenticated: false, isLoading: true };
}

function createSessionStore() {
    const { subscribe, set, update } = writable<SessionState>(loadInitialState());

    // Persist to localStorage
    if (browser) {
        subscribe((state) => {
            if (!state.isLoading) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    user: state.user,
                    grants: state.grants
                }));
            }
        });
    }

    return {
        subscribe,
        setUser: (user: AppUser | null, grants: UserRoleGrant[] = []) => {
            update((state) => ({
                ...state,
                user,
                grants,
                isAuthenticated: !!user,
                isLoading: false
            }));
        },
        setGrants: (grants: UserRoleGrant[]) => {
            update((state) => ({ ...state, grants }));
        },
        logout: () => {
            set({ user: null, grants: [], isAuthenticated: false, isLoading: false });
            if (browser) {
                localStorage.removeItem(STORAGE_KEY);
            }
        },
        setLoading: (isLoading: boolean) => {
            update((state) => ({ ...state, isLoading }));
        }
    };
}

export const sessionStore = createSessionStore();

// Derived: user's role codes
export const userRoles = derived(
    sessionStore,
    ($session) => {
        const roleCodes = new Set($session.grants.map((g) => g.role?.code).filter(Boolean));
        return Array.from(roleCodes);
    }
);

// Derived: check if user is system admin
export const isSystemAdmin = derived(
    userRoles,
    ($roles) => $roles.includes('SYSTEM_ADMIN')
);

// Derived: check if user is org admin (in any org)
export const isOrgAdmin = derived(
    userRoles,
    ($roles) => $roles.includes('ORG_ADMIN')
);

// Helper: get user's grants for specific org/warehouse
export function getUserGrantsFor(orgId: string | null, warehouseId: string | null): UserRoleGrant[] {
    const state = sessionStore;
    let grants: UserRoleGrant[] = [];

    state.subscribe((s) => {
        grants = s.grants.filter((g) => {
            // System admin has all grants
            if (g.role?.code === 'SYSTEM_ADMIN') return true;

            // Org-level grant
            if (g.orgId === orgId && !g.warehouseId && !warehouseId) return true;

            // Warehouse-level grant
            if (g.warehouseId === warehouseId) return true;

            return false;
        });
    })();

    return grants;
}
