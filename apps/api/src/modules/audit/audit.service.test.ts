/**
 * Audit Module - Service Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import { AuditRepository } from './audit.repository.js';
import {
    AuditSession,
    AuditSessionWithDetails,
    AuditItem,
    AuditItemWithDetails,
    UnregisteredAsset,
    AuditAuditorWithDetails,
    CreateAuditDto,
    CompleteAuditDto,
    CancelAuditDto,
    AuditItemDto,
} from './audit.types.js';

// Mock repository
function createMockRepository() {
    return {
        create: vi.fn(),
        findById: vi.fn(),
        findByIdWithDetails: vi.fn(),
        findByCode: vi.fn(),
        update: vi.fn(),
        updateStatus: vi.fn(),
        updateTotalItems: vi.fn(),
        delete: vi.fn(),
        findAll: vi.fn(),
        hasActiveAuditForLocation: vi.fn(),
        addLocation: vi.fn(),
        addLocations: vi.fn(),
        findLocationsByAuditId: vi.fn(),
        removeLocation: vi.fn(),
        addCategories: vi.fn(),
        findCategoriesByAuditId: vi.fn(),
        addAuditor: vi.fn(),
        addAuditors: vi.fn(),
        findAuditorsByAuditId: vi.fn(),
        removeAuditor: vi.fn(),
        isAuditor: vi.fn(),
        findAuditsByAuditor: vi.fn(),
        createAuditItem: vi.fn(),
        createAuditItems: vi.fn(),
        populateAuditItemsFromScope: vi.fn(),
        findAuditItemById: vi.fn(),
        findAuditItemByAsset: vi.fn(),
        findAuditItemsByAuditId: vi.fn(),
        updateAuditItem: vi.fn(),
        resolveDiscrepancy: vi.fn(),
        findDiscrepancies: vi.fn(),
        getAuditProgress: vi.fn(),
        createUnregisteredAsset: vi.fn(),
        findUnregisteredAssetById: vi.fn(),
        findUnregisteredAssetsByAuditId: vi.fn(),
        updateUnregisteredAsset: vi.fn(),
        markUnregisteredAssetRegistered: vi.fn(),
        createHistory: vi.fn(),
        findHistoryByAuditId: vi.fn(),
        getStatistics: vi.fn(),
        withTransaction: vi.fn(),
    } as unknown as AuditRepository;
}

// Sample data
const sampleAudit: AuditSession = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    auditCode: 'AUD-20240101-001',
    name: 'Q1 2024 Full Audit',
    auditType: 'full',
    scopeDescription: 'Full inventory audit for Q1 2024',
    startDate: '2024-01-15',
    endDate: '2024-01-20',
    status: 'draft',
    notes: null,
    totalItems: 100,
    auditedItems: 0,
    foundItems: 0,
    missingItems: 0,
    misplacedItems: 0,
    completedAt: null,
    completedBy: null,
    completionNotes: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    organizationId: '550e8400-e29b-41d4-a716-446655440010',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    createdBy: '550e8400-e29b-41d4-a716-446655440020',
};

const sampleAuditWithDetails: AuditSessionWithDetails = {
    ...sampleAudit,
    createdByName: 'John Doe',
    locations: 'Floor 1, Floor 2',
    categories: 'Laptop, Desktop',
    auditorCount: 3,
    progressPercent: 0,
    daysRemaining: 15,
    isOverdue: false,
};

const sampleAuditItem: AuditItem = {
    id: '550e8400-e29b-41d4-a716-446655440030',
    auditId: sampleAudit.id,
    assetId: '550e8400-e29b-41d4-a716-446655440040',
    expectedLocationId: '550e8400-e29b-41d4-a716-446655440050',
    expectedUserId: '550e8400-e29b-41d4-a716-446655440060',
    expectedCondition: 'good',
    auditStatus: 'pending',
    actualLocationId: null,
    actualUserId: null,
    actualCondition: null,
    auditedBy: null,
    auditedAt: null,
    notes: null,
    resolutionStatus: 'unresolved',
    resolutionAction: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
};

const sampleAuditItemWithDetails: AuditItemWithDetails = {
    ...sampleAuditItem,
    assetTag: 'LAP-001',
    assetName: 'Dell Latitude 5520',
    assetSerialNumber: 'ABC123',
    assetModelName: 'Latitude 5520',
    expectedLocationName: 'Floor 1',
    actualLocationName: null,
    expectedUserName: 'Jane Doe',
    actualUserName: null,
    auditedByName: null,
    resolvedByName: null,
};

const sampleAuditor: AuditAuditorWithDetails = {
    id: 'aa-1',
    auditId: sampleAudit.id,
    userId: '550e8400-e29b-41d4-a716-446655440020',
    assignedLocationId: null,
    isLead: true,
    createdAt: new Date(),
    userName: 'John Doe',
    userEmail: 'john@example.com',
    assignedLocationName: null,
};

describe('AuditService', () => {
    let repository: ReturnType<typeof createMockRepository>;
    let service: AuditService;

    beforeEach(() => {
        repository = createMockRepository();
        service = new AuditService(repository as unknown as AuditRepository);
    });

    // ==================== Audit Session Tests ====================

    describe('createAudit', () => {
        it('should create a new audit session', async () => {
            repository.hasActiveAuditForLocation.mockResolvedValue(false);
            repository.withTransaction.mockImplementation(async (callback) => {
                return callback({} as any);
            });
            repository.create.mockResolvedValue(sampleAudit);
            repository.addLocations.mockResolvedValue(undefined);
            repository.addAuditors.mockResolvedValue(undefined);
            repository.populateAuditItemsFromScope.mockResolvedValue(100);
            repository.updateTotalItems.mockResolvedValue(undefined);
            repository.createHistory.mockResolvedValue({});

            const dto: CreateAuditDto = {
                name: 'Q1 2024 Full Audit',
                auditType: 'full',
                scopeDescription: 'Full inventory audit',
                startDate: '2024-01-15',
                locationIds: ['loc-1', 'loc-2'],
                auditorIds: ['user-1'],
                createdBy: sampleAudit.createdBy,
            };

            const result = await service.createAudit(dto);

            expect(result.success).toBe(true);
            expect(result.audit).toBeDefined();
        });

        it('should warn if location has active audit (AUD-R01)', async () => {
            repository.hasActiveAuditForLocation.mockResolvedValue(true);
            repository.withTransaction.mockImplementation(async (callback) => {
                return callback({} as any);
            });
            repository.create.mockResolvedValue(sampleAudit);
            repository.addLocations.mockResolvedValue(undefined);
            repository.addAuditors.mockResolvedValue(undefined);
            repository.populateAuditItemsFromScope.mockResolvedValue(100);
            repository.updateTotalItems.mockResolvedValue(undefined);
            repository.createHistory.mockResolvedValue({});

            const consoleSpy = vi.spyOn(console, 'warn');

            const dto: CreateAuditDto = {
                name: 'Test Audit',
                auditType: 'partial',
                scopeDescription: 'Test',
                startDate: '2024-01-15',
                locationIds: ['loc-1'],
                auditorIds: ['user-1'],
                createdBy: sampleAudit.createdBy,
            };

            const result = await service.createAudit(dto);

            expect(result.success).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('already has an active audit')
            );
        });

        it('should reject if no auditors (AUD-R02)', async () => {
            const dto: CreateAuditDto = {
                name: 'Test Audit',
                auditType: 'full',
                scopeDescription: 'Test',
                startDate: '2024-01-15',
                locationIds: ['loc-1'],
                auditorIds: [],
                createdBy: sampleAudit.createdBy,
            };

            const result = await service.createAudit(dto);

            expect(result.success).toBe(false);
            expect(result.error).toBe('At least one auditor is required');
        });
    });

    describe('getAuditById', () => {
        it('should return audit by ID', async () => {
            repository.findById.mockResolvedValue(sampleAudit);

            const result = await service.getAuditById(sampleAudit.id);

            expect(result).toEqual(sampleAudit);
        });

        it('should return null when not found', async () => {
            repository.findById.mockResolvedValue(null);

            const result = await service.getAuditById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getAuditDetail', () => {
        it('should return full audit details', async () => {
            repository.findByIdWithDetails.mockResolvedValue(sampleAuditWithDetails);
            repository.findLocationsByAuditId.mockResolvedValue([]);
            repository.findCategoriesByAuditId.mockResolvedValue([]);
            repository.findAuditorsByAuditId.mockResolvedValue([sampleAuditor]);
            repository.getAuditProgress.mockResolvedValue({
                auditId: sampleAudit.id,
                totalItems: 100,
                auditedItems: 0,
                pendingItems: 100,
                foundItems: 0,
                missingItems: 0,
                misplacedItems: 0,
                conditionIssues: 0,
                progressPercent: 0,
                byLocation: [],
                byAuditor: [],
            });
            repository.findHistoryByAuditId.mockResolvedValue([]);

            const result = await service.getAuditDetail(sampleAudit.id);

            expect(result).toBeDefined();
            expect(result?.audit).toEqual(sampleAuditWithDetails);
            expect(result?.auditors).toHaveLength(1);
        });

        it('should return null when not found', async () => {
            repository.findByIdWithDetails.mockResolvedValue(null);

            const result = await service.getAuditDetail('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('updateAudit', () => {
        it('should update audit in draft status', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            const updated = { ...sampleAudit, name: 'Updated Name' };
            repository.update.mockResolvedValue(updated);
            repository.createHistory.mockResolvedValue({});

            const result = await service.updateAudit(
                sampleAudit.id,
                { name: 'Updated Name' },
                sampleAudit.createdBy
            );

            expect(result.success).toBe(true);
            expect(result.audit?.name).toBe('Updated Name');
        });

        it('should reject update when not in draft', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);

            const result = await service.updateAudit(
                sampleAudit.id,
                { name: 'Updated' },
                sampleAudit.createdBy
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Can only update audits in draft status');
        });
    });

    describe('deleteAudit', () => {
        it('should delete audit in draft status', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            repository.delete.mockResolvedValue(true);

            const result = await service.deleteAudit(sampleAudit.id, sampleAudit.createdBy);

            expect(result.success).toBe(true);
        });

        it('should reject delete when not in draft', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);

            const result = await service.deleteAudit(sampleAudit.id, sampleAudit.createdBy);

            expect(result.success).toBe(false);
        });
    });

    describe('startAudit', () => {
        it('should start draft audit', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            const startedAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.updateStatus.mockResolvedValue(startedAudit);
            repository.createHistory.mockResolvedValue({});

            const result = await service.startAudit({
                auditId: sampleAudit.id,
                startedBy: sampleAudit.createdBy,
            });

            expect(result.success).toBe(true);
            expect(result.audit?.status).toBe('in_progress');
        });

        it('should reject if no items', async () => {
            const emptyAudit = { ...sampleAudit, totalItems: 0 };
            repository.findById.mockResolvedValue(emptyAudit);

            const result = await service.startAudit({
                auditId: sampleAudit.id,
                startedBy: sampleAudit.createdBy,
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Audit has no items to audit');
        });
    });

    describe('checkCompletion', () => {
        it('should return completion check', async () => {
            repository.getAuditProgress.mockResolvedValue({
                auditId: sampleAudit.id,
                totalItems: 100,
                auditedItems: 96,
                pendingItems: 4,
                foundItems: 90,
                missingItems: 3,
                misplacedItems: 3,
                conditionIssues: 0,
                progressPercent: 96,
                byLocation: [],
                byAuditor: [],
            });
            repository.findDiscrepancies.mockResolvedValue({ data: [], total: 5 });

            const result = await service.checkCompletion(sampleAudit.id);

            expect(result.canComplete).toBe(true);
            expect(result.percentComplete).toBe(96);
            expect(result.hasUnresolvedDiscrepancies).toBe(true);
            expect(result.warnings).toHaveLength(2);
        });

        it('should not allow completion below 95% (AUD-R03)', async () => {
            repository.getAuditProgress.mockResolvedValue({
                auditId: sampleAudit.id,
                totalItems: 100,
                auditedItems: 90,
                pendingItems: 10,
                foundItems: 85,
                missingItems: 2,
                misplacedItems: 3,
                conditionIssues: 0,
                progressPercent: 90,
                byLocation: [],
                byAuditor: [],
            });
            repository.findDiscrepancies.mockResolvedValue({ data: [], total: 0 });

            const result = await service.checkCompletion(sampleAudit.id);

            expect(result.canComplete).toBe(false);
        });
    });

    describe('completeAudit', () => {
        it('should complete audit meeting threshold', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.getAuditProgress.mockResolvedValue({
                auditId: sampleAudit.id,
                totalItems: 100,
                auditedItems: 100,
                pendingItems: 0,
                foundItems: 98,
                missingItems: 1,
                misplacedItems: 1,
                conditionIssues: 0,
                progressPercent: 100,
                byLocation: [],
                byAuditor: [],
            });
            repository.findDiscrepancies.mockResolvedValue({ data: [], total: 0 });
            const completedAudit = { ...sampleAudit, status: 'completed' as const };
            repository.updateStatus.mockResolvedValue(completedAudit);
            repository.createHistory.mockResolvedValue({});

            const result = await service.completeAudit({
                auditId: sampleAudit.id,
                completedBy: sampleAudit.createdBy,
            });

            expect(result.success).toBe(true);
            expect(result.audit?.status).toBe('completed');
        });

        it('should reject completion below threshold without override', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.getAuditProgress.mockResolvedValue({
                auditId: sampleAudit.id,
                totalItems: 100,
                auditedItems: 80,
                pendingItems: 20,
                progressPercent: 80,
                byLocation: [],
                byAuditor: [],
            });
            repository.findDiscrepancies.mockResolvedValue({ data: [], total: 0 });

            const result = await service.completeAudit({
                auditId: sampleAudit.id,
                completedBy: sampleAudit.createdBy,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('less than 95% audited');
        });

        it('should allow completion with override', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.getAuditProgress.mockResolvedValue({
                auditId: sampleAudit.id,
                totalItems: 100,
                auditedItems: 80,
                pendingItems: 20,
                progressPercent: 80,
                byLocation: [],
                byAuditor: [],
            });
            repository.findDiscrepancies.mockResolvedValue({ data: [], total: 0 });
            const completedAudit = { ...sampleAudit, status: 'completed' as const };
            repository.updateStatus.mockResolvedValue(completedAudit);
            repository.createHistory.mockResolvedValue({});

            const result = await service.completeAudit({
                auditId: sampleAudit.id,
                completedBy: sampleAudit.createdBy,
                overrideIncomplete: true,
            });

            expect(result.success).toBe(true);
        });
    });

    describe('cancelAudit', () => {
        it('should cancel audit', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            const cancelledAudit = { ...sampleAudit, status: 'cancelled' as const };
            repository.updateStatus.mockResolvedValue(cancelledAudit);
            repository.createHistory.mockResolvedValue({});

            const result = await service.cancelAudit({
                auditId: sampleAudit.id,
                cancelledBy: sampleAudit.createdBy,
                reason: 'No longer needed',
            });

            expect(result.success).toBe(true);
            expect(result.audit?.status).toBe('cancelled');
        });

        it('should reject cancelling completed audit', async () => {
            const completedAudit = { ...sampleAudit, status: 'completed' as const };
            repository.findById.mockResolvedValue(completedAudit);

            const result = await service.cancelAudit({
                auditId: sampleAudit.id,
                cancelledBy: sampleAudit.createdBy,
            });

            expect(result.success).toBe(false);
        });
    });

    // ==================== Audit Item Tests ====================

    describe('auditItem', () => {
        it('should audit an item', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.isAuditor.mockResolvedValue(true);
            const foundItem = { ...sampleAuditItem, auditStatus: 'found' as const };
            repository.createAuditItem.mockResolvedValue(foundItem);
            repository.createHistory.mockResolvedValue({});

            const dto: AuditItemDto = {
                auditId: sampleAudit.id,
                assetId: sampleAuditItem.assetId,
                auditStatus: 'found',
                auditedBy: 'user-1',
            };

            const result = await service.auditItem(dto);

            expect(result.success).toBe(true);
            expect(result.item?.auditStatus).toBe('found');
        });

        it('should reject if user is not auditor', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.isAuditor.mockResolvedValue(false);

            const result = await service.auditItem({
                auditId: sampleAudit.id,
                assetId: sampleAuditItem.assetId,
                auditStatus: 'found',
                auditedBy: 'unauthorized-user',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('User is not assigned as an auditor');
        });

        it('should reject if audit not in progress', async () => {
            repository.findById.mockResolvedValue(sampleAudit); // draft status

            const result = await service.auditItem({
                auditId: sampleAudit.id,
                assetId: sampleAuditItem.assetId,
                auditStatus: 'found',
                auditedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Audit is not in progress');
        });
    });

    describe('bulkAuditItems', () => {
        it('should audit multiple items', async () => {
            repository.createAuditItem.mockResolvedValue(sampleAuditItem);

            const result = await service.bulkAuditItems({
                auditId: sampleAudit.id,
                items: [
                    { assetId: 'asset-1', auditStatus: 'found' },
                    { assetId: 'asset-2', auditStatus: 'found' },
                ],
                auditedBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.failed).toBe(0);
        });

        it('should report failed items', async () => {
            repository.createAuditItem
                .mockResolvedValueOnce(sampleAuditItem)
                .mockRejectedValueOnce(new Error('Database error'));

            const result = await service.bulkAuditItems({
                auditId: sampleAudit.id,
                items: [
                    { assetId: 'asset-1', auditStatus: 'found' },
                    { assetId: 'asset-2', auditStatus: 'found' },
                ],
                auditedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.processed).toBe(1);
            expect(result.failed).toBe(1);
        });
    });

    describe('resolveDiscrepancy', () => {
        it('should resolve a discrepancy', async () => {
            const missingItem = { ...sampleAuditItem, auditStatus: 'missing' as const };
            repository.findAuditItemById.mockResolvedValue(missingItem);
            const resolvedItem = {
                ...missingItem,
                resolutionStatus: 'resolved' as const,
            };
            repository.resolveDiscrepancy.mockResolvedValue(resolvedItem);

            const result = await service.resolveDiscrepancy({
                itemId: sampleAuditItem.id,
                resolutionAction: 'Marked as lost',
                resolvedBy: 'user-1',
            });

            expect(result.success).toBe(true);
        });

        it('should reject if item is not a discrepancy', async () => {
            const foundItem = { ...sampleAuditItem, auditStatus: 'found' as const };
            repository.findAuditItemById.mockResolvedValue(foundItem);

            const result = await service.resolveDiscrepancy({
                itemId: sampleAuditItem.id,
                resolutionAction: 'Test',
                resolvedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Item is not a discrepancy');
        });
    });

    describe('scanAsset', () => {
        it('should find asset in audit', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.findAuditItemsByAuditId.mockResolvedValue({
                data: [sampleAuditItemWithDetails],
                total: 1,
            });

            const result = await service.scanAsset(sampleAudit.id, 'LAP-001', 'user-1');

            expect(result.found).toBe(true);
            expect(result.inAudit).toBe(true);
            expect(result.asset?.assetTag).toBe('LAP-001');
        });

        it('should indicate asset not in audit', async () => {
            const inProgressAudit = { ...sampleAudit, status: 'in_progress' as const };
            repository.findById.mockResolvedValue(inProgressAudit);
            repository.findAuditItemsByAuditId.mockResolvedValue({ data: [], total: 0 });

            const result = await service.scanAsset(sampleAudit.id, 'UNKNOWN-001', 'user-1');

            expect(result.found).toBe(false);
            expect(result.inAudit).toBe(false);
        });
    });

    // ==================== Auditor Management Tests ====================

    describe('assignAuditor', () => {
        it('should assign auditor', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            repository.addAuditor.mockResolvedValue(sampleAuditor);

            const result = await service.assignAuditor({
                auditId: sampleAudit.id,
                userId: 'new-user',
                isLead: false,
            });

            expect(result.success).toBe(true);
        });

        it('should reject for completed audit', async () => {
            const completedAudit = { ...sampleAudit, status: 'completed' as const };
            repository.findById.mockResolvedValue(completedAudit);

            const result = await service.assignAuditor({
                auditId: sampleAudit.id,
                userId: 'new-user',
            });

            expect(result.success).toBe(false);
        });
    });

    describe('removeAuditor', () => {
        it('should remove auditor', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            repository.findAuditorsByAuditId.mockResolvedValue([sampleAuditor, { ...sampleAuditor, userId: 'user-2' }]);
            repository.removeAuditor.mockResolvedValue(true);

            const result = await service.removeAuditor(sampleAudit.id, 'user-2');

            expect(result.success).toBe(true);
        });

        it('should reject removing last auditor (AUD-R02)', async () => {
            repository.findById.mockResolvedValue(sampleAudit);
            repository.findAuditorsByAuditId.mockResolvedValue([sampleAuditor]);

            const result = await service.removeAuditor(sampleAudit.id, sampleAuditor.userId);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot remove the last auditor');
        });
    });

    // ==================== Statistics Tests ====================

    describe('getStatistics', () => {
        it('should return audit statistics', async () => {
            const stats = {
                totalAudits: 50,
                activeAudits: 5,
                completedAudits: 40,
                overdueAudits: 1,
                avgFoundRate: 95.5,
                avgMissingRate: 2.5,
                avgCompletionTime: 5.5,
                byType: { full: 20, partial: 25, spot_check: 5 },
                byStatus: {
                    draft: 3,
                    in_progress: 4,
                    reviewing: 1,
                    completed: 40,
                    cancelled: 2,
                },
                recentDiscrepancies: 15,
            };
            repository.getStatistics.mockResolvedValue(stats);

            const result = await service.getStatistics();

            expect(result.totalAudits).toBe(50);
            expect(result.avgFoundRate).toBe(95.5);
        });
    });

    // ==================== Query Tests ====================

    describe('getAudits', () => {
        it('should return paginated audits', async () => {
            repository.findAll.mockResolvedValue({
                data: [sampleAuditWithDetails],
                total: 10,
            });

            const result = await service.getAudits({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(10);
            expect(result.pagination.totalPages).toBe(1);
        });
    });

    describe('getMyAssignedAudits', () => {
        it('should return assigned audits for user', async () => {
            repository.findAuditsByAuditor.mockResolvedValue([sampleAuditWithDetails]);

            const result = await service.getMyAssignedAudits('user-1');

            expect(result).toHaveLength(1);
        });
    });
});
