/**
 * Depreciation Module - Service Layer
 * Module: 09-DEPRECIATION (Asset Depreciation Management)
 */

import { DepreciationRepository } from './depreciation.repository.js';
import {
    DepreciationSchedule,
    DepreciationScheduleWithDetails,
    DepreciationEntry,
    DepreciationEntryWithDetails,
    DepreciationRun,
    DepreciationSetting,
    CreateScheduleDto,
    UpdateScheduleDto,
    StopScheduleDto,
    RunDepreciationDto,
    PostEntriesDto,
    CreateAdjustmentDto,
    ScheduleListQuery,
    EntryListQuery,
    RunListQuery,
    ScheduleResult,
    EntryResult,
    RunResult,
    PostResult,
    SchedulePreview,
    DepreciationMethod,
    PaginatedResult,
    DepreciationDashboard,
    MonthlySummary,
} from './depreciation.types.js';

export class DepreciationService {
    constructor(private repository: DepreciationRepository) { }

    // ==================== Schedule Operations ====================

    async createSchedule(dto: CreateScheduleDto): Promise<ScheduleResult> {
        try {
            // DEP-R01: One schedule per asset - check if asset already has active schedule
            const existingSchedule = await this.repository.findScheduleByAssetId(dto.assetId);
            if (existingSchedule && existingSchedule.status === 'active') {
                return {
                    success: false,
                    error: 'Asset already has an active depreciation schedule',
                };
            }

            // DEP-R02: Salvage value must be less than or equal to original cost
            if (dto.salvageValue !== undefined && dto.salvageValue > dto.originalCost) {
                return {
                    success: false,
                    error: 'Salvage value must be less than or equal to original cost',
                };
            }

            // DEP-R03: Warn if start date is in the distant past (more than 1 year ago)
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const startDate = new Date(dto.startDate);
            if (startDate < oneYearAgo) {
                console.warn(`Start date ${dto.startDate} is more than 1 year in the past`);
            }

            const schedule = await this.repository.createSchedule(dto);
            return {
                success: true,
                schedule,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create schedule',
            };
        }
    }

    async getScheduleById(id: string): Promise<DepreciationSchedule | null> {
        return this.repository.findScheduleById(id);
    }

    async getScheduleDetail(id: string): Promise<DepreciationScheduleWithDetails | null> {
        return this.repository.findScheduleByIdWithDetails(id);
    }

    async getScheduleByAssetId(assetId: string): Promise<DepreciationSchedule | null> {
        return this.repository.findScheduleByAssetId(assetId);
    }

    async updateSchedule(id: string, dto: UpdateScheduleDto): Promise<ScheduleResult> {
        try {
            const existing = await this.repository.findScheduleById(id);
            if (!existing) {
                return {
                    success: false,
                    error: 'Depreciation schedule not found',
                };
            }

            // Only notes can be updated on existing schedules
            const updated = await this.repository.updateSchedule(id, dto);
            return {
                success: true,
                schedule: updated!,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update schedule',
            };
        }
    }

    async stopSchedule(dto: StopScheduleDto): Promise<ScheduleResult> {
        try {
            const schedule = await this.repository.findScheduleById(dto.scheduleId);
            if (!schedule) {
                return {
                    success: false,
                    error: 'Depreciation schedule not found',
                };
            }

            if (schedule.status !== 'active') {
                return {
                    success: false,
                    error: 'Only active schedules can be stopped',
                };
            }

            // DEP-R07: Asset retired → stop depreciation
            const stopped = await this.repository.stopSchedule(
                dto.scheduleId,
                dto.stoppedAt,
                dto.stoppedReason,
                dto.updatedBy
            );

            return {
                success: true,
                schedule: stopped!,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to stop schedule',
            };
        }
    }

