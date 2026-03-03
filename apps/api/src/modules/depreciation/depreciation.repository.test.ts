/**
 * Depreciation Module - Repository Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DepreciationRepository } from './depreciation.repository.js';
import { Pool, PoolClient, QueryResult } from 'pg';

// Mock Pool and PoolClient
function createMockPool() {
    const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
    };

    return {
        query: vi.fn(),
        connect: vi.fn().mockResolvedValue(mockClient),
        mockClient,
    };
}

// Sample data
const sampleSchedule = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    asset_id: '550e8400-e29b-41d4-a716-446655440002',
    depreciation_method: 'straight_line',
    original_cost: 100000,
    salvage_value: 10000,
    useful_life_years: 5,
    start_date: '2024-01-01',
    end_date: '2028-12-31',
    status: 'active',
    accumulated_depreciation: 0,
    stopped_at: null,
    stopped_reason: null,
    notes: 'Standard depreciation for office equipment',
    organization_id: '550e8400-e29b-41d4-a716-446655440010',
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    created_by: '550e8400-e29b-41d4-a716-446655440020',
    updated_by: null,
};

const sampleScheduleWithDetails = {
    ...sampleSchedule,
    asset_tag: 'LAP-001',
    asset_name: 'Dell Latitude 5520',
    asset_serial_number: 'ABC123',
    category_id: '550e8400-e29b-41d4-a716-446655440030',
    category_name: 'Laptop',
    current_book_value: 100000,
    depreciation_progress_percent: 0,
    monthly_depreciation: 1500,
    remaining_months: 60,
};

const sampleEntry = {
    id: '550e8400-e29b-41d4-a716-446655440040',
    schedule_id: sampleSchedule.id,
    run_id: null,
    period_year: 2024,
    period_month: 1,
    depreciation_amount: 1500,
    beginning_book_value: 100000,
    ending_book_value: 98500,
    is_posted: false,
    posted_at: null,
    posted_by: null,
    is_adjustment: false,
    adjustment_reason: null,
    created_at: new Date('2024-01-31T10:00:00Z'),
    updated_at: new Date('2024-01-31T10:00:00Z'),
    created_by: '550e8400-e29b-41d4-a716-446655440020',
};

const sampleEntryWithDetails = {
    ...sampleEntry,
    asset_id: sampleSchedule.asset_id,
    asset_tag: 'LAP-001',
    asset_name: 'Dell Latitude 5520',
    run_code: null,
    posted_by_name: null,
};

const sampleRun = {
    id: '550e8400-e29b-41d4-a716-446655440050',
    run_code: 'DEP-2024-01-001',
    run_type: 'monthly',
    period_year: 2024,
    period_month: 1,
    status: 'completed',
    total_assets: 10,
    total_amount: 15000,
    error_message: null,
    completed_at: new Date('2024-01-31T12:00:00Z'),
    organization_id: '550e8400-e29b-41d4-a716-446655440010',
    created_at: new Date('2024-01-31T10:00:00Z'),
    updated_at: new Date('2024-01-31T12:00:00Z'),
    created_by: '550e8400-e29b-41d4-a716-446655440020',
};

const sampleSetting = {
    id: '550e8400-e29b-41d4-a716-446655440060',
    setting_key: 'default_method',
    setting_value: 'straight_line',
    description: 'Default depreciation method for new assets',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
    updated_by: null,
};

describe('DepreciationRepository', () => {
    let pool: ReturnType<typeof createMockPool>;
    let repository: DepreciationRepository;

    beforeEach(() => {
        pool = createMockPool();
        repository = new DepreciationRepository(pool as unknown as Pool);
    });

    // ==================== Schedule Tests ====================

    describe('createSchedule', () => {
        it('should create a new depreciation schedule', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleSchedule],
                rowCount: 1,
            });

            const result = await repository.createSchedule({
                assetId: sampleSchedule.asset_id,
                depreciationMethod: 'straight_line',
                originalCost: 100000,
                salvageValue: 10000,
                usefulLifeYears: 5,
                startDate: '2024-01-01',
                notes: 'Standard depreciation for office equipment',
                organizationId: sampleSchedule.organization_id,
                createdBy: sampleSchedule.created_by,
            });

            expect(result.id).toBe(sampleSchedule.id);
            expect(result.originalCost).toBe(100000);
            expect(result.depreciationMethod).toBe('straight_line');
        });
    });

    describe('findScheduleById', () => {
        it('should find schedule by ID', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleSchedule],
                rowCount: 1,
            });

            const result = await repository.findScheduleById(sampleSchedule.id);

            expect(result).toBeDefined();
            expect(result?.id).toBe(sampleSchedule.id);
        });

        it('should return null when not found', async () => {
            pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

            const result = await repository.findScheduleById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findScheduleByIdWithDetails', () => {
        it('should find schedule with full details', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleScheduleWithDetails],
                rowCount: 1,
            });

            const result = await repository.findScheduleByIdWithDetails(sampleSchedule.id);

            expect(result).toBeDefined();
            expect(result?.assetTag).toBe('LAP-001');
            expect(result?.categoryName).toBe('Laptop');
        });
    });

    describe('findScheduleByAssetId', () => {
        it('should find schedule by asset ID', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleSchedule],
                rowCount: 1,
            });

            const result = await repository.findScheduleByAssetId(sampleSchedule.asset_id);

            expect(result?.assetId).toBe(sampleSchedule.asset_id);
        });
    });

    describe('updateSchedule', () => {
        it('should update schedule notes', async () => {
            const updatedSchedule = { ...sampleSchedule, notes: 'Updated notes' };
            pool.query.mockResolvedValue({
                rows: [updatedSchedule],
                rowCount: 1,
            });

            const result = await repository.updateSchedule(sampleSchedule.id, {
                notes: 'Updated notes',
                updatedBy: 'user-1',
            });

            expect(result?.notes).toBe('Updated notes');
        });

        it('should return existing when no updates', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleSchedule],
                rowCount: 1,
            });

            const result = await repository.updateSchedule(sampleSchedule.id, {
                updatedBy: 'user-1',
            });

            expect(result).toBeDefined();
        });
    });

    describe('stopSchedule', () => {
        it('should stop active schedule', async () => {
            const stoppedSchedule = {
                ...sampleSchedule,
                status: 'stopped',
                stopped_at: '2024-06-30',
                stopped_reason: 'Asset retired',
            };
            pool.query.mockResolvedValue({
                rows: [stoppedSchedule],
                rowCount: 1,
            });

            const result = await repository.stopSchedule(
                sampleSchedule.id,
                '2024-06-30',
                'Asset retired',
                'user-1'
            );

            expect(result?.status).toBe('stopped');
            expect(result?.stoppedReason).toBe('Asset retired');
        });
    });

    describe('updateScheduleStatus', () => {
        it('should update schedule status', async () => {
            const updatedSchedule = { ...sampleSchedule, status: 'fully_depreciated' };
            pool.query.mockResolvedValue({
                rows: [updatedSchedule],
                rowCount: 1,
            });

            const result = await repository.updateScheduleStatus(sampleSchedule.id, 'fully_depreciated');

            expect(result?.status).toBe('fully_depreciated');
        });
    });

    describe('deleteSchedule', () => {
        it('should delete schedule', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 });

            const result = await repository.deleteSchedule(sampleSchedule.id);

            expect(result).toBe(true);
        });

        it('should return false when not found', async () => {
            pool.query.mockResolvedValue({ rowCount: 0 });

            const result = await repository.deleteSchedule('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('findAllSchedules', () => {
        it('should return paginated schedules', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '10' }] })
                .mockResolvedValueOnce({ rows: [sampleScheduleWithDetails] });

            const result = await repository.findAllSchedules({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(10);
        });

        it('should filter by status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [sampleScheduleWithDetails] });

            const result = await repository.findAllSchedules({ status: 'active' });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('status = $'),
                expect.arrayContaining(['active'])
            );
        });

        it('should filter by method', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                .mockResolvedValueOnce({ rows: [sampleScheduleWithDetails] });

            const result = await repository.findAllSchedules({ method: 'straight_line' });

            expect(result.data).toHaveLength(1);
        });

        it('should search by asset name or tag', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [sampleScheduleWithDetails] });

            const result = await repository.findAllSchedules({ search: 'Dell' });

            expect(result.data).toHaveLength(1);
        });

        it('should filter by ending soon', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '2' }] })
                .mockResolvedValueOnce({ rows: [sampleScheduleWithDetails] });

            const result = await repository.findAllSchedules({ endingSoon: true });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining("end_date <= CURRENT_DATE + INTERVAL '90 days'"),
                expect.any(Array)
            );
        });
    });

    describe('countSchedulesByStatus', () => {
        it('should return counts by status', async () => {
            pool.query.mockResolvedValue({
                rows: [
                    { status: 'active', count: '10' },
                    { status: 'fully_depreciated', count: '5' },
                    { status: 'stopped', count: '2' },
                ],
            });

            const result = await repository.countSchedulesByStatus();

            expect(result.active).toBe(10);
            expect(result.fully_depreciated).toBe(5);
            expect(result.stopped).toBe(2);
        });
    });

    // ==================== Entry Tests ====================

    describe('createEntry', () => {
        it('should create a new entry', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleEntry],
                rowCount: 1,
            });

            const result = await repository.createEntry({
                scheduleId: sampleEntry.schedule_id,
                periodYear: 2024,
                periodMonth: 1,
                depreciationAmount: 1500,
                beginningBookValue: 100000,
                endingBookValue: 98500,
                createdBy: sampleEntry.created_by,
            });

            expect(result.id).toBe(sampleEntry.id);
            expect(result.depreciationAmount).toBe(1500);
        });
    });

    describe('createEntries', () => {
        it('should create multiple entries', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [sampleEntry], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ ...sampleEntry, id: 'entry-2', period_month: 2 }], rowCount: 1 });

            const result = await repository.createEntries([
                {
                    scheduleId: sampleEntry.schedule_id,
                    periodYear: 2024,
                    periodMonth: 1,
                    depreciationAmount: 1500,
                    beginningBookValue: 100000,
                    endingBookValue: 98500,
                    createdBy: sampleEntry.created_by,
                },
                {
                    scheduleId: sampleEntry.schedule_id,
                    periodYear: 2024,
                    periodMonth: 2,
                    depreciationAmount: 1500,
                    beginningBookValue: 98500,
                    endingBookValue: 97000,
                    createdBy: sampleEntry.created_by,
                },
            ]);

            expect(result).toHaveLength(2);
        });
    });

    describe('findEntryById', () => {
        it('should find entry by ID', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleEntry],
                rowCount: 1,
            });

            const result = await repository.findEntryById(sampleEntry.id);

            expect(result).toBeDefined();
            expect(result?.periodYear).toBe(2024);
        });
    });

    describe('findEntryByIdWithDetails', () => {
        it('should find entry with details', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleEntryWithDetails],
                rowCount: 1,
            });

            const result = await repository.findEntryByIdWithDetails(sampleEntry.id);

            expect(result?.assetTag).toBe('LAP-001');
        });
    });

    describe('findEntriesByScheduleId', () => {
        it('should find entries for schedule', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleEntry],
            });

            const result = await repository.findEntriesByScheduleId(sampleSchedule.id);

            expect(result).toHaveLength(1);
        });
    });

    describe('findEntriesByRunId', () => {
        it('should find entries for run', async () => {
            const entryWithRun = { ...sampleEntry, run_id: sampleRun.id };
            pool.query.mockResolvedValue({
                rows: [entryWithRun],
            });

            const result = await repository.findEntriesByRunId(sampleRun.id);

            expect(result).toHaveLength(1);
        });
    });

    describe('findPendingEntries', () => {
        it('should find unposted entries', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleEntryWithDetails],
            });

            const result = await repository.findPendingEntries(2024, 1);

            expect(result).toHaveLength(1);
        });
    });

    describe('findLastPostedEntry', () => {
        it('should find last posted entry', async () => {
            const postedEntry = { ...sampleEntry, is_posted: true, posted_at: new Date() };
            pool.query.mockResolvedValue({
                rows: [postedEntry],
            });

            const result = await repository.findLastPostedEntry(sampleSchedule.id);

            expect(result?.isPosted).toBe(true);
        });

        it('should return null if no posted entries', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            const result = await repository.findLastPostedEntry(sampleSchedule.id);

            expect(result).toBeNull();
        });
    });

    describe('hasUnpostedEntriesBefore', () => {
        it('should return true if unposted entries exist before period', async () => {
            pool.query.mockResolvedValue({ rows: [{ 1: 1 }] });

            const result = await repository.hasUnpostedEntriesBefore(sampleSchedule.id, 2024, 3);

            expect(result).toBe(true);
        });

        it('should return false if no unposted entries before period', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            const result = await repository.hasUnpostedEntriesBefore(sampleSchedule.id, 2024, 1);

            expect(result).toBe(false);
        });
    });

    describe('postEntries', () => {
        it('should post entries', async () => {
            pool.query.mockResolvedValue({ rowCount: 2 });

            const result = await repository.postEntries(['entry-1', 'entry-2'], 'user-1');

            expect(result).toBe(2);
        });
    });

    describe('findAllEntries', () => {
        it('should return paginated entries', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '100' }] })
                .mockResolvedValueOnce({ rows: [sampleEntryWithDetails] });

            const result = await repository.findAllEntries({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(100);
        });

        it('should filter by schedule', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '12' }] })
                .mockResolvedValueOnce({ rows: [sampleEntryWithDetails] });

            await repository.findAllEntries({ scheduleId: sampleSchedule.id });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('e.schedule_id = $'),
                expect.arrayContaining([sampleSchedule.id])
            );
        });

        it('should filter by posted status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [sampleEntryWithDetails] });

            await repository.findAllEntries({ isPosted: false });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('e.is_posted = $'),
                expect.arrayContaining([false])
            );
        });
    });

    describe('deleteEntry', () => {
        it('should delete unposted entry', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 });

            const result = await repository.deleteEntry(sampleEntry.id);

            expect(result).toBe(true);
        });
    });

    // ==================== Run Tests ====================

    describe('createRun', () => {
        it('should create a new run', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleRun],
                rowCount: 1,
            });

            const result = await repository.createRun(
                'monthly',
                2024,
                1,
                sampleRun.organization_id,
                sampleRun.created_by
            );

            expect(result.id).toBe(sampleRun.id);
            expect(result.runType).toBe('monthly');
        });
    });

    describe('findRunById', () => {
        it('should find run by ID', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleRun],
                rowCount: 1,
            });

            const result = await repository.findRunById(sampleRun.id);

            expect(result).toBeDefined();
            expect(result?.periodYear).toBe(2024);
        });
    });

    describe('findRunByCode', () => {
        it('should find run by code', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleRun],
                rowCount: 1,
            });

            const result = await repository.findRunByCode('DEP-2024-01-001');

            expect(result?.runCode).toBe('DEP-2024-01-001');
        });
    });

    describe('updateRunStatus', () => {
        it('should update run status', async () => {
            const completedRun = { ...sampleRun, status: 'completed' };
            pool.query.mockResolvedValue({
                rows: [completedRun],
                rowCount: 1,
            });

            const result = await repository.updateRunStatus(sampleRun.id, 'completed', {
                totalAssets: 10,
                totalAmount: 15000,
                completedAt: new Date(),
            });

            expect(result?.status).toBe('completed');
        });
    });

    describe('findAllRuns', () => {
        it('should return paginated runs', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '12' }] })
                .mockResolvedValueOnce({ rows: [sampleRun] });

            const result = await repository.findAllRuns({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(12);
        });

        it('should filter by period year', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '12' }] })
                .mockResolvedValueOnce({ rows: [sampleRun] });

            await repository.findAllRuns({ periodYear: 2024 });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('period_year = $'),
                expect.arrayContaining([2024])
            );
        });

        it('should filter by status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '10' }] })
                .mockResolvedValueOnce({ rows: [sampleRun] });

            await repository.findAllRuns({ status: 'completed' });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('status = $'),
                expect.arrayContaining(['completed'])
            );
        });
    });

    describe('hasRunForPeriod', () => {
        it('should return true if run exists for period', async () => {
            pool.query.mockResolvedValue({ rows: [{ 1: 1 }] });

            const result = await repository.hasRunForPeriod(2024, 1);

            expect(result).toBe(true);
        });

        it('should return false if no run for period', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            const result = await repository.hasRunForPeriod(2024, 2);

            expect(result).toBe(false);
        });
    });

    // ==================== Settings Tests ====================

    describe('findSettingByKey', () => {
        it('should find setting by key', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleSetting],
                rowCount: 1,
            });

            const result = await repository.findSettingByKey('default_method');

            expect(result?.settingValue).toBe('straight_line');
        });
    });

    describe('findAllSettings', () => {
        it('should return all settings', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleSetting],
            });

            const result = await repository.findAllSettings();

            expect(result).toHaveLength(1);
        });
    });

    describe('updateSetting', () => {
        it('should update setting value', async () => {
            const updatedSetting = { ...sampleSetting, setting_value: 'declining_balance' };
            pool.query.mockResolvedValue({
                rows: [updatedSetting],
                rowCount: 1,
            });

            const result = await repository.updateSetting('default_method', 'declining_balance', 'user-1');

            expect(result?.settingValue).toBe('declining_balance');
        });
    });

    // ==================== Statistics / Dashboard Tests ====================

    describe('getActiveSchedulesForPeriod', () => {
        it('should return active schedules for period', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleScheduleWithDetails],
            });

            const result = await repository.getActiveSchedulesForPeriod(2024, 1);

            expect(result).toHaveLength(1);
        });
    });

    describe('getMonthlySummary', () => {
        it('should return monthly summary', async () => {
            pool.query.mockResolvedValue({
                rows: [
                    { period_year: 2024, period_month: 1, total_depreciation: 15000, asset_count: 10 },
                ],
            });

            const result = await repository.getMonthlySummary(2024);

            expect(result).toHaveLength(1);
        });
    });

    describe('getDepreciationByCategory', () => {
        it('should return depreciation grouped by category', async () => {
            pool.query.mockResolvedValue({
                rows: [
                    {
                        category_id: 'cat-1',
                        category_name: 'Laptop',
                        asset_count: 10,
                        total_original_cost: 1000000,
                        total_current_book_value: 500000,
                        total_depreciated_amount: 500000,
                    },
                ],
            });

            const result = await repository.getDepreciationByCategory();

            expect(result).toHaveLength(1);
            expect(result[0].categoryName).toBe('Laptop');
        });
    });

    describe('getDashboard', () => {
        it('should return dashboard statistics', async () => {
            // Schedule counts
            pool.query
                .mockResolvedValueOnce({
                    rows: [
                        { status: 'active', count: '10' },
                        { status: 'fully_depreciated', count: '5' },
                        { status: 'stopped', count: '2' },
                    ],
                })
                // Totals
                .mockResolvedValueOnce({
                    rows: [{
                        total_original_cost: '1000000',
                        total_accumulated: '400000',
                        total_book_value: '500000',
                    }],
                })
                // Pending count
                .mockResolvedValueOnce({
                    rows: [{ count: '5' }],
                })
                // This month depreciation
                .mockResolvedValueOnce({
                    rows: [{ amount: '15000' }],
                })
                // Ending soon count
                .mockResolvedValueOnce({
                    rows: [{ count: '3' }],
                });

            const result = await repository.getDashboard();

            expect(result.activeSchedules).toBe(10);
            expect(result.fullyDepreciated).toBe(5);
            expect(result.stoppedSchedules).toBe(2);
            expect(result.totalOriginalCost).toBe(1000000);
            expect(result.totalAccumulatedDepreciation).toBe(400000);
            expect(result.pendingEntriesCount).toBe(5);
        });
    });

    // ==================== Transaction Tests ====================

    describe('withTransaction', () => {
        it('should execute callback within transaction', async () => {
            pool.mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [sampleSchedule] }) // callback query
                .mockResolvedValueOnce({ rows: [] }); // COMMIT

            const result = await repository.withTransaction(async (client) => {
                const res = await client.query('SELECT * FROM depreciation_schedules');
                return res.rows[0];
            });

            expect(pool.mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(pool.mockClient.query).toHaveBeenCalledWith('COMMIT');
        });

        it('should rollback on error', async () => {
            pool.mockClient.query
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockRejectedValueOnce(new Error('DB Error')) // callback error
                .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

            await expect(
                repository.withTransaction(async () => {
                    throw new Error('DB Error');
                })
            ).rejects.toThrow('DB Error');

            expect(pool.mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        });
    });
});
