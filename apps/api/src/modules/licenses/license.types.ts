/**
 * License Module - Type Definitions
 */

// License type enum
export type LicenseType = 'per_seat' | 'per_device' | 'per_user' | 'site_license' | 'unlimited';

// License status enum
export type LicenseStatus = 'draft' | 'active' | 'expired' | 'retired';

// Seat assignment type enum
export type SeatAssignmentType = 'user' | 'asset';

// License entity
export interface License {
    id: string;
    licenseCode: string;
    softwareName: string;
    supplierId?: string;
    categoryId?: string;
    licenseType: LicenseType;
    productKey?: string;
    seatCount: number;
    unitPrice: number;
    currency: string;
    purchaseDate?: Date;
    expiryDate?: Date;
    warrantyDate?: Date;
    invoiceNumber?: string;
    notes?: string;
    status: LicenseStatus;
    organizationId?: string;
    createdBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

// License with computed fields
export interface LicenseWithUsage extends License {
    seatsUsed: number;
    seatsAvailable: number;
    usagePercentage: number;
    supplierName?: string;
    categoryName?: string;
}

// License seat entity
export interface LicenseSeat {
    id: string;
    licenseId: string;
    assignmentType: SeatAssignmentType;
    assignedUserId?: string;
    assignedAssetId?: string;
    assignedAt: Date;
    assignedBy: string;
    notes?: string;
    createdAt: Date;
}

// License seat with details
export interface LicenseSeatWithDetails extends LicenseSeat {
    userName?: string;
    userEmail?: string;
    assetCode?: string;
    assetName?: string;
}

// License audit log
export interface LicenseAuditLog {
    id: string;
    licenseId: string;
    action: string;
    actorUserId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    notes?: string;
    createdAt: Date;
}

// Supplier entity
export interface Supplier {
    id: string;
    code: string;
    name: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    website?: string;
    notes?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// License category
export interface LicenseCategory {
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
}

// Create license DTO
export interface CreateLicenseDto {
    licenseCode?: string; // Auto-generate if not provided
    softwareName: string;
    supplierId?: string;
    categoryId?: string;
    licenseType?: LicenseType;
    productKey?: string;
    seatCount: number;
    unitPrice?: number;
    currency?: string;
    purchaseDate?: string;
    expiryDate?: string;
    warrantyDate?: string;
    invoiceNumber?: string;
    notes?: string;
    organizationId?: string;
}

// Update license DTO
export interface UpdateLicenseDto {
    softwareName?: string;
    supplierId?: string;
    categoryId?: string;
    licenseType?: LicenseType;
    productKey?: string;
    seatCount?: number;
    unitPrice?: number;
    currency?: string;
    purchaseDate?: string;
    expiryDate?: string;
    warrantyDate?: string;
    invoiceNumber?: string;
    notes?: string;
    status?: LicenseStatus;
}

// Assign seat DTO
export interface AssignSeatDto {
    assignmentType: SeatAssignmentType;
    assignedUserId?: string;
    assignedAssetId?: string;
    notes?: string;
}

// List query params
export interface LicenseListQuery {
    page?: number;
    limit?: number;
    status?: LicenseStatus | LicenseStatus[];
    licenseType?: LicenseType;
    supplierId?: string;
    categoryId?: string;
    search?: string;
    expiringInDays?: number;
    overSeats?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Paginated result
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
