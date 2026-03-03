/**
 * Components Module - Type Definitions
 * TypeScript interfaces for IT component management (RAM, SSD, CPU, GPU, etc.)
 */

// ==================== Base Types ====================

export type ComponentStatus = 'active' | 'inactive' | 'discontinued';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type AssignmentStatus = 'installed' | 'removed';
export type ComponentType =
    | 'ram'
    | 'ssd'
    | 'hdd'
    | 'cpu'
    | 'gpu'
    | 'psu'
    | 'motherboard'
    | 'network_card'
    | 'other';
export type RemovalReason = 'upgrade' | 'repair' | 'decommission';
export type PostRemovalAction = 'restock' | 'dispose';
export type ReceiptType = 'purchase' | 'restock' | 'transfer' | 'adjustment' | 'initial';

// ==================== Entity Interfaces ====================

export interface ComponentCategory {
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

export interface ComponentManufacturer {
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

export interface Component {
    id: string;
    componentCode: string;
    name: string;
    modelNumber: string | null;
    categoryId: string | null;
    manufacturerId: string | null;
    componentType: ComponentType;
    specifications: string | null;
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
    organizationId: string | null;
    notes: string | null;
    status: ComponentStatus;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ComponentWithDetails extends Component {
    categoryName: string | null;
    manufacturerName: string | null;
    supplierName: string | null;
    installedQuantity: number;
    stockStatus: StockStatus;
}

export interface ComponentAssignment {
    id: string;
    componentId: string;
    quantity: number;
    serialNumbers: string[] | null;
    assetId: string;
    installedAt: Date;
    installedBy: string;
    installationNotes: string | null;
    removedAt: Date | null;
    removedBy: string | null;
    removalReason: RemovalReason | null;
    removalNotes: string | null;
    postRemovalAction: PostRemovalAction | null;
    status: AssignmentStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface ComponentAssignmentWithDetails extends ComponentAssignment {
    componentCode: string;
    componentName: string;
    componentType: ComponentType;
    assetTag: string;
    assetName: string;
    installedByName: string | null;
    removedByName: string | null;
}

export interface ComponentReceipt {
    id: string;
    componentId: string;
    quantity: number;
    serialNumbers: string[] | null;
    receiptType: ReceiptType;
    supplierId: string | null;
    purchaseOrder: string | null;
    unitCost: number | null;
    referenceNumber: string | null;
    referenceType: string | null;
    referenceId: string | null;
    receivedBy: string;
    receivedAt: Date;
    notes: string | null;
    createdAt: Date;
}

export interface ComponentReceiptWithDetails extends ComponentReceipt {
    componentCode: string;
    componentName: string;
    receivedByName: string | null;
    supplierName: string | null;
}

export interface ComponentAuditLog {
    id: string;
    componentId: string | null;
    assignmentId: string | null;
    receiptId: string | null;
    action: string;
    actionType: string;
    oldValues: Record<string, unknown> | null;
    newValues: Record<string, unknown> | null;
    performedBy: string;
    performedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    notes: string | null;
}

// ==================== DTOs ====================

// Component DTOs
export interface CreateComponentDto {
    componentCode: string;
    name: string;
    modelNumber?: string | null;
    categoryId?: string | null;
    manufacturerId?: string | null;
    componentType: ComponentType;
    specifications?: string | null;
    imageUrl?: string | null;
    totalQuantity: number;
    availableQuantity?: number;
    minQuantity?: number;
    unitPrice?: number;
    currency?: string;
    supplierId?: string | null;
    purchaseOrder?: string | null;
    purchaseDate?: string | null;
    locationId?: string | null;
    locationName?: string | null;
    organizationId?: string | null;
    notes?: string | null;
    status?: ComponentStatus;
    createdBy: string;
}

export interface UpdateComponentDto {
    name?: string;
    modelNumber?: string | null;
    categoryId?: string | null;
    manufacturerId?: string | null;
    componentType?: ComponentType;
    specifications?: string | null;
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
    status?: ComponentStatus;
    updatedBy: string;
}

// Assignment DTOs (Install/Remove)
export interface InstallComponentDto {
    componentId: string;
    quantity: number;
    serialNumbers?: string[] | null;
    assetId: string;
    installationNotes?: string | null;
    installedBy: string;
}

export interface RemoveComponentDto {
    assignmentId: string;
    removalReason: RemovalReason;
    postRemovalAction: PostRemovalAction;
    removalNotes?: string | null;
    removedBy: string;
}

// Receipt DTO
export interface ReceiveComponentDto {
    componentId: string;
    quantity: number;
    serialNumbers?: string[] | null;
    receiptType: ReceiptType;
    supplierId?: string | null;
    purchaseOrder?: string | null;
    unitCost?: number | null;
    referenceNumber?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    receivedBy: string;
}

// Category DTOs
export interface CreateCategoryDto {
    code: string;
    name: string;
    description?: string | null;
    parentId?: string | null;
    isActive?: boolean;
    createdBy: string;
}

export interface UpdateCategoryDto {
    name?: string;
    description?: string | null;
    parentId?: string | null;
    isActive?: boolean;
}

// Manufacturer DTOs
export interface CreateManufacturerDto {
    code: string;
    name: string;
    website?: string | null;
    supportUrl?: string | null;
    supportPhone?: string | null;
    supportEmail?: string | null;
    notes?: string | null;
    isActive?: boolean;
    createdBy: string;
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

// ==================== Query Parameters ====================

export interface ComponentListQuery {
    page?: number;
    limit?: number;
    search?: string;
    componentType?: ComponentType | ComponentType[];
    categoryId?: string;
    manufacturerId?: string;
    status?: ComponentStatus | ComponentStatus[];
    locationId?: string;
    supplierId?: string;
    stockStatus?: StockStatus | StockStatus[];
    organizationId?: string;
    sortBy?: 'name' | 'componentCode' | 'createdAt' | 'availableQuantity' | 'componentType';
    sortOrder?: 'asc' | 'desc';
}

export interface AssignmentListQuery {
    page?: number;
    limit?: number;
    componentId?: string;
    assetId?: string;
    status?: AssignmentStatus | AssignmentStatus[];
    installedBy?: string;
    removalReason?: RemovalReason | RemovalReason[];
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'installedAt' | 'removedAt' | 'componentCode' | 'assetTag';
    sortOrder?: 'asc' | 'desc';
}

export interface ReceiptListQuery {
    page?: number;
    limit?: number;
    componentId?: string;
    receiptType?: ReceiptType | ReceiptType[];
    supplierId?: string;
    receivedBy?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'receivedAt' | 'quantity' | 'componentCode';
    sortOrder?: 'asc' | 'desc';
}

export interface CategoryListQuery {
    page?: number;
    limit?: number;
    search?: string;
    parentId?: string | null;
    isActive?: boolean;
}

export interface ManufacturerListQuery {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
}

// ==================== Response Types ====================

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface StockAlert {
    id: string;
    componentCode: string;
    name: string;
    componentType: ComponentType;
    totalQuantity: number;
    availableQuantity: number;
    minQuantity: number;
    stockStatus: StockStatus;
    categoryName: string | null;
    locationName: string | null;
}

export interface StockSummary {
    totalComponents: number;
    totalQuantity: number;
    totalAvailable: number;
    totalInstalled: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValue: number;
}

export interface AssetComponents {
    assetId: string;
    assetTag: string;
    assetName: string;
    components: ComponentAssignmentWithDetails[];
}
