import type {
    Organization,
    Warehouse,
    WarehouseLocation,
    Party,
    UOM,
    ItemUOMConversion,
    InventoryItem,
    InventoryLot,
    InventorySerial,
    Currency,
    FxRate,
    InventoryDocument,
    InventoryDocumentLine,
    InventoryReservation,
    InventoryReservationLine,
    AppUser,
    AppRole,
    UserRoleGrant,
    StockOnHand,
    StockAvailable,
    ReorderAlert,
    FEFOLot,
    DashboardStats,
    ListParams,
    ListResponse,
    CreateDocumentRequest,
    ApproveDocumentRequest,
    VoidDocumentRequest,
    CreateReservationRequest,
    CommitReservationRequest
} from '$lib/types/inventory';
import { API_BASE, authorizedFetch } from './httpClient';

const BASE_URL = API_BASE;

class APIError extends Error {
    constructor(public status: number, public statusText: string, public data: any) {
        super(`API Error ${status}: ${statusText}`);
        this.name = 'APIError';
    }
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;

    const response = await authorizedFetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: response.statusText };
        }
        throw new APIError(response.status, response.statusText, errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json();
}

function buildQueryString(params: Record<string, any>): string {
    const filtered = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    return filtered ? `?${filtered}` : '';
}

// Organizations
export const organizationsAPI = {
    list: (params?: ListParams) =>
        request<ListResponse<Organization>>(`/v1/organizations${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<Organization>(`/v1/organizations/${id}`),
    create: (data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<Organization>('/v1/organizations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Organization>) =>
        request<Organization>(`/v1/organizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/organizations/${id}`, { method: 'DELETE' })
};

// Warehouses
export const warehousesAPI = {
    list: (params?: ListParams & { orgId?: string }) =>
        request<ListResponse<Warehouse>>(`/v1/warehouses${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<Warehouse>(`/v1/warehouses/${id}`),
    create: (data: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<Warehouse>('/v1/warehouses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Warehouse>) =>
        request<Warehouse>(`/v1/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/warehouses/${id}`, { method: 'DELETE' })
};

// Warehouse Locations
export const locationsAPI = {
    list: (params?: ListParams & { warehouseId?: string }) =>
        request<ListResponse<WarehouseLocation>>(`/locations${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<WarehouseLocation>(`/v1/locations/${id}`),
    create: (data: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<WarehouseLocation>('/locations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<WarehouseLocation>) =>
        request<WarehouseLocation>(`/v1/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/locations/${id}`, { method: 'DELETE' })
};

// Parties
export const partiesAPI = {
    list: (params?: ListParams & { partyType?: string }) =>
        request<ListResponse<Party>>(`/parties${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<Party>(`/v1/parties/${id}`),
    create: (data: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<Party>('/parties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Party>) =>
        request<Party>(`/v1/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/parties/${id}`, { method: 'DELETE' })
};

// UOMs
export const uomsAPI = {
    list: (params?: ListParams) =>
        request<ListResponse<UOM>>(`/uoms${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<UOM>(`/v1/uoms/${id}`),
    create: (data: Omit<UOM, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<UOM>('/uoms', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<UOM>) =>
        request<UOM>(`/v1/uoms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/uoms/${id}`, { method: 'DELETE' })
};

// Items
export const itemsAPI = {
    list: (params?: ListParams & { warehouseId?: string }) =>
        request<ListResponse<InventoryItem>>(`/items${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<InventoryItem>(`/v1/items/${id}`),
    create: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<InventoryItem>('/items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<InventoryItem>) =>
        request<InventoryItem>(`/v1/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/items/${id}`, { method: 'DELETE' }),

    // UOM Conversions
    getConversions: (itemId: string) =>
        request<ItemUOMConversion[]>(`/v1/items/${itemId}/conversions`),
    addConversion: (itemId: string, data: Omit<ItemUOMConversion, 'id' | 'itemId' | 'createdAt' | 'updatedAt'>) =>
        request<ItemUOMConversion>(`/v1/items/${itemId}/conversions`, { method: 'POST', body: JSON.stringify(data) }),
    updateConversion: (itemId: string, conversionId: string, data: Partial<ItemUOMConversion>) =>
        request<ItemUOMConversion>(`/v1/items/${itemId}/conversions/${conversionId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteConversion: (itemId: string, conversionId: string) =>
        request<void>(`/v1/items/${itemId}/conversions/${conversionId}`, { method: 'DELETE' }),

    // Test conversion
    testConversion: (itemId: string, quantity: number, fromUomId: string, toUomId: string) =>
        request<{ result: number | null; path: string[] }>(`/v1/items/${itemId}/convert${buildQueryString({ quantity, fromUomId, toUomId })}`),

    // Stock info
    getStock: (itemId: string, warehouseId?: string) =>
        request<StockOnHand[]>(`/v1/items/${itemId}/stock${buildQueryString({ warehouseId: warehouseId || '' })}`)
};

// Lots
export const lotsAPI = {
    list: (params?: ListParams & { itemId?: string }) =>
        request<ListResponse<InventoryLot>>(`/lots${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<InventoryLot>(`/v1/lots/${id}`),
    create: (data: Omit<InventoryLot, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<InventoryLot>('/lots', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<InventoryLot>) =>
        request<InventoryLot>(`/v1/lots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/lots/${id}`, { method: 'DELETE' })
};

// Serials
export const serialsAPI = {
    list: (params?: ListParams & { itemId?: string; status?: string }) =>
        request<ListResponse<InventorySerial>>(`/serials${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<InventorySerial>(`/v1/serials/${id}`),
    create: (data: Omit<InventorySerial, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<InventorySerial>('/serials', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<InventorySerial>) =>
        request<InventorySerial>(`/v1/serials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/serials/${id}`, { method: 'DELETE' })
};

// Currencies
export const currenciesAPI = {
    list: (params?: ListParams) =>
        request<ListResponse<Currency>>(`/currencies${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<Currency>(`/v1/currencies/${id}`),
    create: (data: Omit<Currency, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<Currency>('/currencies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Currency>) =>
        request<Currency>(`/v1/currencies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/currencies/${id}`, { method: 'DELETE' })
};

// FX Rates
export const fxRatesAPI = {
    list: (params?: ListParams & { baseCurrencyId?: string; quoteCurrencyId?: string }) =>
        request<ListResponse<FxRate>>(`/fx-rates${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<FxRate>(`/v1/fx-rates/${id}`),
    create: (data: Omit<FxRate, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<FxRate>('/fx-rates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<FxRate>) =>
        request<FxRate>(`/v1/fx-rates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/fx-rates/${id}`, { method: 'DELETE' }),

    // Get latest rate
    getLatest: (baseCurrencyId: string, quoteCurrencyId: string, asOf?: string) =>
        request<FxRate | null>(`/v1/fx-rates/latest${buildQueryString({ baseCurrencyId, quoteCurrencyId, asOf: asOf || '' })}`)
};

// Documents
export const documentsAPI = {
    list: (params?: ListParams & { docType?: string; status?: string; warehouseId?: string; orgId?: string }) =>
        request<ListResponse<InventoryDocument>>(`/documents${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<InventoryDocument>(`/v1/documents/${id}`),
    create: (data: CreateDocumentRequest) =>
        request<InventoryDocument>('/documents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<InventoryDocument>) =>
        request<InventoryDocument>(`/v1/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/documents/${id}`, { method: 'DELETE' }),

    // Lines
    getLines: (documentId: string) =>
        request<InventoryDocumentLine[]>(`/v1/documents/${documentId}/lines`),
    addLine: (documentId: string, data: Omit<InventoryDocumentLine, 'id' | 'documentId' | 'createdAt' | 'updatedAt'>) =>
        request<InventoryDocumentLine>(`/v1/documents/${documentId}/lines`, { method: 'POST', body: JSON.stringify(data) }),
    updateLine: (documentId: string, lineId: string, data: Partial<InventoryDocumentLine>) =>
        request<InventoryDocumentLine>(`/v1/documents/${documentId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLine: (documentId: string, lineId: string) =>
        request<void>(`/v1/documents/${documentId}/lines/${lineId}`, { method: 'DELETE' }),

    // Workflow
    approve: (id: string, data: ApproveDocumentRequest) =>
        request<InventoryDocument>(`/v1/documents/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
    post: (id: string) =>
        request<InventoryDocument>(`/v1/documents/${id}/post`, { method: 'POST' }),
    void: (id: string, data: VoidDocumentRequest) =>
        request<InventoryDocument>(`/v1/documents/${id}/void`, { method: 'POST', body: JSON.stringify(data) })
};

// Reservations
export const reservationsAPI = {
    list: (params?: ListParams & { status?: string; warehouseId?: string; orgId?: string }) =>
        request<ListResponse<InventoryReservation>>(`/reservations${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<InventoryReservation>(`/v1/reservations/${id}`),
    create: (data: CreateReservationRequest) =>
        request<InventoryReservation>('/reservations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<InventoryReservation>) =>
        request<InventoryReservation>(`/v1/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/reservations/${id}`, { method: 'DELETE' }),

    // Lines
    getLines: (reservationId: string) =>
        request<InventoryReservationLine[]>(`/v1/reservations/${reservationId}/lines`),
    addLine: (reservationId: string, data: Omit<InventoryReservationLine, 'id' | 'reservationId' | 'createdAt' | 'updatedAt'>) =>
        request<InventoryReservationLine>(`/v1/reservations/${reservationId}/lines`, { method: 'POST', body: JSON.stringify(data) }),
    updateLine: (reservationId: string, lineId: string, data: Partial<InventoryReservationLine>) =>
        request<InventoryReservationLine>(`/v1/reservations/${reservationId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteLine: (reservationId: string, lineId: string) =>
        request<void>(`/v1/reservations/${reservationId}/lines/${lineId}`, { method: 'DELETE' }),

    // Workflow
    activate: (id: string) =>
        request<InventoryReservation>(`/v1/reservations/${id}/activate`, { method: 'POST' }),
    release: (id: string) =>
        request<InventoryReservation>(`/v1/reservations/${id}/release`, { method: 'POST' }),
    commit: (id: string, data: CommitReservationRequest) =>
        request<{ reservation: InventoryReservation; document: InventoryDocument }>(`/v1/reservations/${id}/commit`, { method: 'POST', body: JSON.stringify(data) })
};

// Reports
export const reportsAPI = {
    stockOnHand: (params?: { warehouseId?: string; itemId?: string; locationId?: string }) =>
        request<StockOnHand[]>(`/v1/reports/stock-on-hand${buildQueryString(params || {})}`),
    stockAvailable: (params?: { warehouseId?: string; itemId?: string; locationId?: string }) =>
        request<StockAvailable[]>(`/v1/reports/stock-available${buildQueryString(params || {})}`),
    reorderAlerts: (params?: { warehouseId?: string }) =>
        request<ReorderAlert[]>(`/v1/reports/reorder-alerts${buildQueryString(params || {})}`),
    fefoLots: (params?: { warehouseId?: string; daysThreshold?: number }) =>
        request<FEFOLot[]>(`/v1/reports/fefo-lots${buildQueryString(params || {})}`),
    valuation: (params?: { warehouseId?: string; currencyId?: string }) =>
        request<{ total: number; currency: string; items: Array<{ itemId: string; sku: string; itemName: string; onHand: number; avgCost: number; value: number }> }>(`/v1/reports/valuation${buildQueryString(params || {})}`)
};

// Dashboard
export const dashboardAPI = {
    getStats: (params?: { orgId?: string; warehouseId?: string }) =>
        request<DashboardStats>(`/v1/dashboard/stats${buildQueryString(params || {})}`),
    getRecentDocuments: (params?: { orgId?: string; warehouseId?: string; limit?: number }) =>
        request<InventoryDocument[]>(`/v1/dashboard/recent-documents${buildQueryString(params || {})}`),
    getActiveReservations: (params?: { orgId?: string; warehouseId?: string; limit?: number }) =>
        request<InventoryReservation[]>(`/v1/dashboard/active-reservations${buildQueryString(params || {})}`)
};

// Users
export const usersAPI = {
    list: (params?: ListParams) =>
        request<ListResponse<AppUser>>(`/users${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<AppUser>(`/v1/users/${id}`),
    create: (data: Omit<AppUser, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<AppUser>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AppUser>) =>
        request<AppUser>(`/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/users/${id}`, { method: 'DELETE' }),

    // Get current user
    me: () =>
        request<{ user: AppUser; grants: UserRoleGrant[] }>('/users/me')
};

// Roles
export const rolesAPI = {
    list: () =>
        request<AppRole[]>('/roles'),
    get: (id: string) =>
        request<AppRole>(`/v1/roles/${id}`)
};

// Role Grants
export const roleGrantsAPI = {
    list: (params?: ListParams & { userId?: string; orgId?: string; warehouseId?: string }) =>
        request<ListResponse<UserRoleGrant>>(`/role-grants${buildQueryString(params || {})}`),
    get: (id: string) =>
        request<UserRoleGrant>(`/v1/role-grants/${id}`),
    create: (data: Omit<UserRoleGrant, 'id' | 'createdAt' | 'updatedAt'>) =>
        request<UserRoleGrant>('/role-grants', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<UserRoleGrant>) =>
        request<UserRoleGrant>(`/v1/role-grants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        request<void>(`/v1/role-grants/${id}`, { method: 'DELETE' })
};

export { APIError };
