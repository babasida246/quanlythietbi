import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { Organization, Warehouse } from '$lib/types/inventory';

interface ContextState {
    selectedOrgId: string | null;
    selectedWarehouseId: string | null;
    organizations: Organization[];
    warehouses: Warehouse[];
}

const STORAGE_KEY = 'inventory_context';

// Load from localStorage or URL params
function loadInitialState(): ContextState {
    if (!browser) {
        return { selectedOrgId: null, selectedWarehouseId: null, organizations: [], warehouses: [] };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            return {
                selectedOrgId: parsed.selectedOrgId || null,
                selectedWarehouseId: parsed.selectedWarehouseId || null,
                organizations: parsed.organizations || [],
                warehouses: parsed.warehouses || []
            };
        } catch (e) {
            console.error('Failed to parse stored context:', e);
        }
    }

    return { selectedOrgId: null, selectedWarehouseId: null, organizations: [], warehouses: [] };
}

function createContextStore() {
    const { subscribe, set, update } = writable<ContextState>(loadInitialState());

    // Persist to localStorage on changes
    if (browser) {
        subscribe((state) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                selectedOrgId: state.selectedOrgId,
                selectedWarehouseId: state.selectedWarehouseId,
                organizations: state.organizations,
                warehouses: state.warehouses
            }));
        });
    }

    return {
        subscribe,
        setOrganizations: (orgs: Organization[]) => {
            update((state) => {
                const newState = { ...state, organizations: orgs };
                // If current org is not in list, reset
                if (state.selectedOrgId && !orgs.find((o) => o.id === state.selectedOrgId)) {
                    newState.selectedOrgId = null;
                    newState.selectedWarehouseId = null;
                }
                return newState;
            });
        },
        setWarehouses: (warehouses: Warehouse[]) => {
            update((state) => {
                const newState = { ...state, warehouses };
                // If current warehouse is not in list, reset
                if (state.selectedWarehouseId && !warehouses.find((w) => w.id === state.selectedWarehouseId)) {
                    newState.selectedWarehouseId = null;
                }
                return newState;
            });
        },
        selectOrganization: (orgId: string | null) => {
            update((state) => ({
                ...state,
                selectedOrgId: orgId,
                selectedWarehouseId: null // Reset warehouse when org changes
            }));
        },
        selectWarehouse: (warehouseId: string | null) => {
            update((state) => ({
                ...state,
                selectedWarehouseId: warehouseId
            }));
        },
        reset: () => {
            set({ selectedOrgId: null, selectedWarehouseId: null, organizations: [], warehouses: [] });
        }
    };
}

export const contextStore = createContextStore();

// Derived stores
export const selectedOrganization = derived(
    contextStore,
    ($context) => $context.organizations.find((o) => o.id === $context.selectedOrgId) || null
);

export const selectedWarehouse = derived(
    contextStore,
    ($context) => $context.warehouses.find((w) => w.id === $context.selectedWarehouseId) || null
);

export const filteredWarehouses = derived(
    contextStore,
    ($context) => {
        if (!$context.selectedOrgId) return $context.warehouses;
        return $context.warehouses.filter((w) => !w.orgId || w.orgId === $context.selectedOrgId);
    }
);

// Helper to update URL params
export function syncContextToURL() {
    if (!browser) return;

    const state = get(contextStore);
    const url = new URL(window.location.href);

    if (state.selectedOrgId) {
        url.searchParams.set('org', state.selectedOrgId);
    } else {
        url.searchParams.delete('org');
    }

    if (state.selectedWarehouseId) {
        url.searchParams.set('warehouse', state.selectedWarehouseId);
    } else {
        url.searchParams.delete('warehouse');
    }

    goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
}

// Helper to load context from URL params
export function loadContextFromURL(searchParams: URLSearchParams) {
    const orgId = searchParams.get('org');
    const warehouseId = searchParams.get('warehouse');

    if (orgId) contextStore.selectOrganization(orgId);
    if (warehouseId) contextStore.selectWarehouse(warehouseId);
}
