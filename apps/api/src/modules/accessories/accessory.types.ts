/**
 * Accessories Module - Type Definitions
 * TypeScript interfaces for accessories management
 */

// ==================== Base Types ====================

export type AccessoryStatus = 'active' | 'inactive' | 'discontinued';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type CheckoutStatus = 'checked_out' | 'partially_returned' | 'returned';
export type AssignmentType = 'user' | 'asset';
export type AdjustmentType =
    | 'purchase'
    | 'return_to_supplier'
    | 'lost'
    | 'damaged'
    | 'inventory_adjustment'
    | 'initial_stock'
    | 'transfer_in'
    | 'transfer_out';

// ==================== Entity Interfaces ====================

export interface AccessoryCategory {
    id: string;
    code: string;
    name: string;
    description: string | null;
    parentId: string | null;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AccessoryManufacturer {
    id: string;
    code: string;
    name: string;
    website: string | null;
    supportUrl: string | null;
    supportPhone: string | null;
    supportEmail: string | null;
    notes: string | null;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Accessory {
    id: string;
    accessoryCode: string;
    name: string;
    modelNumber: string | null;
    categoryId: string | null;
    manufacturerId: string | null;
    imageUrl: string | null;
    totalQuantity: number;
    availableQuantity: number;
    minQuantity: number;
    unitPrice: number;
    currency: string;
    supplierId: string | null;
    purchaseOrder: string | null;
    purchaseDate: string | null;
    locationId: string | null;
    locationName: string | null;
    notes: string | null;
    organizationId: string | null;
    status: AccessoryStatus;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AccessoryWithDetails extends Accessory {
    categoryName: string | null;
    manufacturerName: string | null;
    supplierName: string | null;
    checkedOutQuantity: number;
    stockStatus: StockStatus;
}

export interface AccessoryCheckout {
    id: string;
    accessoryId: string;
    quantity: number;
    quantityReturned: number;
    assignmentType: AssignmentType;
    assignedUserId: string | null;
    assignedAssetId: string | null;
    checkoutDate: Date;
    expectedCheckinDate: string | null;
    actualCheckinDate: Date | null;
    checkedOutBy: string;
    checkedInBy: string | null;
    checkoutNotes: string | null;
    checkinNotes: string | null;
    status: CheckoutStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface AccessoryCheckoutWithDetails extends AccessoryCheckout {
    accessoryName: string;
    accessoryCode: string;
    remainingQuantity: number;
    isOverdue: boolean;
    assignedUserName?: string;
    assignedAssetTag?: string;
}

export interface AccessoryStockAdjustment {
    id: string;
    accessoryId: string;
    adjustmentType: AdjustmentType;
    quantityChange: number;
    quantityBefore: number;
    quantityAfter: number;
    referenceType: string | null;
    referenceId: string | null;
    referenceNumber: string | null;
    reason: string | null;
    notes: string | null;
    performedBy: string;
    performedAt: Date;
}

export interface AccessoryAuditLog {
    id: string;
    accessoryId: string;
    action: string;
    fieldName: string | null;
    oldValue: any;
    newValue: any;
    checkoutId: string | null;
    adjustmentId: string | null;
    notes: string | null;
    performedBy: string;
    performedAt: Date;
}

// ==================== DTO Interfaces ====================

export interface CreateAccessoryDto {
    accessoryCode?: string;
    name: string;
    modelNumber?: string;
    categoryId?: string;
    manufacturerId?: string;
    imageUrl?: string;
    totalQuantity: number;
    minQuantity?: number;
    unitPrice?: number;
    currency?: string;
    supplierId?: string;
    purchaseOrder?: string;
    purchaseDate?: string;
    locationId?: string;
    locationName?: string;
    notes?: string;
    organizationId?: string;
}

export interface UpdateAccessoryDto {
    name?: string;
    modelNumber?: string | null;
    categoryId?: string | null;
    manufacturerId?: string | null;
    imageUrl?: string | null;
    minQuantity?: number;
    unitPrice?: number;
    currency?: string;
    supplierId?: string | null;
    purchaseOrder?: string | null;
    purchaseDate?: string | null;
    locationId?: string | null;
    locationName?: string | null;
    notes?: string | null;
    status?: AccessoryStatus;
}

export interface CheckoutAccessoryDto {
    accessoryId: string;
    quantity: number;
    assignmentType: AssignmentType;
    assignedUserId?: string;
    assignedAssetId?: string;
    expectedCheckinDate?: string;
    notes?: string;
}

export interface CheckinAccessoryDto {
    checkoutId: string;
    quantityReturned: number;
    notes?: string;
}

export interface AdjustStockDto {
    accessoryId: string;
    adjustmentType: AdjustmentType;
    quantityChange: number;
    referenceNumber?: string;
    reason?: string;
    notes?: string;
}

export interface CreateCategoryDto {
    code: string;
    name: string;
    description?: string;
    parentId?: string;
}

export interface CreateManufacturerDto {
    code: string;
    name: string;
    website?: string;
    supportUrl?: string;
    supportPhone?: string;
    supportEmail?: string;
    notes?: string;
}

// ==================== Query Interfaces ====================

export interface AccessoryListQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    status?: AccessoryStatus[];
    categoryId?: string;
    manufacturerId?: string;
    supplierId?: string;
    stockStatus?: StockStatus;
    organizationId?: string;
}

export interface CheckoutListQuery {
    page?: number;
    limit?: number;
    accessoryId?: string;
    assignedUserId?: string;
    assignedAssetId?: string;
    status?: CheckoutStatus[];
    isOverdue?: boolean;
}

// ==================== Result Interfaces ====================

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface StockSummary {
    totalItems: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number;
    currency: string;
}

export interface CheckoutSummary {
    totalCheckouts: number;
    activeCheckouts: number;
    overdueCheckouts: number;
    returnedThisMonth: number;
}