    async deleteSchedule(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const schedule = await this.repository.findScheduleById(id);
            if (!schedule) {
                return {
                    success: false,
                    error: 'Depreciation schedule not found',
                };
            }

            // Check if there are posted entries
            const entries = await this.repository.findEntriesByScheduleId(id);
            const hasPostedEntries = entries.some((e) => e.isPosted);
            if (hasPostedEntries) {
                return {
                    success: false,
                    error: 'Cannot delete schedule with posted entries',
                };
            }

            const deleted = await this.repository.deleteSchedule(id);
            return { success: deleted };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete schedule',
            };
        }
    }

    async listSchedules(
        query: ScheduleListQuery
    ): Promise<PaginatedResult<DepreciationScheduleWithDetails>> {
        const result = await this.repository.findAllSchedules(query);
        return {
            data: result.data,
            total: result.total,
            page: query.page || 1,
            limit: query.limit || 20,
            totalPages: Math.ceil(result.total / (query.limit || 20)),
        };
    }

    async previewSchedule(params: {
        originalCost: number;
        salvageValue: number;
        usefulLifeYears: number;
        startDate: string;
        depreciationMethod: DepreciationMethod;
    }): Promise<SchedulePreview> {
        const { originalCost, salvageValue, usefulLifeYears, startDate, depreciationMethod } = params;

        const depreciableAmount = originalCost - salvageValue;
        const entries: Array<{
            periodYear: number;
            periodMonth: number;
            depreciationAmount: number;
            accumulatedDepreciation: number;
            bookValue: number;
        }> = [];

        const start = new Date(startDate);
        const totalMonths = usefulLifeYears * 12;

        let accumulatedDepreciation = 0;
        let bookValue = originalCost;

        for (let i = 0; i < totalMonths; i++) {
            const entryDate = new Date(start);
            entryDate.setMonth(entryDate.getMonth() + i);

            let depreciationAmount: number;

            switch (depreciationMethod) {
                case 'straight_line':
                    depreciationAmount = depreciableAmount / totalMonths;
                    break;
                case 'declining_balance': {
                    const rate = 1 / usefulLifeYears;
                    depreciationAmount = Math.max(0, (bookValue - salvageValue) * rate / 12);
                    break;
                }
                case 'double_declining': {
                    const doubleRate = 2 / usefulLifeYears;
                    depreciationAmount = Math.max(0, bookValue * doubleRate / 12);
                    break;
                }
                case 'sum_of_years': {
                    const totalYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
                    const yearNum = Math.floor(i / 12) + 1;
                    const remainingYears = usefulLifeYears - yearNum + 1;
                    depreciationAmount = (depreciableAmount * remainingYears / totalYears) / 12;
                    break;
                }
                case 'units_of_production':
                    // Units of production requires actual usage data, so estimate straight-line
                    depreciationAmount = depreciableAmount / totalMonths;
                    break;
                default:
                    depreciationAmount = depreciableAmount / totalMonths;
            }

            // DEP-R04: No negative book value
            if (bookValue - depreciationAmount < salvageValue) {
                depreciationAmount = bookValue - salvageValue;
            }
            if (depreciationAmount < 0) depreciationAmount = 0;

            accumulatedDepreciation += depreciationAmount;
            bookValue -= depreciationAmount;

            entries.push({
                periodYear: entryDate.getFullYear(),
                periodMonth: entryDate.getMonth() + 1,
                depreciationAmount: Math.round(depreciationAmount * 100) / 100,
                accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
                bookValue: Math.round(bookValue * 100) / 100,
            });

            // Stop if fully depreciated
            if (bookValue <= salvageValue) break;
        }

        return {
            originalCost,
            salvageValue,
            depreciableAmount,
            usefulLifeYears,
            totalMonths: entries.length,
            monthlyDepreciation: entries.length > 0
                ? Math.round((depreciableAmount / entries.length) * 100) / 100
                : 0,
            entries,
        };
    }

    // ==================== Entry Operations ====================

    async getEntryById(id: string): Promise<DepreciationEntry | null> {
        return this.repository.findEntryById(id);
    }

    async getEntryDetail(id: string): Promise<DepreciationEntryWithDetails | null> {
        return this.repository.findEntryByIdWithDetails(id);
    }

    async getEntriesByScheduleId(scheduleId: string): Promise<DepreciationEntry[]> {
        return this.repository.findEntriesByScheduleId(scheduleId);
    }

    async listEntries(
        query: EntryListQuery
    ): Promise<PaginatedResult<DepreciationEntryWithDetails>> {
        const result = await this.repository.findAllEntries(query);
        return {
            data: result.data,
            total: result.total,
            page: query.page || 1,
            limit: query.limit || 20,
            totalPages: Math.ceil(result.total / (query.limit || 20)),
        };
    }

    async getPendingEntries(
        periodYear?: number,
        periodMonth?: number,
        organizationId?: string
    ): Promise<DepreciationEntryWithDetails[]> {
        return this.repository.findPendingEntries(periodYear, periodMonth, organizationId);
    }

    async postEntries(dto: PostEntriesDto): Promise<PostResult> {
        try {
            // DEP-R06: Sequential posting - check each entry for unposted predecessors
            for (const entryId of dto.entryIds) {
                const entry = await this.repository.findEntryById(entryId);
                if (!entry) {
                    return {
                        success: false,
                        error: `Entry ${entryId} not found`,
                        postedCount: 0,
                    };
                }

                // DEP-R05: Posted entries cannot be modified
                if (entry.isPosted) {
                    return {
                        success: false,
                        error: `Entry ${entryId} is already posted`,
                        postedCount: 0,
                    };
                }

                const hasUnpostedBefore = await this.repository.hasUnpostedEntriesBefore(
                    entry.scheduleId,
                    entry.periodYear,
                    entry.periodMonth
                );

                if (hasUnpostedBefore) {
                    return {
                        success: false,
                        error: `Cannot post entry for ${entry.periodYear}/${entry.periodMonth} - there are unposted entries from earlier periods`,
                        postedCount: 0,
                    };
                }
            }

            const postedCount = await this.repository.postEntries(dto.entryIds, dto.postedBy);

            return {
                success: true,
                postedCount,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to post entries',
                postedCount: 0,
            };
        }
    }

    async createAdjustment(dto: CreateAdjustmentDto): Promise<EntryResult> {
        try {
            const schedule = await this.repository.findScheduleById(dto.scheduleId);
            if (!schedule) {
                return {
                    success: false,
                    error: 'Depreciation schedule not found',
                };
            }

            if (schedule.status !== 'active') {
                return {
                    success: false,
                    error: 'Cannot create adjustment for non-active schedule',
                };
            }

            // Calculate book values for the adjustment
            const lastPosted = await this.repository.findLastPostedEntry(dto.scheduleId);
            const beginningBookValue = lastPosted
                ? lastPosted.endingBookValue
                : schedule.originalCost;
            const endingBookValue = beginningBookValue - dto.adjustmentAmount;

            // DEP-R04: No negative book value
            if (endingBookValue < schedule.salvageValue) {
                return {
                    success: false,
                    error: 'Adjustment would result in book value below salvage value',
                };
            }

            const entry = await this.repository.createEntry({
                scheduleId: dto.scheduleId,
                periodYear: dto.periodYear,
                periodMonth: dto.periodMonth,
                depreciationAmount: dto.adjustmentAmount,
                beginningBookValue,
                endingBookValue,
                isAdjustment: true,
                adjustmentReason: dto.adjustmentReason,
                createdBy: dto.createdBy,
            });

            return {
                success: true,
                entry,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create adjustment',
            };
        }
    }

    async deleteEntry(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const entry = await this.repository.findEntryById(id);
            if (!entry) {
                return {
                    success: false,
                    error: 'Depreciation entry not found',
                };
            }

            // DEP-R05: Posted entries cannot be deleted
            if (entry.isPosted) {
                return {
                    success: false,
                    error: 'Cannot delete posted entry',
                };
            }

            const deleted = await this.repository.deleteEntry(id);
            return { success: deleted };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete entry',
            };
        }
    }

    // ==================== Run Operations ====================

    async runDepreciation(dto: RunDepreciationDto): Promise<RunResult> {
        try {
            // Check if run already exists for this period
            const hasRun = await this.repository.hasRunForPeriod(
                dto.periodYear,
                dto.periodMonth,
                dto.organizationId
            );
            if (hasRun) {
                return {
                    success: false,
                    error: `Depreciation run already exists for ${dto.periodYear}/${dto.periodMonth}`,
                };
            }

            return await this.repository.withTransaction(async (client) => {
                // Create the run
                const run = await this.repository.createRun(
                    'monthly',
                    dto.periodYear,
                    dto.periodMonth,
                    dto.organizationId,
                    dto.createdBy,
                    client
                );

                // Update status to processing
                await this.repository.updateRunStatus(run.id, 'processing', undefined, client);

                // Get active schedules for this period
                const schedules = await this.repository.getActiveSchedulesForPeriod(
                    dto.periodYear,
                    dto.periodMonth,
                    dto.organizationId
                );

                let totalAmount = 0;
                const entries = [];

                for (const schedule of schedules) {
                    // Calculate depreciation for this period
                    const depreciationAmount = this.calculateMonthlyDepreciation(schedule);

                    // Get current book value from last posted entry or original cost
                    const lastPosted = await this.repository.findLastPostedEntry(schedule.id);
                    const beginningBookValue = lastPosted
                        ? lastPosted.endingBookValue
                        : schedule.originalCost;

                    let actualDepreciation = depreciationAmount;

                    // DEP-R04: No negative book value
                    if (beginningBookValue - depreciationAmount < schedule.salvageValue) {
                        actualDepreciation = beginningBookValue - schedule.salvageValue;
                    }
                    if (actualDepreciation < 0) actualDepreciation = 0;

                    const endingBookValue = beginningBookValue - actualDepreciation;

                    if (actualDepreciation > 0) {
                        const entry = await this.repository.createEntry(
                            {
                                scheduleId: schedule.id,
                                runId: run.id,
                                periodYear: dto.periodYear,
                                periodMonth: dto.periodMonth,
                                depreciationAmount: actualDepreciation,
                                beginningBookValue,
                                endingBookValue,
                                isAdjustment: false,
                                createdBy: dto.createdBy,
                            },
                            client
                        );
                        entries.push(entry);
                        totalAmount += actualDepreciation;

                        // Check if fully depreciated
                        if (endingBookValue <= schedule.salvageValue) {
                            await this.repository.updateScheduleStatus(
                                schedule.id,
                                'fully_depreciated',
                                client
                            );
                        }
                    }
                }

                // Update run with results
                const completedRun = await this.repository.updateRunStatus(
                    run.id,
                    'completed',
                    {
                        totalAssets: entries.length,
                        totalAmount,
                        completedAt: new Date(),
                    },
                    client
                );

                return {
                    success: true,
                    run: completedRun!,
                    entriesCreated: entries.length,
                    totalAmount,
                };
            });
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to run depreciation',
            };
        }
    }

    async getRunById(id: string): Promise<DepreciationRun | null> {
        return this.repository.findRunById(id);
    }

    async getRunByCode(code: string): Promise<DepreciationRun | null> {
        return this.repository.findRunByCode(code);
    }

    async listRuns(query: RunListQuery): Promise<PaginatedResult<DepreciationRun>> {
        const result = await this.repository.findAllRuns(query);
        return {
            data: result.data,
            total: result.total,
            page: query.page || 1,
            limit: query.limit || 20,
            totalPages: Math.ceil(result.total / (query.limit || 20)),
        };
    }

    async getEntriesByRunId(runId: string): Promise<DepreciationEntry[]> {
        return this.repository.findEntriesByRunId(runId);
    }

    // ==================== Settings Operations ====================

    async getSettings(): Promise<DepreciationSetting[]> {
        return this.repository.findAllSettings();
    }

    async getSetting(key: string): Promise<DepreciationSetting | null> {
        return this.repository.findSettingByKey(key);
    }

    async updateSetting(
        key: string,
        value: string,
        updatedBy: string
    ): Promise<DepreciationSetting | null> {
        return this.repository.updateSetting(key, value, updatedBy);
    }

    // ==================== Dashboard / Statistics ====================

    async getDashboard(organizationId?: string): Promise<DepreciationDashboard> {
        return this.repository.getDashboard(organizationId);
    }

    async getMonthlySummary(year: number, organizationId?: string): Promise<MonthlySummary[]> {
        return this.repository.getMonthlySummary(year, organizationId);
    }

    async getDepreciationByCategory(organizationId?: string): Promise<Array<{
        categoryId: string;
        categoryName: string;
        assetCount: number;
        totalOriginalCost: number;
        totalCurrentBookValue: number;
        totalDepreciatedAmount: number;
    }>> {
        return this.repository.getDepreciationByCategory(organizationId);
    }

    // ==================== Helper Methods ====================

    private calculateMonthlyDepreciation(schedule: DepreciationScheduleWithDetails): number {
        const { originalCost, salvageValue, usefulLifeYears, depreciationMethod } = schedule;
        const depreciableAmount = originalCost - salvageValue;
        const totalMonths = usefulLifeYears * 12;

        const currentBookValue = schedule.currentBookValue ?? (originalCost - (schedule.accumulatedDepreciation || 0));

        switch (depreciationMethod) {
            case 'straight_line':
                return depreciableAmount / totalMonths;

            case 'declining_balance': {
                const rate = 1 / usefulLifeYears;
                return (currentBookValue - salvageValue) * rate / 12;
            }

            case 'double_declining': {
                const doubleRate = 2 / usefulLifeYears;
                return currentBookValue * doubleRate / 12;
            }

            case 'sum_of_years': {
                const totalYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2;
                // Calculate current year based on elapsed depreciation
                const elapsedAmount = schedule.accumulatedDepreciation || 0;
                const yearNum = Math.min(
                    Math.floor(elapsedAmount / (depreciableAmount / usefulLifeYears)) + 1,
                    usefulLifeYears
                );
                const remainingYears = usefulLifeYears - yearNum + 1;
                return (depreciableAmount * remainingYears / totalYears) / 12;
            }

            case 'units_of_production':
                // Default to straight-line if no usage data
                return depreciableAmount / totalMonths;

            default:
                return depreciableAmount / totalMonths;
        }
    }
}
