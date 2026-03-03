/**
 * Checkout Module - Type Definitions
 * TypeScript interfaces for asset checkout/checkin management
 */

// ==================== Base Types ====================

export type CheckoutType = 'user' | 'location' | 'asset';
export type CheckoutStatus = 'checked_out' | 'checked_in';
export type CheckoutCondition = 'good' | 'damaged' | 'needs_maintenance';
export type NextAction = 'available' | 'maintenance' | 'retire';
export type DueStatus = 'on_track' | 'due_soon' | 'overdue' | 'indefinite';

// ==================== Entity Interfaces ====================

export interface AssetCheckout {
    id: string;
    checkoutCode: string;
    assetId: string;
    checkoutType: CheckoutType;
    targetUserId: string | null;
    targetLocationId: string | null;
    targetAssetId: string | null;
    checkoutDate: Date;
    expectedCheckinDate: string | null;
    checkedOutBy: string;
    checkoutNotes: string | null;
    checkinDate: Date | null;
    checkedInBy: string | null;
    checkinNotes: string | null;
    checkinCondition: CheckoutCondition | null;
    nextAction: NextAction | null;
    status: CheckoutStatus;
    isOverdue: boolean;
    overdueNotifiedAt: Date | null;
    overdueNotificationCount: number;
    organizationId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface AssetCheckoutWithDetails extends AssetCheckout {
    // Asset info
    assetTag: string;
    assetName: string;
    assetCategory: string | null;
    assetSerialNumber: string | null;

    // Target info (depends on type)
    targetUserName: string | null;
    targetUserEmail: string | null;
    targetLocationName: string | null;
    targetAssetTag: string | null;
    targetAssetName: string | null;

    // Performer info
    checkedOutByName: string | null;
    checkedInByName: string | null;

    // Calculated fields
    dueStatus: DueStatus;
    daysUntilDue: number | null;
    daysOverdue: number | null;
}

export interface CheckoutExtension {
    id: string;
    checkoutId: string;
    previousExpectedDate: string;
    newExpectedDate: string;
    extensionReason: string | null;
    extendedBy: string;
    extendedAt: Date;
    notes: string | null;
}

export interface CheckoutExtensionWithDetails extends CheckoutExtension {
    extendedByName: string | null;
    checkoutCode: string;
    assetTag: string;
}

export interface CheckoutTransfer {
    id: string;
    originalCheckoutId: string;
    newCheckoutId: string;
    fromUserId: string;
    toUserId: string;
    transferReason: string | null;
    transferredBy: string;
    transferredAt: Date;
    notes: string | null;
}

export interface CheckoutTransferWithDetails extends CheckoutTransfer {
    fromUserName: string | null;
    toUserName: string | null;
    transferredByName: string | null;
    assetTag: string;
    assetName: string;
}

export interface CheckoutAuditLog {
    id: string;
    checkoutId: string | null;
    assetId: string | null;
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

// Checkout DTOs
export interface CheckoutAssetDto {
    assetId: string;
    checkoutType: CheckoutType;
    targetUserId?: string | null;
    targetLocationId?: string | null;
    targetAssetId?: string | null;
    expectedCheckinDate?: string | null;
    checkoutNotes?: string | null;
    organizationId?: string | null;
    checkedOutBy: string;
}

export interface CheckinAssetDto {
    checkoutId: string;
    checkinCondition: CheckoutCondition;
    nextAction: NextAction;
    checkinNotes?: string | null;
    checkedInBy: string;
}

export interface ExtendCheckoutDto {
    checkoutId: string;
    newExpectedDate: string;
    extensionReason?: string | null;
    notes?: string | null;
    extendedBy: string;
}

export interface TransferAssetDto {
    checkoutId: string;
    toUserId: string;
    newExpectedCheckinDate?: string | null;
    transferReason?: string | null;
    notes?: string | null;
    transferredBy: string;
}

// ==================== Query Parameters ====================

export interface CheckoutListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: CheckoutStatus | CheckoutStatus[];
    checkoutType?: CheckoutType | CheckoutType[];
    dueStatus?: DueStatus | DueStatus[];
    assetId?: string;
    targetUserId?: string;
    targetLocationId?: string;
    checkedOutBy?: string;
    organizationId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'checkoutDate' | 'expectedCheckinDate' | 'checkoutCode' | 'assetTag';
    sortOrder?: 'asc' | 'desc';
}

export interface CheckoutHistoryQuery {
    page?: number;
    limit?: number;
    assetId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'checkoutDate' | 'checkinDate';
    sortOrder?: 'asc' | 'desc';
}

export interface ExtensionListQuery {
    page?: number;
    limit?: number;
    checkoutId?: string;
    extendedBy?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface TransferListQuery {
    page?: number;
    limit?: number;
    fromUserId?: string;
    toUserId?: string;
    transferredBy?: string;
    dateFrom?: string;
    dateTo?: string;
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

export interface CheckoutDashboard {
    totalCheckedOut: number;
    overdueCount: number;
    dueSoonCount: number;
    upcomingReturns: AssetCheckoutWithDetails[];
    recentActivity: CheckoutAuditLog[];
}

export interface CheckoutSummary {
    totalActive: number;
    byType: {
        user: number;
        location: number;
        asset: number;
    };
    byStatus: {
        onTrack: number;
        dueSoon: number;
        overdue: number;
        indefinite: number;
    };
    avgCheckoutDays: number;
    totalOverdue: number;
}

export interface UserCheckoutSummary {
    userId: string;
    userName: string | null;
    activeCheckouts: number;
    overdueCount: number;
    totalCheckouts: number;
    avgReturnTime: number | null;
}

export interface AssetCheckoutHistory {
    assetId: string;
    assetTag: string;
    assetName: string;
    currentCheckout: AssetCheckoutWithDetails | null;
    checkoutHistory: AssetCheckoutWithDetails[];
    totalCheckouts: number;
}

// ==================== Notification Types ====================

export interface CheckoutNotification {
    type: 'checkout' | 'checkin' | 'due_reminder' | 'overdue' | 'transfer';
    checkoutId: string;
    assetId: string;
    assetTag: string;
    assetName: string;
    recipientUserId: string;
    recipientEmail: string;
    message: string;
    dueDate?: string | null;
    daysOverdue?: number;
}

// ==================== Overdue Processing ====================

export interface OverdueCheckout {
    checkoutId: string;
    checkoutCode: string;
    assetId: string;
    assetTag: string;
    assetName: string;
    targetUserId: string;
    targetUserName: string | null;
    targetUserEmail: string | null;
    expectedCheckinDate: string;
    daysOverdue: number;
    notificationCount: number;
    lastNotifiedAt: Date | null;
}

export interface OverdueProcessingResult {
    processed: number;
    notificationsSent: number;
    errors: string[];
}
