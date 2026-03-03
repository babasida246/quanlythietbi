/**
 * Audit Module - Repository Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditRepository } from './audit.repository.js';
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
const sampleAudit = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    audit_code: 'AUD-20240101-001',
    name: 'Q1 2024 Full Audit',
    audit_type: 'full',
    scope_description: 'Full inventory audit for Q1 2024',
    start_date: '2024-01-15',
    end_date: '2024-01-20',
    status: 'draft',
    notes: null,
    total_items: 100,
    audited_items: 0,
    found_items: 0,
    missing_items: 0,
    misplaced_items: 0,
    completed_at: null,
    completed_by: null,
    completion_notes: null,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    organization_id: '550e8400-e29b-41d4-a716-446655440010',
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
    created_by: '550e8400-e29b-41d4-a716-446655440020',
};

const sampleAuditWithDetails = {
    ...sampleAudit,
    created_by_name: 'John Doe',
    locations: 'Floor 1, Floor 2',
    categories: 'Laptop, Desktop',
    auditor_count: 3,
    progress_percent: 0,
    days_remaining: 15,
    is_overdue: false,
};

const sampleAuditItem = {
    id: '550e8400-e29b-41d4-a716-446655440030',
    audit_id: sampleAudit.id,
    asset_id: '550e8400-e29b-41d4-a716-446655440040',
    expected_location_id: '550e8400-e29b-41d4-a716-446655440050',
    expected_user_id: '550e8400-e29b-41d4-a716-446655440060',
    expected_condition: 'good',
    audit_status: 'pending',
    actual_location_id: null,
    actual_user_id: null,
    actual_condition: null,
    audited_by: null,
    audited_at: null,
    notes: null,
    resolution_status: 'unresolved',
    resolution_action: null,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date('2024-01-01T10:00:00Z'),
    updated_at: new Date('2024-01-01T10:00:00Z'),
};

const sampleAuditItemWithDetails = {
    ...sampleAuditItem,
    asset_tag: 'LAP-001',
    asset_name: 'Dell Latitude 5520',
    asset_serial_number: 'ABC123',
    asset_model_name: 'Latitude 5520',
    expected_location_name: 'Floor 1',
    actual_location_name: null,
    expected_user_name: 'Jane Doe',
    actual_user_name: null,
    audited_by_name: null,
    resolved_by_name: null,
};

const sampleUnregistered = {
    id: '550e8400-e29b-41d4-a716-446655440070',
    audit_id: sampleAudit.id,
    temporary_id: 'TEMP-001',
    description: 'Unknown laptop found in storage room',
    serial_number: 'XYZ789',
    location_found_id: '550e8400-e29b-41d4-a716-446655440050',
    location_found_text: null,
    condition: 'good',
    photo_path: null,
    action: 'investigate',
    action_notes: null,
    registered_asset_id: null,
    registered_at: null,
    registered_by: null,
    found_by: '550e8400-e29b-41d4-a716-446655440020',
    found_at: new Date('2024-01-15T14:00:00Z'),
    created_at: new Date('2024-01-15T14:00:00Z'),
    updated_at: new Date('2024-01-15T14:00:00Z'),
};

describe('AuditRepository', () => {
    let pool: ReturnType<typeof createMockPool>;
    let repository: AuditRepository;

    beforeEach(() => {
        pool = createMockPool();
        repository = new AuditRepository(pool as unknown as Pool);
    });

    // ==================== Audit Session Tests ====================

    describe('create', () => {
        it('should create a new audit session', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleAudit],
                rowCount: 1,
            });

            const result = await repository.create({
                name: 'Q1 2024 Full Audit',
                auditType: 'full',
                scopeDescription: 'Full inventory audit for Q1 2024',
                startDate: '2024-01-15',
                endDate: '2024-01-20',
                locationIds: ['loc-1'],
                auditorIds: ['user-1'],
                createdBy: sampleAudit.created_by,
            });

            expect(result.id).toBe(sampleAudit.id);
            expect(result.name).toBe('Q1 2024 Full Audit');
            expect(result.auditType).toBe('full');
        });
    });

    describe('findById', () => {
        it('should find audit by ID', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleAudit],
                rowCount: 1,
            });

            const result = await repository.findById(sampleAudit.id);

            expect(result).toBeDefined();
            expect(result?.id).toBe(sampleAudit.id);
        });

        it('should return null when not found', async () => {
            pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

            const result = await repository.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByIdWithDetails', () => {
        it('should find audit with full details', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleAuditWithDetails],
                rowCount: 1,
            });

            const result = await repository.findByIdWithDetails(sampleAudit.id);

            expect(result).toBeDefined();
            expect(result?.createdByName).toBe('John Doe');
            expect(result?.locations).toBe('Floor 1, Floor 2');
            expect(result?.auditorCount).toBe(3);
        });
    });

    describe('findByCode', () => {
        it('should find audit by code', async () => {
            pool.query.mockResolvedValue({
                rows: [sampleAudit],
                rowCount: 1,
            });

            const result = await repository.findByCode('AUD-20240101-001');

            expect(result?.auditCode).toBe('AUD-20240101-001');
        });
    });

    describe('update', () => {
        it('should update audit fields', async () => {
            const updatedAudit = { ...sampleAudit, name: 'Updated Audit Name' };
            pool.query.mockResolvedValue({
                rows: [updatedAudit],
                rowCount: 1,
            });

            const result = await repository.update(sampleAudit.id, {
                name: 'Updated Audit Name',
            });

            expect(result?.name).toBe('Updated Audit Name');
        });
    });

    describe('updateStatus', () => {
        it('should update audit status', async () => {
            const updatedAudit = { ...sampleAudit, status: 'in_progress' };
            pool.query.mockResolvedValue({
                rows: [updatedAudit],
                rowCount: 1,
            });

            const result = await repository.updateStatus(sampleAudit.id, 'in_progress');

            expect(result?.status).toBe('in_progress');
        });

        it('should update status with completion info', async () => {
            const completedAudit = {
                ...sampleAudit,
                status: 'completed',
                completed_at: new Date(),
                completed_by: 'user-1',
            };
            pool.query.mockResolvedValue({
                rows: [completedAudit],
                rowCount: 1,
            });

            const result = await repository.updateStatus(sampleAudit.id, 'completed', {
                completedAt: new Date(),
                completedBy: 'user-1',
                completionNotes: 'All items audited',
            });

            expect(result?.status).toBe('completed');
        });
    });

    describe('delete', () => {
        it('should delete audit', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 });

            const result = await repository.delete(sampleAudit.id);

            expect(result).toBe(true);
        });

        it('should return false when not found', async () => {
            pool.query.mockResolvedValue({ rowCount: 0 });

            const result = await repository.delete('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('findAll', () => {
        it('should return paginated audits', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '10' }] })
                .mockResolvedValueOnce({ rows: [sampleAuditWithDetails] });

            const result = await repository.findAll({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(10);
        });

        it('should filter by status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [sampleAuditWithDetails] });

            const result = await repository.findAll({ status: 'draft' });

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('a.status = $'),
                expect.arrayContaining(['draft'])
            );
        });

        it('should filter by audit type', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                .mockResolvedValueOnce({ rows: [sampleAuditWithDetails] });

            const result = await repository.findAll({ auditType: 'full' });

            expect(result.data).toHaveLength(1);
        });

        it('should search by text', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [sampleAuditWithDetails] });

            const result = await repository.findAll({ search: 'Q1' });

            expect(result.data).toHaveLength(1);
        });
    });

    describe('hasActiveAuditForLocation', () => {
        it('should return true if active audit exists', async () => {
            pool.query.mockResolvedValue({ rows: [{ 1: 1 }] });

            const result = await repository.hasActiveAuditForLocation('loc-1');

            expect(result).toBe(true);
        });

        it('should return false if no active audit', async () => {
            pool.query.mockResolvedValue({ rows: [] });

            const result = await repository.hasActiveAuditForLocation('loc-1');

            expect(result).toBe(false);
        });
    });

    // ==================== Audit Locations Tests ====================

    describe('addLocations', () => {
        it('should add locations to audit', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 });

            await repository.addLocations(sampleAudit.id, ['loc-1', 'loc-2']);

            expect(pool.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('findLocationsByAuditId', () => {
        it('should find locations for audit', async () => {
            pool.query.mockResolvedValue({
                rows: [
                    { id: 'al-1', audit_id: sampleAudit.id, location_id: 'loc-1', location_name: 'Floor 1' },
                ],
            });

            const result = await repository.findLocationsByAuditId(sampleAudit.id);

            expect(result).toHaveLength(1);
            expect(result[0].locationName).toBe('Floor 1');
        });
    });

    // ==================== Audit Auditors Tests ====================

    describe('addAuditor', () => {
        it('should add auditor to audit', async () => {
            pool.query.mockResolvedValue({
                rows: [{ id: 'aa-1', audit_id: sampleAudit.id, user_id: 'user-1', is_lead: true }],
            });

            const result = await repository.addAuditor(sampleAudit.id, 'user-1', undefined, true);

            expect(result.isLead).toBe(true);
        });
    });

    describe('findAuditorsByAuditId', () => {
        it('should find auditors for audit', async () => {
            pool.query.mockResolvedValue({
                rows: [
                    {
                        id: 'aa-1',
                        audit_id: sampleAudit.id,
                        user_id: 'user-1',
                        user_name: 'John Doe',
                        user_email: 'john@example.com',
                        is_lead: true,
                    },
                ],
            });

            const result = await repository.findAuditorsByAuditId(sampleAudit.id);

            expect(result).toHaveLength(1);
            expect(result[0].userName).toBe('John Doe');
        });
    });

    describe('isAuditor', () => {
        it('should return true if user is auditor', async () => {
            pool.query.mockResolvedValue({ rows: [{ 1: 1 }] });

            const result = await repository.isAuditor(sampleAudit.id, 'user-1');

            expect(result).toBe(true);
        });
    });

    describe('removeAuditor', () => {
        it('should remove auditor from audit', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 });

            const result = await repository.removeAuditor(sampleAudit.id, 'user-1');

            expect(result).toBe(true);
        });
    });

    // ==================== Audit Items Tests ====================

    describe('createAuditItem', () => {
        it('should create audit item', async () => {
            const foundItem = { ...sampleAuditItem, audit_status: 'found' };
            pool.query.mockResolvedValue({ rows: [foundItem] });

            const result = await repository.createAuditItem({
                auditId: sampleAudit.id,
                assetId: sampleAuditItem.asset_id,
                auditStatus: 'found',
                auditedBy: 'user-1',
            });

            expect(result.auditStatus).toBe('found');
        });
    });

    describe('populateAuditItemsFromScope', () => {
        it('should populate items from scope', async () => {
            pool.query.mockResolvedValue({ rowCount: 50 });

            const result = await repository.populateAuditItemsFromScope(
                sampleAudit.id,
                ['loc-1', 'loc-2'],
                ['cat-1']
            );

            expect(result).toBe(50);
        });
    });

    describe('findAuditItemsByAuditId', () => {
        it('should find items for audit', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '100' }] })
                .mockResolvedValueOnce({ rows: [sampleAuditItemWithDetails] });

            const result = await repository.findAuditItemsByAuditId(sampleAudit.id, {});

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(100);
        });

        it('should filter by audit status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [sampleAuditItemWithDetails] });

            const result = await repository.findAuditItemsByAuditId(sampleAudit.id, {
                auditStatus: 'pending',
            });

            expect(result.data).toHaveLength(1);
        });
    });

    describe('updateAuditItem', () => {
        it('should update item status', async () => {
            const updatedItem = { ...sampleAuditItem, audit_status: 'found' };
            pool.query.mockResolvedValue({ rows: [updatedItem] });

            const result = await repository.updateAuditItem(
                sampleAuditItem.id,
                'found',
                { auditedBy: 'user-1' }
            );

            expect(result?.auditStatus).toBe('found');
        });
    });

    describe('resolveDiscrepancy', () => {
        it('should resolve discrepancy', async () => {
            const resolvedItem = {
                ...sampleAuditItem,
                resolution_status: 'resolved',
                resolution_action: 'Updated location in system',
            };
            pool.query.mockResolvedValue({ rows: [resolvedItem] });

            const result = await repository.resolveDiscrepancy(
                sampleAuditItem.id,
                'Updated location in system',
                'user-1'
            );

            expect(result?.resolutionStatus).toBe('resolved');
        });
    });

    describe('findDiscrepancies', () => {
        it('should find discrepancies', async () => {
            const discrepancyItem = { ...sampleAuditItemWithDetails, audit_status: 'missing' };
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                .mockResolvedValueOnce({ rows: [discrepancyItem] });

            const result = await repository.findDiscrepancies(sampleAudit.id, {});

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(3);
        });
    });

    describe('getAuditProgress', () => {
        it('should return progress statistics', async () => {
            pool.query
                .mockResolvedValueOnce({
                    rows: [{
                        total: '100',
                        audited: '45',
                        pending: '55',
                        found: '40',
                        missing: '3',
                        misplaced: '2',
                        condition_issues: '0',
                    }],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { location_id: 'loc-1', location_name: 'Floor 1', total: '50', audited: '25' },
                    ],
                })
                .mockResolvedValueOnce({
                    rows: [
                        { auditor_id: 'user-1', auditor_name: 'John Doe', audited: '25' },
                    ],
                });

            const result = await repository.getAuditProgress(sampleAudit.id);

            expect(result.totalItems).toBe(100);
            expect(result.auditedItems).toBe(45);
            expect(result.progressPercent).toBe(45);
            expect(result.byLocation).toHaveLength(1);
            expect(result.byAuditor).toHaveLength(1);
        });
    });

    // ==================== Unregistered Assets Tests ====================

    describe('createUnregisteredAsset', () => {
        it('should create unregistered asset', async () => {
            pool.query.mockResolvedValue({ rows: [sampleUnregistered] });

            const result = await repository.createUnregisteredAsset({
                auditId: sampleAudit.id,
                temporaryId: 'TEMP-001',
                description: 'Unknown laptop found in storage room',
                serialNumber: 'XYZ789',
                foundBy: 'user-1',
            });

            expect(result.temporaryId).toBe('TEMP-001');
        });
    });

    describe('findUnregisteredAssetsByAuditId', () => {
        it('should find unregistered assets', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        ...sampleUnregistered,
                        location_found_name: 'Storage Room',
                        found_by_name: 'John Doe',
                    }],
                });

            const result = await repository.findUnregisteredAssetsByAuditId(sampleAudit.id, {});

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(5);
        });
    });

    describe('updateUnregisteredAsset', () => {
        it('should update unregistered asset', async () => {
            const updated = { ...sampleUnregistered, action: 'register' };
            pool.query.mockResolvedValue({ rows: [updated] });

            const result = await repository.updateUnregisteredAsset(sampleUnregistered.id, {
                action: 'register',
            });

            expect(result?.action).toBe('register');
        });
    });

    describe('markUnregisteredAssetRegistered', () => {
        it('should mark asset as registered', async () => {
            const registered = {
                ...sampleUnregistered,
                action: 'register',
                registered_asset_id: 'asset-new',
            };
            pool.query.mockResolvedValue({ rows: [registered] });

            const result = await repository.markUnregisteredAssetRegistered(
                sampleUnregistered.id,
                'asset-new',
                'user-1'
            );

            expect(result?.registeredAssetId).toBe('asset-new');
        });
    });

    // ==================== Audit History Tests ====================

    describe('createHistory', () => {
        it('should create history entry', async () => {
            pool.query.mockResolvedValue({
                rows: [{
                    id: 'hist-1',
                    audit_id: sampleAudit.id,
                    action: 'created',
                    actor_id: 'user-1',
                    old_status: null,
                    new_status: 'draft',
                    details: null,
                    created_at: new Date(),
                }],
            });

            const result = await repository.createHistory(
                sampleAudit.id,
                'created',
                'user-1',
                undefined,
                'draft'
            );

            expect(result.action).toBe('created');
            expect(result.newStatus).toBe('draft');
        });
    });

    describe('findHistoryByAuditId', () => {
        it('should find history for audit', async () => {
            pool.query.mockResolvedValue({
                rows: [{
                    id: 'hist-1',
                    audit_id: sampleAudit.id,
                    action: 'created',
                    actor_id: 'user-1',
                    actor_name: 'John Doe',
                    created_at: new Date(),
                }],
            });

            const result = await repository.findHistoryByAuditId(sampleAudit.id);

            expect(result).toHaveLength(1);
            expect(result[0].actorName).toBe('John Doe');
        });
    });

    // ==================== Statistics Tests ====================

    describe('getStatistics', () => {
        it('should return audit statistics', async () => {
            pool.query
                .mockResolvedValueOnce({
                    rows: [{
                        total_audits: '50',
                        active_audits: '5',
                        completed_audits: '40',
                        overdue_audits: '1',
                        avg_found_rate: '95.5',
                        avg_missing_rate: '2.5',
                        avg_completion_time: '5.5',
                        type_full: '20',
                        type_partial: '25',
                        type_spot_check: '5',
                        status_draft: '3',
                        status_in_progress: '4',
                        status_reviewing: '1',
                        status_completed: '40',
                        status_cancelled: '2',
                    }],
                })
                .mockResolvedValueOnce({ rows: [{ count: '15' }] });

            const result = await repository.getStatistics();

            expect(result.totalAudits).toBe(50);
            expect(result.activeAudits).toBe(5);
            expect(result.avgFoundRate).toBe(95.5);
            expect(result.byType.full).toBe(20);
            expect(result.byStatus.completed).toBe(40);
            expect(result.recentDiscrepancies).toBe(15);
        });
    });

    // ==================== Transaction Tests ====================

    describe('withTransaction', () => {
        it('should commit on success', async () => {
            pool.mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [sampleAudit] }) // callback query
                .mockResolvedValueOnce({}); // COMMIT

            const result = await repository.withTransaction(async (client) => {
                const res = await client.query('SELECT * FROM audit_sessions');
                return res.rows[0];
            });

            expect(pool.mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(pool.mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(pool.mockClient.release).toHaveBeenCalled();
        });

        it('should rollback on error', async () => {
            pool.mockClient.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockRejectedValueOnce(new Error('Test error')) // callback error
                .mockResolvedValueOnce({}); // ROLLBACK

            await expect(
                repository.withTransaction(async () => {
                    throw new Error('Test error');
                })
            ).rejects.toThrow('Test error');

            expect(pool.mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(pool.mockClient.release).toHaveBeenCalled();
        });
    });
});
