// Inventory Type Definitions

export interface Organization {
    id: string;
    code: string;
    name: string;
    baseCurrencyId?: string;
    baseCurrency?: Currency;
    createdAt: string;
    updatedAt: string;
}

export interface Warehouse {
    id: string;
    orgId?: string;
    code: string;
    name: string;
    address?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface WarehouseLocation {
    id: string;
    warehouseId: string;
    code: string;
    name: string;
    locationType: 'bin' | 'shelf' | 'zone' | 'floor' | 'other';
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Party {
    id: string;
    code: string;
    name: string;
    partyType: 'supplier' | 'customer' | 'internal' | 'other';
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UOM {
    id: string;
    code: string;
    name: string;
    precision: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ItemUOMConversion {
    id: string;
    itemId: string;
    fromUomId: string;
    toUomId: string;
    fromUom?: UOM;
    toUom?: UOM;
    multiplier: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    description?: string;
    itemType: 'consumable' | 'spare_part' | 'product' | 'material' | 'service' | 'other';
    baseUomId?: string;
    baseUom?: UOM;
    costMethod: 'FIFO' | 'AVG';
    trackLot: boolean;
    trackExpiry: boolean;
    trackSerial: boolean;
    shelfLifeDays?: number;
    minStock?: number;
    maxStock?: number;
    reorderPoint?: number;
    safetyStock?: number;
    categoryId?: string;
    vendorId?: string;
    modelId?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Computed fields
    onHand?: number;
    reserved?: number;
    available?: number;
    conversions?: ItemUOMConversion[];
}

export interface InventoryLot {
    id: string;
    itemId: string;
    lotCode: string;
    mfgDate?: string;
    expiryDate?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InventorySerial {
    id: string;
    itemId: string;
    serialNo: string;
    status: 'in_stock' | 'issued' | 'scrapped' | 'returned';
    createdAt: string;
    updatedAt: string;
}

export interface Currency {
    id: string;
    code: string;
    name: string;
    symbol?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FxRate {
    id: string;
    baseCurrencyId: string;
    quoteCurrencyId: string;
    baseCurrency?: Currency;
    quoteCurrency?: Currency;
    rate: number;
    asOf: string;
    source?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InventoryDocument {
    id: string;
    orgId?: string;
    docNo: string;
    docType: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUST' | 'STOCKTAKE';
    docDate: string;
    status: 'draft' | 'approved' | 'posted' | 'void';
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    sourceWarehouse?: Warehouse;
    targetWarehouse?: Warehouse;
    counterpartyId?: string;
    counterparty?: Party;
    currencyId?: string;
    currency?: Currency;
    fxRateToBase?: number;
    reference?: string;
    note?: string;
    approvedAt?: string;
    approvedBy?: string;
    approvedByUser?: AppUser;
    approvalNote?: string;
    lockedAt?: string;
    postedAt?: string;
    voidedAt?: string;
    voidedBy?: string;
    voidNote?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
    lines?: InventoryDocumentLine[];
}

export interface InventoryDocumentLine {
    id: string;
    documentId: string;
    lineNo: number;
    itemId: string;
    item?: InventoryItem;
    sourceLocationId?: string;
    targetLocationId?: string;
    sourceLocation?: WarehouseLocation;
    targetLocation?: WarehouseLocation;
    lotId?: string;
    lot?: InventoryLot;
    quantity: number;
    uomId?: string;
    uom?: UOM;
    baseQuantity?: number;
    unitCost?: number;
    unitCostBase?: number;
    adjustDirection?: 'plus' | 'minus';
    note?: string;
    createdAt: string;
    updatedAt: string;
    serials?: InventorySerial[];
}

export interface InventoryReservation {
    id: string;
    orgId?: string;
    reservationNo: string;
    warehouseId: string;
    warehouse?: Warehouse;
    counterpartyId?: string;
    counterparty?: Party;
    reference?: string;
    status: 'draft' | 'active' | 'released' | 'committed' | 'void';
    createdBy?: string;
    createdByUser?: AppUser;
    createdAt: string;
    updatedAt: string;
    lines?: InventoryReservationLine[];
}

export interface InventoryReservationLine {
    id: string;
    reservationId: string;
    lineNo: number;
    itemId: string;
    item?: InventoryItem;
    locationId?: string;
    location?: WarehouseLocation;
    lotId?: string;
    lot?: InventoryLot;
    quantity: number;
    uomId?: string;
    uom?: UOM;
    baseQuantity?: number;
    note?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AppUser {
    id: string;
    username: string;
    displayName?: string;
    email?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AppRole {
    id: string;
    code: 'SYSTEM_ADMIN' | 'ORG_ADMIN' | 'WH_MANAGER' | 'WH_CLERK' | 'VIEWER';
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserRoleGrant {
    id: string;
    userId: string;
    user?: AppUser;
    roleId: string;
    role?: AppRole;
    orgId?: string;
    organization?: Organization;
    warehouseId?: string;
    warehouse?: Warehouse;
    createdAt: string;
    updatedAt: string;
}

export interface StockOnHand {
    warehouseCode: string;
    warehouseName: string;
    locationCode?: string;
    sku: string;
    itemName: string;
    lotCode?: string;
    expiryDate?: string;
    baseUomCode?: string;
    onHandBase: number;
    onHandEntered: number;
}

export interface StockAvailable extends StockOnHand {
    reservedBase: number;
    availableBase: number;
}

export interface ReorderAlert {
    warehouseCode: string;
    sku: string;
    itemName: string;
    onHand: number;
    reorderPoint?: number;
    safetyStock?: number;
    minStock?: number;
    alertLevel: 'CRITICAL' | 'REORDER' | 'BELOW_MIN' | 'OK';
}

export interface FEFOLot {
    warehouseCode: string;
    sku: string;
    itemName: string;
    lotCode: string;
    expiryDate: string;
    lotBalance: number;
    expiryStatus: 'EXPIRED' | 'EXPIRING_SOON' | 'OK';
}

export interface DashboardStats {
    totalValuation: number;
    baseCurrency: string;
    lowStockCount: number;
    expiringLotsCount: number;
    recentDocumentsCount: number;
    activeReservationsCount: number;
}

// API Request/Response types
export interface ListParams {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface ListResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface CreateDocumentRequest {
    orgId?: string;
    docType: InventoryDocument['docType'];
    docDate: string;
    sourceWarehouseId?: string;
    targetWarehouseId?: string;
    counterpartyId?: string;
    currencyId?: string;
    reference?: string;
    note?: string;
    lines: Omit<InventoryDocumentLine, 'id' | 'documentId' | 'createdAt' | 'updatedAt'>[];
}

export interface ApproveDocumentRequest {
    note?: string;
}

export interface VoidDocumentRequest {
    note?: string;
}

export interface CreateReservationRequest {
    orgId?: string;
    warehouseId: string;
    counterpartyId?: string;
    reference?: string;
    lines: Omit<InventoryReservationLine, 'id' | 'reservationId' | 'createdAt' | 'updatedAt'>[];
}

export interface CommitReservationRequest {
    issueDocumentId?: string; // If null, creates new document
}
