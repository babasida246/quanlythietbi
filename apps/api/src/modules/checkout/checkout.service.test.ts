/**
 * Checkout Service - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { CheckoutService } from './checkout.service.js';
import { CheckoutRepository } from './checkout.repository.js';
import {
    AssetCheckout,
    AssetCheckoutWithDetails,
    CheckoutExtension,
    CheckoutTransfer,
    CheckoutAuditLog,
    CheckoutAssetDto,
    CheckinAssetDto,
    ExtendCheckoutDto,
    TransferAssetDto
} from './checkout.types.js';

// Mock the repository
vi.mock('./checkout.repository.js');

describe('CheckoutService', () => {
    let service: CheckoutService;
    let mockRepository: CheckoutRepository;
    let mockPool: Pool;
    let mockClient: Partial<PoolClient>;

    const mockAuditLog: CheckoutAuditLog = {
        id: 'log-1',
        checkoutId: 'checkout-1',
        assetId: 'asset-1',
        action: 'test action',
        actionType: 'checkout',
        oldValues: null,
        newValues: null,
        performedBy: 'admin-1',
        performedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        notes: null
    };

    const mockCheckout: AssetCheckout = {
        id: 'checkout-1',
        checkoutCode: 'CHK-000001',
        assetId: 'asset-1',
        checkoutType: 'user',
        targetUserId: 'user-1',
        targetLocationId: null,
        targetAssetId: null,
        checkoutDate: new Date(),
        expectedCheckinDate: '2025-01-31',
        checkedOutBy: 'admin-1',
        checkoutNotes: null,
        checkinDate: null,
        checkedInBy: null,
        checkinNotes: null,
        checkinCondition: null,
        nextAction: null,
        status: 'checked_out',
        isOverdue: false,
        overdueNotifiedAt: null,
        overdueNotificationCount: 0,
        organizationId: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockCheckoutWithDetails: AssetCheckoutWithDetails = {
        ...mockCheckout,
        assetTag: 'LAP-001',
        assetName: 'Dell Laptop',
        assetCategory: 'Laptops',
        assetSerialNumber: 'SN123456',
        targetUserName: 'John Doe',
        targetUserEmail: 'john@example.com',
        targetLocationName: null,
        targetAssetTag: null,
        targetAssetName: null,
        checkedOutByName: 'Admin User',
        checkedInByName: null,
        dueStatus: 'on_track',
        daysUntilDue: 15,
        daysOverdue: null
    };

    const mockCheckedInCheckout: AssetCheckout = {
        ...mockCheckout,
        checkinDate: new Date(),
        checkedInBy: 'admin-1',
        checkinCondition: 'good',
        nextAction: 'available',
        status: 'checked_in'
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
            query: vi.fn() as unknown as PoolClient['query'],
            release: vi.fn()
        };

        mockPool = {} as Pool;
        service = new CheckoutService(mockPool);

        // Get the mocked repository instance
        mockRepository = (service as unknown as { repository: CheckoutRepository }).repository;

        // Setup default transaction mocks
        vi.mocked(mockRepository.getClient).mockResolvedValue(mockClient as PoolClient);
        vi.mocked(mockRepository.beginTransaction).mockResolvedValue(undefined);
        vi.mocked(mockRepository.commitTransaction).mockResolvedValue(undefined);
        vi.mocked(mockRepository.rollbackTransaction).mockResolvedValue(undefined);
        vi.mocked(mockRepository.releaseClient).mockReturnValue(undefined);
    });

    // ==================== Checkout Asset Tests ====================

    describe('checkoutAsset', () => {
        it('should checkout asset to user successfully', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'asset-1', asset_tag: 'LAP-001', name: 'Dell Laptop', status: 'available' }] }) // asset query
                .mockResolvedValueOnce({ rows: [{ id: 'user-1', name: 'John Doe', is_active: true }] }); // user query
            vi.mocked(mockRepository.checkout).mockResolvedValue(mockCheckout);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] }); // update asset status
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);
            vi.mocked(mockRepository.findByIdWithDetails).mockResolvedValue(mockCheckoutWithDetails);

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'user',
                targetUserId: 'user-1',
                expectedCheckinDate: '2025-01-31',
                checkedOutBy: 'admin-1'
            };

            const result = await service.checkoutAsset(dto);

            expect(result.id).toBe('checkout-1');
            expect(result.assetTag).toBe('LAP-001');
            expect(result.targetUserName).toBe('John Doe');
            expect(mockRepository.checkout).toHaveBeenCalled();
            expect(mockRepository.createAuditLog).toHaveBeenCalled();
            expect(mockRepository.commitTransaction).toHaveBeenCalled();
        });

        it('should throw error if asset already has active checkout (CHK-R04)', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(mockCheckout);

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'user',
                targetUserId: 'user-1',
                checkedOutBy: 'admin-1'
            };

            await expect(service.checkoutAsset(dto)).rejects.toThrow(
                'Asset already has an active checkout. Please check it in first.'
            );
            expect(mockRepository.rollbackTransaction).toHaveBeenCalled();
        });

        it('should throw error if asset not found', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [] }); // asset not found

            const dto: CheckoutAssetDto = {
                assetId: 'non-existent',
                checkoutType: 'user',
                targetUserId: 'user-1',
                checkedOutBy: 'admin-1'
            };

            await expect(service.checkoutAsset(dto)).rejects.toThrow('Asset not found');
            expect(mockRepository.rollbackTransaction).toHaveBeenCalled();
        });

        it('should throw error if asset not available (CHK-R01)', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'asset-1', status: 'maintenance' }] });

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'user',
                targetUserId: 'user-1',
                checkedOutBy: 'admin-1'
            };

            await expect(service.checkoutAsset(dto)).rejects.toThrow(
                'Asset is not available for checkout (current status: maintenance)'
            );
        });

        it('should throw error if target user not found', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'asset-1', status: 'available' }] })
                .mockResolvedValueOnce({ rows: [] }); // user not found

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'user',
                targetUserId: 'non-existent',
                checkedOutBy: 'admin-1'
            };

            await expect(service.checkoutAsset(dto)).rejects.toThrow('Target user not found');
        });

        it('should throw error if target user is inactive (CHK-R02)', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'asset-1', status: 'available' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'user-1', is_active: false }] });

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'user',
                targetUserId: 'user-1',
                checkedOutBy: 'admin-1'
            };

            await expect(service.checkoutAsset(dto)).rejects.toThrow('Cannot checkout to inactive user');
        });

        it('should checkout to location successfully', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'asset-1', status: 'available' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'location-1', name: 'Room 101' }] });

            const locationCheckout = { ...mockCheckout, checkoutType: 'location' as const, targetLocationId: 'location-1', targetUserId: null };
            vi.mocked(mockRepository.checkout).mockResolvedValue(locationCheckout);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);
            vi.mocked(mockRepository.findByIdWithDetails).mockResolvedValue({
                ...mockCheckoutWithDetails,
                checkoutType: 'location',
                targetLocationName: 'Room 101'
            });

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'location',
                targetLocationId: 'location-1',
                checkedOutBy: 'admin-1'
            };

            const result = await service.checkoutAsset(dto);

            expect(result.checkoutType).toBe('location');
        });

        it('should throw error if target location not found', async () => {
            vi.mocked(mockRepository.findActiveByAssetId).mockResolvedValue(null);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'asset-1', status: 'available' }] })
                .mockResolvedValueOnce({ rows: [] });

            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'location',
                targetLocationId: 'non-existent',
                checkedOutBy: 'admin-1'
            };

            await expect(service.checkoutAsset(dto)).rejects.toThrow('Target location not found');
        });
    });

    // ==================== Checkin Asset Tests ====================

    describe('checkinAsset', () => {
        it('should checkin asset successfully', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);
            vi.mocked(mockRepository.checkin).mockResolvedValue(mockCheckedInCheckout);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [] });
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);
            vi.mocked(mockRepository.findByIdWithDetails).mockResolvedValue({
                ...mockCheckoutWithDetails,
                status: 'checked_in',
                checkinCondition: 'good',
                nextAction: 'available'
            });

            const dto: CheckinAssetDto = {
                checkoutId: 'checkout-1',
                checkinCondition: 'good',
                nextAction: 'available',
                checkedInBy: 'admin-1'
            };

            const result = await service.checkinAsset(dto);

            expect(result.status).toBe('checked_in');
            expect(mockRepository.checkin).toHaveBeenCalled();
            expect(mockRepository.commitTransaction).toHaveBeenCalled();
        });

        it('should throw error if checkout not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const dto: CheckinAssetDto = {
                checkoutId: 'non-existent',
                checkinCondition: 'good',
                nextAction: 'available',
                checkedInBy: 'admin-1'
            };

            await expect(service.checkinAsset(dto)).rejects.toThrow('Checkout record not found');
        });

        it('should throw error if asset not currently checked out (CHK-R05)', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckedInCheckout);

            const dto: CheckinAssetDto = {
                checkoutId: 'checkout-1',
                checkinCondition: 'good',
                nextAction: 'available',
                checkedInBy: 'admin-1'
            };

            await expect(service.checkinAsset(dto)).rejects.toThrow('Asset is not currently checked out');
        });

        it('should update asset to maintenance status when nextAction is maintenance', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);
            vi.mocked(mockRepository.checkin).mockResolvedValue({
                ...mockCheckedInCheckout,
                checkinCondition: 'damaged',
                nextAction: 'maintenance'
            });

            const updateAssetQuery = vi.mocked(mockClient.query as ReturnType<typeof vi.fn>);
            updateAssetQuery.mockResolvedValueOnce({ rows: [] });

            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);
            vi.mocked(mockRepository.findByIdWithDetails).mockResolvedValue({
                ...mockCheckoutWithDetails,
                status: 'checked_in',
                checkinCondition: 'damaged',
                nextAction: 'maintenance'
            });

            const dto: CheckinAssetDto = {
                checkoutId: 'checkout-1',
                checkinCondition: 'damaged',
                nextAction: 'maintenance',
                checkedInBy: 'admin-1'
            };

            await service.checkinAsset(dto);

            expect(updateAssetQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE assets'),
                ['maintenance', mockCheckout.assetId]
            );
        });
    });

    // ==================== Read Operations Tests ====================

    describe('getCheckout', () => {
        it('should return checkout when found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);

            const result = await service.getCheckout('checkout-1');

            expect(result?.id).toBe('checkout-1');
        });

        it('should return null when not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const result = await service.getCheckout('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getCheckoutWithDetails', () => {
        it('should return checkout with details', async () => {
            vi.mocked(mockRepository.findByIdWithDetails).mockResolvedValue(mockCheckoutWithDetails);

            const result = await service.getCheckoutWithDetails('checkout-1');

            expect(result?.assetTag).toBe('LAP-001');
            expect(result?.targetUserName).toBe('John Doe');
        });
    });

    describe('listCheckouts', () => {
        it('should return paginated list', async () => {
            vi.mocked(mockRepository.list).mockResolvedValue({
                data: [mockCheckoutWithDetails],
                pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
            });

            const result = await service.listCheckouts({});

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });
    });

    // ==================== Extension Tests ====================

    describe('extendCheckout', () => {
        const mockExtension: CheckoutExtension = {
            id: 'ext-1',
            checkoutId: 'checkout-1',
            previousExpectedDate: '2025-01-31',
            newExpectedDate: '2025-02-15',
            extensionReason: 'Project extended',
            extendedBy: 'admin-1',
            extendedAt: new Date(),
            notes: null
        };

        it('should extend checkout successfully', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);
            vi.mocked(mockRepository.createExtension).mockResolvedValue(mockExtension);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);

            // Use a future date
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 1);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const dto: ExtendCheckoutDto = {
                checkoutId: 'checkout-1',
                newExpectedDate: futureDateStr,
                extensionReason: 'Project extended',
                extendedBy: 'admin-1'
            };

            const result = await service.extendCheckout(dto);

            expect(result.newExpectedDate).toBe('2025-02-15');
            expect(mockRepository.createExtension).toHaveBeenCalled();
            expect(mockRepository.commitTransaction).toHaveBeenCalled();
        });

        it('should throw error if checkout not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const dto: ExtendCheckoutDto = {
                checkoutId: 'non-existent',
                newExpectedDate: '2025-02-15',
                extendedBy: 'admin-1'
            };

            await expect(service.extendCheckout(dto)).rejects.toThrow('Checkout record not found');
        });

        it('should throw error if checkout not active', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckedInCheckout);

            const dto: ExtendCheckoutDto = {
                checkoutId: 'checkout-1',
                newExpectedDate: '2025-02-15',
                extendedBy: 'admin-1'
            };

            await expect(service.extendCheckout(dto)).rejects.toThrow(
                'Cannot extend a checkout that is not active'
            );
        });

        it('should throw error if new date is not in future', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);

            const dto: ExtendCheckoutDto = {
                checkoutId: 'checkout-1',
                newExpectedDate: '2020-01-01', // Past date
                extendedBy: 'admin-1'
            };

            await expect(service.extendCheckout(dto)).rejects.toThrow(
                'New expected date must be in the future'
            );
        });
    });

    // ==================== Transfer Tests ====================

    describe('transferAsset', () => {
        const mockTransfer: CheckoutTransfer = {
            id: 'transfer-1',
            originalCheckoutId: 'checkout-1',
            newCheckoutId: 'checkout-2',
            fromUserId: 'user-1',
            toUserId: 'user-2',
            transferReason: 'Team change',
            transferredBy: 'admin-1',
            transferredAt: new Date(),
            notes: null
        };

        const newCheckout: AssetCheckout = {
            ...mockCheckout,
            id: 'checkout-2',
            checkoutCode: 'CHK-000002',
            targetUserId: 'user-2'
        };

        it('should transfer asset successfully (CHK-R07)', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'user-2', name: 'Jane Doe', is_active: true }] });
            vi.mocked(mockRepository.createTransfer).mockResolvedValue({
                transfer: mockTransfer,
                newCheckout
            });
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'user-2',
                transferReason: 'Team change',
                transferredBy: 'admin-1'
            };

            const result = await service.transferAsset(dto);

            expect(result.transfer.fromUserId).toBe('user-1');
            expect(result.transfer.toUserId).toBe('user-2');
            expect(result.newCheckout.targetUserId).toBe('user-2');
            expect(mockRepository.commitTransaction).toHaveBeenCalled();
        });

        it('should throw error if checkout not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const dto: TransferAssetDto = {
                checkoutId: 'non-existent',
                toUserId: 'user-2',
                transferredBy: 'admin-1'
            };

            await expect(service.transferAsset(dto)).rejects.toThrow('Checkout record not found');
        });

        it('should throw error if checkout not active', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckedInCheckout);

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'user-2',
                transferredBy: 'admin-1'
            };

            await expect(service.transferAsset(dto)).rejects.toThrow(
                'Cannot transfer a checkout that is not active'
            );
        });

        it('should throw error if checkout is not user type', async () => {
            const locationCheckout = { ...mockCheckout, checkoutType: 'location' as const };
            vi.mocked(mockRepository.findById).mockResolvedValue(locationCheckout);

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'user-2',
                transferredBy: 'admin-1'
            };

            await expect(service.transferAsset(dto)).rejects.toThrow(
                'Transfers are only supported for user checkouts'
            );
        });

        it('should throw error if transferring to same user', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'user-1', // Same as current user
                transferredBy: 'admin-1'
            };

            await expect(service.transferAsset(dto)).rejects.toThrow(
                'Cannot transfer to the same user'
            );
        });

        it('should throw error if target user not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [] });

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'non-existent',
                transferredBy: 'admin-1'
            };

            await expect(service.transferAsset(dto)).rejects.toThrow('Target user not found');
        });

        it('should throw error if target user is inactive', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockCheckout);
            vi.mocked(mockClient.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ rows: [{ id: 'user-2', is_active: false }] });

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'user-2',
                transferredBy: 'admin-1'
            };

            await expect(service.transferAsset(dto)).rejects.toThrow(
                'Cannot transfer to inactive user'
            );
        });
    });

    // ==================== Overdue Tests ====================

    describe('getOverdueCheckouts', () => {
        it('should return list of overdue checkouts', async () => {
            const overdueList = [{
                checkoutId: 'checkout-1',
                checkoutCode: 'CHK-000001',
                assetId: 'asset-1',
                assetTag: 'LAP-001',
                assetName: 'Dell Laptop',
                targetUserId: 'user-1',
                targetUserName: 'John Doe',
                targetUserEmail: 'john@example.com',
                expectedCheckinDate: '2025-01-01',
                daysOverdue: 14,
                notificationCount: 2,
                lastNotifiedAt: new Date()
            }];

            vi.mocked(mockRepository.getOverdueCheckouts).mockResolvedValue(overdueList);

            const result = await service.getOverdueCheckouts();

            expect(result).toHaveLength(1);
            expect(result[0].daysOverdue).toBe(14);
        });
    });

    describe('processOverdueCheckouts', () => {
        it('should process overdue checkouts and send notifications (CHK-R06)', async () => {
            const overdueList = [{
                checkoutId: 'checkout-1',
                checkoutCode: 'CHK-000001',
                assetId: 'asset-1',
                assetTag: 'LAP-001',
                assetName: 'Dell Laptop',
                targetUserId: 'user-1',
                targetUserName: 'John Doe',
                targetUserEmail: 'john@example.com',
                expectedCheckinDate: '2025-01-01',
                daysOverdue: 14,
                notificationCount: 2,
                lastNotifiedAt: new Date()
            }];

            vi.mocked(mockRepository.updateOverdueStatus).mockResolvedValue(1);
            vi.mocked(mockRepository.getOverdueCheckouts).mockResolvedValue(overdueList);
            vi.mocked(mockRepository.markAsOverdue).mockResolvedValue(1);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(mockAuditLog);

            const result = await service.processOverdueCheckouts();

            expect(result.processed).toBe(1);
            expect(result.notificationsSent).toBe(1);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(mockRepository.updateOverdueStatus).mockRejectedValue(new Error('DB error'));

            const result = await service.processOverdueCheckouts();

            expect(result.errors).toContain('DB error');
        });
    });

    // ==================== Summary Tests ====================

    describe('getSummary', () => {
        it('should return checkout summary', async () => {
            const summary = {
                totalActive: 10,
                byType: { user: 7, location: 2, asset: 1 },
                byStatus: { onTrack: 5, dueSoon: 2, overdue: 1, indefinite: 2 },
                avgCheckoutDays: 14,
                totalOverdue: 1
            };

            vi.mocked(mockRepository.getSummary).mockResolvedValue(summary);

            const result = await service.getSummary();

            expect(result.totalActive).toBe(10);
            expect(result.byType.user).toBe(7);
        });
    });

    // ==================== Audit Log Tests ====================

    describe('getAuditLogs', () => {
        it('should return audit logs', async () => {
            const logs = [{
                id: 'log-1',
                checkoutId: 'checkout-1',
                assetId: 'asset-1',
                action: 'Asset checked out',
                actionType: 'checkout',
                oldValues: null,
                newValues: {},
                performedBy: 'admin-1',
                performedAt: new Date(),
                ipAddress: null,
                userAgent: null,
                notes: null
            }];

            vi.mocked(mockRepository.getAuditLogs).mockResolvedValue(logs);

            const result = await service.getAuditLogs('checkout-1');

            expect(result).toHaveLength(1);
            expect(result[0].action).toBe('Asset checked out');
        });
    });
});
