/**
 * Depreciation Module - Type Definitions
 */

// Depreciation method enum
export type DepreciationMethod =
    | 'straight_line'
    | 'declining_balance'
    | 'double_declining'
    | 'sum_of_years'
    | 'units_of_production';

// Schedule status enum
export type ScheduleStatus = 'active' | 'fully_depreciated' | 'stopped';

// Run type enum
export type RunType = 'monthly' | 'adjustment' | 'closing';

// Run status enum
export type RunStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Depreciation schedule entity
export interface DepreciationSchedule {
    id: string;
    assetId: string;
    depreciationMethod: DepreciationMethod;
    originalCost: number;
    salvageValue: number;
    usefulLifeYears: number;
    startDate: string;
    endDate: string;
    status: ScheduleStatus;
    accumulatedDepreciation: number;
    stoppedAt: string | null;
    stoppedReason: string | null;
    notes: string | null;
    organizationId: string | null;
    createdBy: string;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Depreciation schedule with asset info
export interface DepreciationScheduleWithDetails extends DepreciationSchedule {
    assetTag: string;
    assetName: string;
    assetSerialNumber?: string;
    categoryId?: string;
    categoryName?: string;
    currentBookValue?: number;
    depreciationProgressPercent?: number;
    monthlyDepreciation?: number;
    remainingMonths?: number;
}

// Depreciation entry entity
export interface DepreciationEntry {
    id: string;
    scheduleId: string;
    runId: string | null;
    periodYear: number;
    periodMonth: number;
    depreciationAmount: number;
    beginningBookValue: number;
    endingBookValue: number;
    isPosted: boolean;
    postedAt: Date | null;
    postedBy: string | null;
    isAdjustment: boolean;
    adjustmentReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

// Depreciation entry with asset info
export interface DepreciationEntryWithDetails extends DepreciationEntry {
    assetId: string;
    assetTag: string;
    assetName: string;
    runCode: string | null;
    postedByName: string | null;
}

// Depreciation run entity
export interface DepreciationRun {
    id: string;
    runCode: string;
    runType: RunType;
    periodYear: number;
    periodMonth: number;
    status: RunStatus;
    totalAssets: number;
    totalAmount: number;
    errorMessage: string | null;
    completedAt: Date | null;
    organizationId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
}

// Depreciation setting entity
export interface DepreciationSetting {
    id: string;
    settingKey: string;
    settingValue: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    updatedBy: string | null;
}

// ==================== DTOs ====================

// Create schedule DTO
export interface CreateScheduleDto {
    assetId: string;
    depreciationMethod: DepreciationMethod;
    originalCost: number;
    salvageValue?: number;
    usefulLifeYears: number;
    startDate: string;
    notes?: string;
    organizationId?: string;
    createdBy: string;
}

// Update schedule DTO
export interface UpdateScheduleDto {
    notes?: string;
    updatedBy: string;
}

// Stop schedule DTO
export interface StopScheduleDto {
    scheduleId: string;
    stoppedAt: string;
    stoppedReason?: string;
    updatedBy: string;
}

// Run depreciation DTO
export interface RunDepreciationDto {
    periodYear: number;
    periodMonth: number;
    organizationId?: string;
    createdBy: string;
}

// Post entries DTO
export interface PostEntriesDto {
    entryIds: string[];
    postedBy: string;
}

// Create entry DTO (internal use)
export interface CreateEntryDto {
    scheduleId: string;
    runId?: string;
    periodYear: number;
    periodMonth: number;
    depreciationAmount: number;
    beginningBookValue: number;
    endingBookValue: number;
    isAdjustment?: boolean;
    adjustmentReason?: string;
    createdBy: string;
}

// Create adjustment entry DTO
export interface CreateAdjustmentDto {
    scheduleId: string;
    periodYear: number;
    periodMonth: number;
    adjustmentAmount: number;
    adjustmentReason: string;
    createdBy: string;
}

// ==================== Query Interfaces ====================

// Schedule list query
export interface ScheduleListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: ScheduleStatus;
    method?: DepreciationMethod;
    categoryId?: string;
    endingSoon?: boolean;
    organizationId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Entry list query
export interface EntryListQuery {
    page?: number;
    limit?: number;
    scheduleId?: string;
    assetId?: string;
    periodYear?: number;
    periodMonth?: number;
    isPosted?: boolean;
    organizationId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Run list query
export interface RunListQuery {
    page?: number;
    limit?: number;
    periodYear?: number;
    status?: RunStatus;
    organizationId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ==================== Result Types ====================

// Schedule result
export interface ScheduleResult {
    success: boolean;
    schedule?: DepreciationSchedule;
    error?: string;
}

// Entry result
export interface EntryResult {
    success: boolean;
    entry?: DepreciationEntry;
    error?: string;
}

// Run result
export interface RunResult {
    success: boolean;
    run?: DepreciationRun;
    entriesCreated?: number;
    totalAmount?: number;
    error?: string;
}

// Post result
export interface PostResult {
    success: boolean;
    postedCount: number;
    error?: string;
}

// Schedule preview
export interface SchedulePreview {
    originalCost: number;
    salvageValue: number;
    depreciableAmount: number;
    usefulLifeYears: number;
    totalMonths: number;
    monthlyDepreciation: number;
    entries: {
        periodYear: number;
        periodMonth: number;
        depreciationAmount: number;
        accumulatedDepreciation: number;
        bookValue: number;
    }[];
}

// Dashboard statistics
export interface DepreciationDashboard {
    activeSchedules: number;
    fullyDepreciated: number;
    stoppedSchedules: number;
    totalOriginalCost: number;
    totalAccumulatedDepreciation: number;
    totalBookValue: number;
    pendingEntriesCount: number;
    thisMonthDepreciation: number;
    endingSoonCount: number;
}

// Monthly summary
export interface MonthlySummary {
    periodYear: number;
    periodMonth: number;
    totalDepreciation: number;
    assetCount: number;
}

// Pagination wrapper
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
