/**
 * Consumables Module - Type Definitions
 * Manages IT consumable items: ink, paper, cables, batteries, etc.
 */

// ==================== Enums ====================

export type ConsumableStatus = 'active' | 'inactive' | 'discontinued';
export type IssueType = 'user' | 'department' | 'asset' | 'general';
export type ReceiptType = 'purchase' | 'return' | 'transfer' | 'adjustment' | 'initial';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// ==================== Core Entities ====================

export interface Consumable {
    id: string;
    consumableCode: string;
    name: string;
    categoryId: string | null;
    manufacturerId: string | null;
    modelNumber: string | null;
    partNumber: string | null;
    imageUrl: string | null;
    unitOfMeasure: string;
    quantity: number;
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
    status: ConsumableStatus;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConsumableWithDetails extends Consumable {
    categoryName: string | null;
    manufacturerName: string | null;
    supplierName: string | null;
    stockStatus: StockStatus;
    totalIssued: number;
}

export interface ConsumableIssue {
    id: string;
    consumableId: string;
    quantity: number;
    issueType: IssueType;
    issuedToUserId: string | null;
    issuedToDepartment: string | null;
    issuedToAssetId: string | null;
    issueDate: Date;
    issuedBy: string;
    referenceNumber: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConsumableIssueWithDetails extends ConsumableIssue {
    consumableName: string;
    consumableCode: string;
    userName: string | null;
    assetTag: string | null;
}

export interface ConsumableReceipt {
    id: string;
    consumableId: string;
    quantity: number;
    receiptType: ReceiptType;
    purchaseOrder: string | null;
    unitCost: number | null;
    totalCost: number | null;
    receiptDate: Date;
    supplierId: string | null;
    invoiceNumber: string | null;
    receivedBy: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConsumableReceiptWithDetails extends ConsumableReceipt {
    consumableName: string;
    consumableCode: string;
    supplierName: string | null;
}

export interface ConsumableCategory {
    id: string;
    code: string;
    name: string;
    description: string | null;
    parentId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConsumableManufacturer {
    id: string;
    code: string;
    name: string;
    website: string | null;
    supportUrl: string | null;
    supportPhone: string | null;
    supportEmail: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConsumableAuditLog {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    changes: Record<string, unknown> | null;
    performedBy: string;
    performedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    notes: string | null;
}

// ==================== DTOs ====================

export interface CreateConsumableDto {
    name: string;
    categoryId?: string;
    manufacturerId?: string;
    modelNumber?: string;
    partNumber?: string;
    imageUrl?: string;
    unitOfMeasure: string;
    quantity: number;
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

export interface UpdateConsumableDto {
    name?: string;
    categoryId?: string | null;
    manufacturerId?: string | null;
    modelNumber?: string | null;
    partNumber?: string | null;
    imageUrl?: string | null;
    unitOfMeasure?: string;
    minQuantity?: number;
    unitPrice?: number;
    currency?: string;
    supplierId?: string | null;
    purchaseOrder?: string | null;
    purchaseDate?: string | null;
    locationId?: string | null;
    locationName?: string | null;
    notes?: string | null;
    status?: ConsumableStatus;
}

export interface IssueConsumableDto {
    consumableId: string;
    quantity: number;
    issueType: IssueType;
    issuedToUserId?: string;
    issuedToDepartment?: string;
    issuedToAssetId?: string;
    referenceNumber?: string;
    notes?: string;
}

export interface ReceiveConsumableDto {
    consumableId: string;
    quantity: number;
    receiptType?: ReceiptType;
    purchaseOrder?: string;
    unitCost?: number;
    supplierId?: string;
    invoiceNumber?: string;
    notes?: string;
}

export interface CreateCategoryDto {
    code: string;
    name: string;
    description?: string;
    parentId?: string;
}

export interface UpdateCategoryDto {
    name?: string;
    description?: string | null;
    parentId?: string | null;
    isActive?: boolean;
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

export interface UpdateManufacturerDto {
    name?: string;
    website?: string | null;
    supportUrl?: string | null;
    supportPhone?: string | null;
    supportEmail?: string | null;
    notes?: string | null;
    isActive?: boolean;
}

// ==================== Query Interfaces ====================

export interface ConsumableListQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    status?: ConsumableStatus[];
    categoryId?: string;
    manufacturerId?: string;
    supplierId?: string;
    stockStatus?: StockStatus;
    organizationId?: string;
}

export interface IssueListQuery {
    page?: number;
    limit?: number;
    consumableId?: string;
    issueType?: IssueType[];
    issuedToUserId?: string;
    issuedToAssetId?: string;
    startDate?: string;
    endDate?: string;
}

export interface ReceiptListQuery {
    page?: number;
    limit?: number;
    consumableId?: string;
    receiptType?: ReceiptType[];
    supplierId?: string;
    startDate?: string;
    endDate?: string;
}

export interface AuditLogQuery {
    page?: number;
    limit?: number;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
}

// ==================== Response Interfaces ====================

export interface PaginatedResponse<T> {
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
}

export interface ConsumptionSummary {
    consumableId: string;
    consumableName: string;
    totalIssued: number;
    totalValue: number;
    periodStart: string;
    periodEnd: string;
}

export interface TopConsumer {
    recipientType: IssueType;
    recipientId: string | null;
    recipientName: string | null;
    totalQuantity: number;
    totalValue: number;
}

export interface LowStockItem {
    id: string;
    consumableCode: string;
    name: string;
    quantity: number;
    minQuantity: number;
    deficit: number;
    unitOfMeasure: string;
}
