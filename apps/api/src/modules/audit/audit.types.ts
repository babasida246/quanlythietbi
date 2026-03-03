/**
 * Audit Module - TypeScript Types
 * Module: 07-AUDIT (Asset Audit/Inventory Check)
 */

// ==================== Enums ====================

export type AuditType = 'full' | 'partial' | 'spot_check';

export type AuditStatus = 'draft' | 'in_progress' | 'reviewing' | 'completed' | 'cancelled';

export type AuditItemStatus = 'pending' | 'found' | 'missing' | 'misplaced' | 'condition_issue';

export type ResolutionStatus = 'unresolved' | 'resolved' | 'pending_action' | 'ignored';

export type UnregisteredAssetAction = 'register' | 'investigate' | 'dispose';

// ==================== Entity Interfaces ====================

export interface AuditSession {
    id: string;
    auditCode: string | null;
    name: string;
    auditType: AuditType;
    scopeDescription: string;
    startDate: string;
    endDate: string | null;
    status: AuditStatus;
    notes: string | null;

    // Progress tracking
    totalItems: number;
    auditedItems: number;
    foundItems: number;
    missingItems: number;
    misplacedItems: number;

    // Completion info
    completedAt: Date | null;
    completedBy: string | null;
    completionNotes: string | null;

    // Cancellation info
    cancelledAt: Date | null;
    cancelledBy: string | null;
    cancelReason: string | null;

    // Multi-tenant
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

export interface AuditSessionWithDetails extends AuditSession {
    createdByName: string;
    locations: string | null;
    categories: string | null;
    auditorCount: number;
    progressPercent: number;
    daysRemaining: number | null;
    isOverdue: boolean;
}

export interface AuditLocation {
    id: string;
    auditId: string;
    locationId: string;
    createdAt: Date;
}

export interface AuditLocationWithDetails extends AuditLocation {
    locationName: string;
    locationPath: string | null;
}

export interface AuditCategory {
    id: string;
    auditId: string;
    categoryId: string;
    createdAt: Date;
}

export interface AuditCategoryWithDetails extends AuditCategory {
    categoryName: string;
}

export interface AuditAuditor {
    id: string;
    auditId: string;
    userId: string;
    assignedLocationId: string | null;
    isLead: boolean;
    createdAt: Date;
}

export interface AuditAuditorWithDetails extends AuditAuditor {
    userName: string;
    userEmail: string;
    assignedLocationName: string | null;
}

export interface AuditItem {
    id: string;
    auditId: string;
    assetId: string;

    // Expected state
    expectedLocationId: string | null;
    expectedUserId: string | null;
    expectedCondition: string | null;

    // Audit result
    auditStatus: AuditItemStatus;

    // Actual state
    actualLocationId: string | null;
    actualUserId: string | null;
    actualCondition: string | null;

    // Audit metadata
    auditedBy: string | null;
    auditedAt: Date | null;
    notes: string | null;

    // Resolution tracking
    resolutionStatus: ResolutionStatus;
    resolutionAction: string | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;

    createdAt: Date;
    updatedAt: Date;
}

export interface AuditItemWithDetails extends AuditItem {
    assetTag: string;
    assetName: string;
    assetSerialNumber: string | null;
    assetModelName: string | null;
    expectedLocationName: string | null;
    actualLocationName: string | null;
    expectedUserName: string | null;
    actualUserName: string | null;
    auditedByName: string | null;
    resolvedByName: string | null;
}

export interface UnregisteredAsset {
    id: string;
    auditId: string;
    temporaryId: string;
    description: string;
    serialNumber: string | null;
    locationFoundId: string | null;
    locationFoundText: string | null;
    condition: string | null;
    photoPath: string | null;

    // Action tracking
    action: UnregisteredAssetAction;
    actionNotes: string | null;

    // If registered
    registeredAssetId: string | null;
    registeredAt: Date | null;
    registeredBy: string | null;

    // Audit metadata
    foundBy: string;
    foundAt: Date;

