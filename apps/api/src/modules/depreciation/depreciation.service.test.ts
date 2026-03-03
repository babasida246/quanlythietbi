/**
 * Depreciation Module - Service Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DepreciationService } from './depreciation.service.js';
import { DepreciationRepository } from './depreciation.repository.js';
import {
    DepreciationSchedule,
    DepreciationScheduleWithDetails,
    DepreciationEntry,
    DepreciationEntryWithDetails,
    DepreciationRun,
    DepreciationSetting,
    CreateScheduleDto,
} from './depreciation.types.js';

// Mock repository
function createMockRepository() {
    return {
        createSchedule: vi.fn(),
        findScheduleById: vi.fn(),
        findScheduleByIdWithDetails: vi.fn(),
        findScheduleByAssetId: vi.fn(),
        updateSchedule: vi.fn(),
        stopSchedule: vi.fn(),
        updateScheduleStatus: vi.fn(),
        deleteSchedule: vi.fn(),
        findAllSchedules: vi.fn(),
        countSchedulesByStatus: vi.fn(),
        createEntry: vi.fn(),
        createEntries: vi.fn(),
        findEntryById: vi.fn(),
        findEntryByIdWithDetails: vi.fn(),
        findEntriesByScheduleId: vi.fn(),
        findEntriesByRunId: vi.fn(),
        findPendingEntries: vi.fn(),
        findLastPostedEntry: vi.fn(),
        hasUnpostedEntriesBefore: vi.fn(),
        postEntries: vi.fn(),
        findAllEntries: vi.fn(),
        deleteEntry: vi.fn(),
        createRun: vi.fn(),
        findRunById: vi.fn(),
        findRunByCode: vi.fn(),
        updateRunStatus: vi.fn(),
        findAllRuns: vi.fn(),
        hasRunForPeriod: vi.fn(),
        findSettingByKey: vi.fn(),
        findAllSettings: vi.fn(),
        updateSetting: vi.fn(),
        getActiveSchedulesForPeriod: vi.fn(),
        getMonthlySummary: vi.fn(),
        getDepreciationByCategory: vi.fn(),
        getDashboard: vi.fn(),
        withTransaction: vi.fn(),
    } as unknown as DepreciationRepository;
}

// Sample data
const sampleSchedule: DepreciationSchedule = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    assetId: '550e8400-e29b-41d4-a716-446655440002',
    depreciationMethod: 'straight_line',
    originalCost: 100000,
    salvageValue: 10000,
    usefulLifeYears: 5,
    startDate: '2024-01-01',
    endDate: '2028-12-31',
    status: 'active',
    accumulatedDepreciation: 0,
    stoppedAt: null,
    stoppedReason: null,
    notes: 'Standard depreciation for office equipment',
    organizationId: '550e8400-e29b-41d4-a716-446655440010',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    createdBy: '550e8400-e29b-41d4-a716-446655440020',
    updatedBy: null,
};

const sampleScheduleWithDetails: DepreciationScheduleWithDetails = {
    ...sampleSchedule,
    assetTag: 'LAP-001',
    assetName: 'Dell Latitude 5520',
    assetSerialNumber: 'ABC123',
    categoryId: '550e8400-e29b-41d4-a716-446655440030',
    categoryName: 'Laptop',
    currentBookValue: 100000,
    depreciationProgressPercent: 0,
    monthlyDepreciation: 1500,
    remainingMonths: 60,
};

const sampleEntry: DepreciationEntry = {
    id: '550e8400-e29b-41d4-a716-446655440040',
    scheduleId: sampleSchedule.id,
    runId: null,
    periodYear: 2024,
    periodMonth: 1,
    depreciationAmount: 1500,
    beginningBookValue: 100000,
    endingBookValue: 98500,
    isPosted: false,
    postedAt: null,
    postedBy: null,
    isAdjustment: false,
    adjustmentReason: null,
    createdAt: new Date('2024-01-31T10:00:00Z'),
    updatedAt: new Date('2024-01-31T10:00:00Z'),
    createdBy: '550e8400-e29b-41d4-a716-446655440020',
};

const sampleEntryWithDetails: DepreciationEntryWithDetails = {
    ...sampleEntry,
    assetId: sampleSchedule.assetId,
    assetTag: 'LAP-001',
    assetName: 'Dell Latitude 5520',
    runCode: null,
    postedByName: null,
};

const sampleRun: DepreciationRun = {
    id: '550e8400-e29b-41d4-a716-446655440050',
    runCode: 'DEP-2024-01-001',
    runType: 'monthly',
    periodYear: 2024,
    periodMonth: 1,
    status: 'completed',
    totalAssets: 10,
    totalAmount: 15000,
    errorMessage: null,
    completedAt: new Date('2024-01-31T12:00:00Z'),
    organizationId: '550e8400-e29b-41d4-a716-446655440010',
    createdAt: new Date('2024-01-31T10:00:00Z'),
    updatedAt: new Date('2024-01-31T12:00:00Z'),
    createdBy: '550e8400-e29b-41d4-a716-446655440020',
};

const sampleSetting: DepreciationSetting = {
    id: '550e8400-e29b-41d4-a716-446655440060',
    settingKey: 'default_method',
    settingValue: 'straight_line',
    description: 'Default depreciation method for new assets',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    updatedBy: null,
};

describe('DepreciationService', () => {
    let repository: ReturnType<typeof createMockRepository>;
    let service: DepreciationService;

    beforeEach(() => {
        repository = createMockRepository();
        service = new DepreciationService(repository as unknown as DepreciationRepository);
    });

    // ==================== Schedule Tests ====================

    describe('createSchedule', () => {
        it('should create a new schedule', async () => {
            repository.findScheduleByAssetId.mockResolvedValue(null);
            repository.createSchedule.mockResolvedValue(sampleSchedule);

            const dto: CreateScheduleDto = {
                assetId: sampleSchedule.assetId,
                depreciationMethod: 'straight_line',
                originalCost: 100000,
                salvageValue: 10000,
                usefulLifeYears: 5,
                startDate: '2024-01-01',
                notes: 'Standard depreciation',
                createdBy: sampleSchedule.createdBy,
            };

            const result = await service.createSchedule(dto);

            expect(result.success).toBe(true);
            expect(result.schedule).toBeDefined();
        });

        it('should reject if asset already has active schedule (DEP-R01)', async () => {
            repository.findScheduleByAssetId.mockResolvedValue(sampleSchedule);

            const dto: CreateScheduleDto = {
                assetId: sampleSchedule.assetId,
                depreciationMethod: 'straight_line',
                originalCost: 100000,
                salvageValue: 10000,
                usefulLifeYears: 5,
                startDate: '2024-01-01',
                createdBy: sampleSchedule.createdBy,
            };

            const result = await service.createSchedule(dto);

            expect(result.success).toBe(false);
            expect(result.error).toContain('already has an active');
        });

        it('should reject if salvage value exceeds original cost (DEP-R02)', async () => {
            repository.findScheduleByAssetId.mockResolvedValue(null);

            const dto: CreateScheduleDto = {
                assetId: sampleSchedule.assetId,
                depreciationMethod: 'straight_line',
                originalCost: 100000,
                salvageValue: 120000, // Greater than original cost
                usefulLifeYears: 5,
                startDate: '2024-01-01',
                createdBy: sampleSchedule.createdBy,
            };

            const result = await service.createSchedule(dto);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Salvage value must be less');
        });

        it('should allow if previous schedule is stopped', async () => {
            const stoppedSchedule = { ...sampleSchedule, status: 'stopped' as const };
            repository.findScheduleByAssetId.mockResolvedValue(stoppedSchedule);
            repository.createSchedule.mockResolvedValue(sampleSchedule);

            const dto: CreateScheduleDto = {
                assetId: sampleSchedule.assetId,
                depreciationMethod: 'straight_line',
                originalCost: 100000,
                salvageValue: 10000,
                usefulLifeYears: 5,
                startDate: '2024-01-01',
                createdBy: sampleSchedule.createdBy,
            };

            const result = await service.createSchedule(dto);

            expect(result.success).toBe(true);
        });
    });

    describe('getScheduleById', () => {
        it('should return schedule by ID', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);

            const result = await service.getScheduleById(sampleSchedule.id);

            expect(result).toBeDefined();
            expect(result?.id).toBe(sampleSchedule.id);
        });
    });

    describe('getScheduleDetail', () => {
        it('should return schedule with details', async () => {
            repository.findScheduleByIdWithDetails.mockResolvedValue(sampleScheduleWithDetails);

            const result = await service.getScheduleDetail(sampleSchedule.id);

            expect(result?.assetTag).toBe('LAP-001');
        });
    });

    describe('updateSchedule', () => {
        it('should update schedule notes', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);
            const updatedSchedule = { ...sampleSchedule, notes: 'Updated notes' };
            repository.updateSchedule.mockResolvedValue(updatedSchedule);

            const result = await service.updateSchedule(sampleSchedule.id, {
                notes: 'Updated notes',
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.schedule?.notes).toBe('Updated notes');
        });

        it('should return error if schedule not found', async () => {
            repository.findScheduleById.mockResolvedValue(null);

            const result = await service.updateSchedule('non-existent', {
                notes: 'Updated notes',
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('stopSchedule', () => {
        it('should stop active schedule (DEP-R07)', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);
            const stoppedSchedule = { ...sampleSchedule, status: 'stopped' as const };
            repository.stopSchedule.mockResolvedValue(stoppedSchedule);

            const result = await service.stopSchedule({
                scheduleId: sampleSchedule.id,
                stoppedAt: '2024-06-30',
                stoppedReason: 'Asset retired',
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.schedule?.status).toBe('stopped');
        });

        it('should reject if schedule not active', async () => {
            const stoppedSchedule = { ...sampleSchedule, status: 'stopped' as const };
            repository.findScheduleById.mockResolvedValue(stoppedSchedule);

            const result = await service.stopSchedule({
                scheduleId: sampleSchedule.id,
                stoppedAt: '2024-06-30',
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Only active');
        });
    });

    describe('deleteSchedule', () => {
        it('should delete schedule without posted entries', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);
            repository.findEntriesByScheduleId.mockResolvedValue([]);
            repository.deleteSchedule.mockResolvedValue(true);

            const result = await service.deleteSchedule(sampleSchedule.id);

            expect(result.success).toBe(true);
        });

        it('should reject if has posted entries', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);
            const postedEntry = { ...sampleEntry, isPosted: true };
            repository.findEntriesByScheduleId.mockResolvedValue([postedEntry]);

            const result = await service.deleteSchedule(sampleSchedule.id);

            expect(result.success).toBe(false);
            expect(result.error).toContain('posted entries');
        });
    });

    describe('listSchedules', () => {
        it('should return paginated schedules', async () => {
            repository.findAllSchedules.mockResolvedValue({
                data: [sampleScheduleWithDetails],
                total: 10,
            });

            const result = await service.listSchedules({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(10);
            expect(result.totalPages).toBe(1);
        });
    });

    describe('previewSchedule', () => {
        it('should generate straight-line preview', async () => {
            const result = await service.previewSchedule({
                originalCost: 120000,
                salvageValue: 12000,
                usefulLifeYears: 3,
                startDate: '2024-01-01',
                depreciationMethod: 'straight_line',
            });

            expect(result.depreciableAmount).toBe(108000);
            expect(result.entries.length).toBeGreaterThan(0);
            // Monthly depreciation should be 108000 / 36 = 3000
            expect(result.entries[0].depreciationAmount).toBe(3000);
        });

        it('should stop when book value reaches salvage value', async () => {
            const result = await service.previewSchedule({
                originalCost: 10000,
                salvageValue: 1000,
                usefulLifeYears: 1,
                startDate: '2024-01-01',
                depreciationMethod: 'straight_line',
            });

            const lastEntry = result.entries[result.entries.length - 1];
            expect(lastEntry.bookValue).toBeGreaterThanOrEqual(1000);
        });
    });

    // ==================== Entry Tests ====================

    describe('getEntryById', () => {
        it('should return entry by ID', async () => {
            repository.findEntryById.mockResolvedValue(sampleEntry);

            const result = await service.getEntryById(sampleEntry.id);

            expect(result?.periodYear).toBe(2024);
        });
    });

    describe('getEntriesByScheduleId', () => {
        it('should return entries for schedule', async () => {
            repository.findEntriesByScheduleId.mockResolvedValue([sampleEntry]);

            const result = await service.getEntriesByScheduleId(sampleSchedule.id);

            expect(result).toHaveLength(1);
        });
    });

    describe('listEntries', () => {
        it('should return paginated entries', async () => {
            repository.findAllEntries.mockResolvedValue({
                data: [sampleEntryWithDetails],
                total: 100,
            });

            const result = await service.listEntries({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.totalPages).toBe(5);
        });
    });

    describe('postEntries', () => {
        it('should post unposted entries', async () => {
            repository.findEntryById.mockResolvedValue(sampleEntry);
            repository.hasUnpostedEntriesBefore.mockResolvedValue(false);
            repository.postEntries.mockResolvedValue(1);

            const result = await service.postEntries({
                entryIds: [sampleEntry.id],
                postedBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.postedCount).toBe(1);
        });

        it('should reject already posted entry (DEP-R05)', async () => {
            const postedEntry = { ...sampleEntry, isPosted: true };
            repository.findEntryById.mockResolvedValue(postedEntry);

            const result = await service.postEntries({
                entryIds: [sampleEntry.id],
                postedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('already posted');
        });

        it('should reject if unposted entries exist before (DEP-R06)', async () => {
            repository.findEntryById.mockResolvedValue(sampleEntry);
            repository.hasUnpostedEntriesBefore.mockResolvedValue(true);

            const result = await service.postEntries({
                entryIds: [sampleEntry.id],
                postedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('unposted entries');
        });
    });

    describe('createAdjustment', () => {
        it('should create adjustment entry', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);
            repository.findLastPostedEntry.mockResolvedValue(null);
            repository.createEntry.mockResolvedValue({
                ...sampleEntry,
                isAdjustment: true,
                adjustmentReason: 'Correction',
            });

            const result = await service.createAdjustment({
                scheduleId: sampleSchedule.id,
                periodYear: 2024,
                periodMonth: 1,
                adjustmentAmount: 500,
                adjustmentReason: 'Correction',
                createdBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.entry?.isAdjustment).toBe(true);
        });

        it('should reject if would result in negative book value (DEP-R04)', async () => {
            repository.findScheduleById.mockResolvedValue(sampleSchedule);
            repository.findLastPostedEntry.mockResolvedValue({
                ...sampleEntry,
                endingBookValue: 15000, // Close to salvage value
            });

            const result = await service.createAdjustment({
                scheduleId: sampleSchedule.id,
                periodYear: 2024,
                periodMonth: 2,
                adjustmentAmount: 10000, // Would make book value 5000, below salvage of 10000
                adjustmentReason: 'Excessive adjustment',
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('below salvage');
        });

        it('should reject for non-active schedule', async () => {
            const stoppedSchedule = { ...sampleSchedule, status: 'stopped' as const };
            repository.findScheduleById.mockResolvedValue(stoppedSchedule);

            const result = await service.createAdjustment({
                scheduleId: sampleSchedule.id,
                periodYear: 2024,
                periodMonth: 1,
                adjustmentAmount: 500,
                adjustmentReason: 'Correction',
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('non-active');
        });
    });

    describe('deleteEntry', () => {
        it('should delete unposted entry', async () => {
            repository.findEntryById.mockResolvedValue(sampleEntry);
            repository.deleteEntry.mockResolvedValue(true);

            const result = await service.deleteEntry(sampleEntry.id);

            expect(result.success).toBe(true);
        });

        it('should reject deleting posted entry (DEP-R05)', async () => {
            const postedEntry = { ...sampleEntry, isPosted: true };
            repository.findEntryById.mockResolvedValue(postedEntry);

            const result = await service.deleteEntry(sampleEntry.id);

            expect(result.success).toBe(false);
            expect(result.error).toContain('posted entry');
        });
    });

    // ==================== Run Tests ====================

    describe('runDepreciation', () => {
        it('should run depreciation for period', async () => {
            repository.hasRunForPeriod.mockResolvedValue(false);
            repository.withTransaction.mockImplementation(async (callback) => {
                return callback({} as any);
            });
            repository.createRun.mockResolvedValue(sampleRun);
            repository.updateRunStatus.mockResolvedValue(sampleRun);
            repository.getActiveSchedulesForPeriod.mockResolvedValue([sampleScheduleWithDetails]);
            repository.findLastPostedEntry.mockResolvedValue(null);
            repository.createEntry.mockResolvedValue(sampleEntry);

            const result = await service.runDepreciation({
                periodYear: 2024,
                periodMonth: 1,
                createdBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.run).toBeDefined();
            expect(result.entriesCreated).toBeGreaterThanOrEqual(0);
        });

        it('should reject if run already exists for period', async () => {
            repository.hasRunForPeriod.mockResolvedValue(true);

            const result = await service.runDepreciation({
                periodYear: 2024,
                periodMonth: 1,
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('already exists');
        });

        it('should mark schedule as fully depreciated when complete', async () => {
            repository.hasRunForPeriod.mockResolvedValue(false);
            repository.withTransaction.mockImplementation(async (callback) => {
                return callback({} as any);
            });
            repository.createRun.mockResolvedValue(sampleRun);
            repository.updateRunStatus.mockResolvedValue(sampleRun);

            // Schedule near end of useful life
            const nearEndSchedule = {
                ...sampleScheduleWithDetails,
                accumulatedDepreciation: 89500, // Only 500 left
                currentBookValue: 10500,
            };
            repository.getActiveSchedulesForPeriod.mockResolvedValue([nearEndSchedule]);
            repository.findLastPostedEntry.mockResolvedValue({
                ...sampleEntry,
                endingBookValue: 10500,
            });
            repository.createEntry.mockResolvedValue({
                ...sampleEntry,
                endingBookValue: 10000, // At salvage value
            });
            repository.updateScheduleStatus.mockResolvedValue({
                ...sampleSchedule,
                status: 'fully_depreciated',
            });

            const result = await service.runDepreciation({
                periodYear: 2024,
                periodMonth: 12,
                createdBy: 'user-1',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('getRunById', () => {
        it('should return run by ID', async () => {
            repository.findRunById.mockResolvedValue(sampleRun);

            const result = await service.getRunById(sampleRun.id);

            expect(result?.runCode).toBe('DEP-2024-01-001');
        });
    });

    describe('listRuns', () => {
        it('should return paginated runs', async () => {
            repository.findAllRuns.mockResolvedValue({
                data: [sampleRun],
                total: 12,
            });

            const result = await service.listRuns({ page: 1, limit: 10 });

            expect(result.data).toHaveLength(1);
            expect(result.totalPages).toBe(2);
        });
    });

    // ==================== Settings Tests ====================

    describe('getSettings', () => {
        it('should return all settings', async () => {
            repository.findAllSettings.mockResolvedValue([sampleSetting]);

            const result = await service.getSettings();

            expect(result).toHaveLength(1);
        });
    });

    describe('getSetting', () => {
        it('should return setting by key', async () => {
            repository.findSettingByKey.mockResolvedValue(sampleSetting);

            const result = await service.getSetting('default_method');

            expect(result?.settingValue).toBe('straight_line');
        });
    });

    describe('updateSetting', () => {
        it('should update setting value', async () => {
            const updatedSetting = { ...sampleSetting, settingValue: 'declining_balance' };
            repository.updateSetting.mockResolvedValue(updatedSetting);

            const result = await service.updateSetting('default_method', 'declining_balance', 'user-1');

            expect(result?.settingValue).toBe('declining_balance');
        });
    });

    // ==================== Dashboard / Statistics Tests ====================

    describe('getDashboard', () => {
        it('should return dashboard statistics', async () => {
            repository.getDashboard.mockResolvedValue({
                activeSchedules: 10,
                fullyDepreciated: 5,
                stoppedSchedules: 2,
                totalOriginalCost: 1000000,
                totalAccumulatedDepreciation: 400000,
                totalBookValue: 500000,
                pendingEntriesCount: 5,
                thisMonthDepreciation: 15000,
                endingSoonCount: 3,
            });

            const result = await service.getDashboard();

            expect(result.activeSchedules).toBe(10);
            expect(result.totalOriginalCost).toBe(1000000);
        });
    });

    describe('getMonthlySummary', () => {
        it('should return monthly summary', async () => {
            repository.getMonthlySummary.mockResolvedValue([
                { periodYear: 2024, periodMonth: 1, totalDepreciation: 15000, assetCount: 10 },
            ]);

            const result = await service.getMonthlySummary(2024);

            expect(result).toHaveLength(1);
        });
    });

    describe('getDepreciationByCategory', () => {
        it('should return depreciation by category', async () => {
            repository.getDepreciationByCategory.mockResolvedValue([
                {
                    categoryId: 'cat-1',
                    categoryName: 'Laptop',
                    assetCount: 10,
                    totalOriginalCost: 1000000,
                    totalCurrentBookValue: 500000,
                    totalDepreciatedAmount: 500000,
                },
            ]);

            const result = await service.getDepreciationByCategory();

            expect(result).toHaveLength(1);
            expect(result[0].categoryName).toBe('Laptop');
        });
    });
});