    createdAt: Date;
    updatedAt: Date;
}

export interface UnregisteredAssetWithDetails extends UnregisteredAsset {
    locationFoundName: string | null;
    foundByName: string;
    registeredByName: string | null;
    registeredAssetTag: string | null;
}

export interface AuditHistory {
    id: string;
    auditId: string;
    action: string;
    actorId: string;
    oldStatus: AuditStatus | null;
    newStatus: AuditStatus | null;
    details: Record<string, unknown> | null;
    createdAt: Date;
}

export interface AuditHistoryWithDetails extends AuditHistory {
    actorName: string;
}

// ==================== DTOs ====================

export interface CreateAuditDto {
    name: string;
    auditType: AuditType;
    scopeDescription: string;
    startDate: string;
    endDate?: string;
    notes?: string;
    locationIds: string[];
    categoryIds?: string[];
    auditorIds: string[];
    auditorAssignments?: Array<{
        userId: string;
        locationId?: string;
        isLead?: boolean;
    }>;
    organizationId?: string;
    createdBy: string;
}

export interface UpdateAuditDto {
    name?: string;
    scopeDescription?: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
}

export interface StartAuditDto {
    auditId: string;
    startedBy: string;
}

export interface CompleteAuditDto {
    auditId: string;
    completedBy: string;
    completionNotes?: string;
    overrideIncomplete?: boolean;
}

export interface CancelAuditDto {
    auditId: string;
    cancelledBy: string;
    reason?: string;
}

export interface AuditItemDto {
    auditId: string;
    assetId: string;
    auditStatus: AuditItemStatus;
    actualLocationId?: string;
    actualUserId?: string;
    actualCondition?: string;
    notes?: string;
    auditedBy: string;
}

export interface BulkAuditItemDto {
    auditId: string;
    items: Array<{
        assetId: string;
        auditStatus: AuditItemStatus;
        actualLocationId?: string;
        notes?: string;
    }>;
    auditedBy: string;
}

export interface ResolveDiscrepancyDto {
    itemId: string;
    resolutionAction: string;
    updateAssetLocation?: boolean;
    resolvedBy: string;
}

export interface CreateUnregisteredAssetDto {
    auditId: string;
    temporaryId: string;
    description: string;
    serialNumber?: string;
    locationFoundId?: string;
    locationFoundText?: string;
    condition?: string;
    photoPath?: string;
    action?: UnregisteredAssetAction;
    actionNotes?: string;
    foundBy: string;
}

export interface UpdateUnregisteredAssetDto {
    description?: string;
    serialNumber?: string;
    condition?: string;
    action?: UnregisteredAssetAction;
    actionNotes?: string;
}

export interface RegisterUnregisteredAssetDto {
    unregisteredId: string;
    assetData: {
        assetTag: string;
        name: string;
        categoryId: string;
        modelId?: string;
        locationId?: string;
        serialNumber?: string;
    };
    registeredBy: string;
}

export interface AssignAuditorDto {
    auditId: string;
    userId: string;
    locationId?: string;
    isLead?: boolean;
}

export interface RemoveAuditorDto {
    auditId: string;
    userId: string;
}

// ==================== Query Interfaces ====================

export interface AuditListQuery {
    page?: number;
    limit?: number;
    status?: AuditStatus | AuditStatus[];
    auditType?: AuditType;
    locationId?: string;
    startDateFrom?: string;
    startDateTo?: string;
    search?: string;
    sortBy?: 'name' | 'start_date' | 'status' | 'progress' | 'created_at';
    sortOrder?: 'asc' | 'desc';
    organizationId?: string;
}

export interface AuditItemListQuery {
    page?: number;
    limit?: number;
    auditStatus?: AuditItemStatus | AuditItemStatus[];
    resolutionStatus?: ResolutionStatus;
    locationId?: string;
    auditorId?: string;
    search?: string;
    sortBy?: 'asset_tag' | 'audit_status' | 'audited_at' | 'resolution_status';
    sortOrder?: 'asc' | 'desc';
}

export interface DiscrepancyQuery {
    page?: number;
    limit?: number;
    auditStatus?: AuditItemStatus[];
    resolutionStatus?: ResolutionStatus;
    sortBy?: 'asset_tag' | 'audit_status' | 'audited_at';
    sortOrder?: 'asc' | 'desc';
}

export interface UnregisteredAssetQuery {
    page?: number;
    limit?: number;
    action?: UnregisteredAssetAction;
    sortBy?: 'found_at' | 'temporary_id' | 'action';
    sortOrder?: 'asc' | 'desc';
}

// ==================== Result Types ====================

export interface AuditResult {
    success: boolean;
    audit?: AuditSession;
    error?: string;
}

export interface AuditItemResult {
    success: boolean;
    item?: AuditItem;
    error?: string;
}

export interface BulkAuditResult {
    success: boolean;
    processed: number;
    failed: number;
    errors?: Array<{ assetId: string; error: string }>;
}

export interface AuditCompletionCheck {
    canComplete: boolean;
    totalItems: number;
    auditedItems: number;
    pendingItems: number;
    percentComplete: number;
    hasUnresolvedDiscrepancies: boolean;
    unresolvedCount: number;
    warnings: string[];
}

export interface AuditStatistics {
    totalAudits: number;
    activeAudits: number;
    completedAudits: number;
    overdueAudits: number;
    avgFoundRate: number;
    avgMissingRate: number;
    avgCompletionTime: number;
    byType: {
        full: number;
        partial: number;
        spot_check: number;
    };
    byStatus: Record<AuditStatus, number>;
    recentDiscrepancies: number;
}

export interface AuditProgress {
    auditId: string;
    totalItems: number;
    auditedItems: number;
    pendingItems: number;
    foundItems: number;
    missingItems: number;
    misplacedItems: number;
    conditionIssues: number;
    progressPercent: number;
    byLocation: Array<{
        locationId: string;
        locationName: string;
        total: number;
        audited: number;
        percent: number;
    }>;
    byAuditor: Array<{
        auditorId: string;
        auditorName: string;
        audited: number;
    }>;
}

export interface ScanResult {
    found: boolean;
    inAudit: boolean;
    asset?: {
        id: string;
        assetTag: string;
        name: string;
        expectedLocation: string | null;
        currentStatus: AuditItemStatus | null;
    };
    message: string;
}

// ==================== Paginated Response ====================

export interface PaginatedAudits {
    data: AuditSessionWithDetails[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface PaginatedAuditItems {
    data: AuditItemWithDetails[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface PaginatedUnregisteredAssets {
    data: UnregisteredAssetWithDetails[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
