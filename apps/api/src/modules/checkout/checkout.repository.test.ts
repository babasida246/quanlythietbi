/**
 * Checkout Repository - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { CheckoutRepository } from './checkout.repository.js';
import {
    CheckoutAssetDto,
    CheckinAssetDto,
    ExtendCheckoutDto,
    TransferAssetDto
} from './checkout.types.js';

// Mock Pool
const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockRelease = vi.fn();

const mockClient: Partial<PoolClient> = {
    query: mockQuery,
    release: mockRelease
};

const mockPool = {
    query: mockQuery,
    connect: mockConnect
} as unknown as Pool;

describe('CheckoutRepository', () => {
    let repository: CheckoutRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new CheckoutRepository(mockPool);
        mockConnect.mockResolvedValue(mockClient);
    });

    // ==================== Checkout CRUD Tests ====================

    describe('checkout', () => {
        it('should create a checkout record and return it', async () => {
            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'user',
                targetUserId: 'user-1',
                expectedCheckinDate: '2025-01-31',
                checkedOutBy: 'admin-1'
            };

            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                target_location_id: null,
                target_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: '2025-01-31',
                checked_out_by: 'admin-1',
                checkout_notes: null,
                checkin_date: null,
                checked_in_by: null,
                checkin_notes: null,
                checkin_condition: null,
                next_action: null,
                status: 'checked_out',
                is_overdue: false,
                overdue_notified_at: null,
                overdue_notification_count: 0,
                organization_id: null,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.checkout(dto);

            expect(result.id).toBe('checkout-1');
            expect(result.checkoutCode).toBe('CHK-000001');
            expect(result.assetId).toBe('asset-1');
            expect(result.checkoutType).toBe('user');
            expect(result.targetUserId).toBe('user-1');
            expect(result.status).toBe('checked_out');
            expect(mockQuery).toHaveBeenCalledTimes(1);
        });

        it('should create a location checkout', async () => {
            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'location',
                targetLocationId: 'location-1',
                checkedOutBy: 'admin-1'
            };

            const mockRow = {
                id: 'checkout-2',
                checkout_code: 'CHK-000002',
                asset_id: 'asset-1',
                checkout_type: 'location',
                target_user_id: null,
                target_location_id: 'location-1',
                target_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: null,
                checked_out_by: 'admin-1',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.checkout(dto);

            expect(result.checkoutType).toBe('location');
            expect(result.targetLocationId).toBe('location-1');
            expect(result.targetUserId).toBeNull();
        });

        it('should create an asset-to-asset checkout', async () => {
            const dto: CheckoutAssetDto = {
                assetId: 'asset-1',
                checkoutType: 'asset',
                targetAssetId: 'docking-station-1',
                checkedOutBy: 'admin-1'
            };

            const mockRow = {
                id: 'checkout-3',
                checkout_code: 'CHK-000003',
                asset_id: 'asset-1',
                checkout_type: 'asset',
                target_user_id: null,
                target_location_id: null,
                target_asset_id: 'docking-station-1',
                checkout_date: new Date(),
                expected_checkin_date: null,
                checked_out_by: 'admin-1',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.checkout(dto);

            expect(result.checkoutType).toBe('asset');
            expect(result.targetAssetId).toBe('docking-station-1');
        });
    });

    describe('checkin', () => {
        it('should update checkout to checked_in status', async () => {
            const dto: CheckinAssetDto = {
                checkoutId: 'checkout-1',
                checkinCondition: 'good',
                nextAction: 'available',
                checkinNotes: 'Returned in good condition',
                checkedInBy: 'admin-1'
            };

            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                checkout_date: new Date('2025-01-01'),
                expected_checkin_date: '2025-01-31',
                checked_out_by: 'admin-1',
                checkin_date: new Date(),
                checked_in_by: 'admin-1',
                checkin_notes: 'Returned in good condition',
                checkin_condition: 'good',
                next_action: 'available',
                status: 'checked_in',
                is_overdue: false,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.checkin(dto);

            expect(result).not.toBeNull();
            expect(result?.status).toBe('checked_in');
            expect(result?.checkinCondition).toBe('good');
            expect(result?.nextAction).toBe('available');
        });

        it('should return null if checkout not found or not active', async () => {
            const dto: CheckinAssetDto = {
                checkoutId: 'non-existent',
                checkinCondition: 'good',
                nextAction: 'available',
                checkedInBy: 'admin-1'
            };

            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.checkin(dto);

            expect(result).toBeNull();
        });

        it('should handle damaged condition with maintenance next action', async () => {
            const dto: CheckinAssetDto = {
                checkoutId: 'checkout-1',
                checkinCondition: 'damaged',
                nextAction: 'maintenance',
                checkinNotes: 'Screen cracked',
                checkedInBy: 'admin-1'
            };

            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                checkin_date: new Date(),
                checked_in_by: 'admin-1',
                checkin_notes: 'Screen cracked',
                checkin_condition: 'damaged',
                next_action: 'maintenance',
                status: 'checked_in',
                is_overdue: false,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.checkin(dto);

            expect(result?.checkinCondition).toBe('damaged');
            expect(result?.nextAction).toBe('maintenance');
        });
    });

    describe('findById', () => {
        it('should return checkout when found', async () => {
            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                target_location_id: null,
                target_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: '2025-01-31',
                checked_out_by: 'admin-1',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findById('checkout-1');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('checkout-1');
            expect(result?.checkoutCode).toBe('CHK-000001');
        });

        it('should return null when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByIdWithDetails', () => {
        it('should return checkout with asset and user details', async () => {
            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                target_location_id: null,
                target_asset_id: null,
                checkout_date: new Date(),
                expected_checkin_date: '2025-02-15',
                checked_out_by: 'admin-1',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                asset_tag: 'LAP-001',
                asset_name: 'Dell Laptop',
                asset_category: 'Laptops',
                asset_serial_number: 'SN123456',
                target_user_name: 'John Doe',
                target_user_email: 'john@example.com',
                target_location_name: null,
                target_asset_tag: null,
                target_asset_name: null,
                checked_out_by_name: 'Admin User',
                checked_in_by_name: null,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findByIdWithDetails('checkout-1');

            expect(result).not.toBeNull();
            expect(result?.assetTag).toBe('LAP-001');
            expect(result?.assetName).toBe('Dell Laptop');
            expect(result?.targetUserName).toBe('John Doe');
            expect(result?.targetUserEmail).toBe('john@example.com');
            expect(result?.checkedOutByName).toBe('Admin User');
        });

        it('should return null when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.findByIdWithDetails('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByCode', () => {
        it('should return checkout when found by code', async () => {
            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findByCode('CHK-000001');

            expect(result).not.toBeNull();
            expect(result?.checkoutCode).toBe('CHK-000001');
        });
    });

    describe('findActiveByAssetId', () => {
        it('should return active checkout for asset', async () => {
            const mockRow = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findActiveByAssetId('asset-1');

            expect(result).not.toBeNull();
            expect(result?.assetId).toBe('asset-1');
            expect(result?.status).toBe('checked_out');
        });

        it('should return null when no active checkout', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.findActiveByAssetId('asset-1');

            expect(result).toBeNull();
        });
    });

    describe('list', () => {
        it('should return paginated list of checkouts', async () => {
            const mockCountRow = { total: '2' };
            const mockDataRows = [
                {
                    id: 'checkout-1',
                    checkout_code: 'CHK-000001',
                    asset_id: 'asset-1',
                    checkout_type: 'user',
                    target_user_id: 'user-1',
                    status: 'checked_out',
                    is_overdue: false,
                    overdue_notification_count: 0,
                    asset_tag: 'LAP-001',
                    asset_name: 'Dell Laptop',
                    target_user_name: 'John Doe',
                    target_user_email: 'john@example.com',
                    checked_out_by_name: 'Admin',
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    id: 'checkout-2',
                    checkout_code: 'CHK-000002',
                    asset_id: 'asset-2',
                    checkout_type: 'user',
                    target_user_id: 'user-2',
                    status: 'checked_out',
                    is_overdue: false,
                    overdue_notification_count: 0,
                    asset_tag: 'LAP-002',
                    asset_name: 'HP Laptop',
                    target_user_name: 'Jane Doe',
                    target_user_email: 'jane@example.com',
                    checked_out_by_name: 'Admin',
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: [mockCountRow] });
            mockQuery.mockResolvedValueOnce({ rows: mockDataRows });

            const result = await repository.list({ page: 1, limit: 10 });

            expect(result.data).toHaveLength(2);
            expect(result.pagination.total).toBe(2);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(10);
        });

        it('should filter by status', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await repository.list({ status: 'checked_out' });

            expect(mockQuery).toHaveBeenCalled();
            const countCall = mockQuery.mock.calls[0];
            // params[0] is an array containing ['checked_out']
            expect(countCall[1][0]).toContain('checked_out');
        });

        it('should filter by checkout type', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await repository.list({ checkoutType: 'location' });

            expect(mockQuery).toHaveBeenCalled();
        });

        it('should handle search query', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await repository.list({ search: 'laptop' });

            expect(mockQuery).toHaveBeenCalled();
            const countCall = mockQuery.mock.calls[0];
            expect(countCall[1]).toContain('%laptop%');
        });
    });

    // ==================== Extension Tests ====================

    describe('createExtension', () => {
        it('should create extension and update checkout', async () => {
            // Mock findById call
            const existingCheckout = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                expected_checkin_date: '2025-01-31',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            const extensionRow = {
                id: 'ext-1',
                checkout_id: 'checkout-1',
                previous_expected_date: '2025-01-31',
                new_expected_date: '2025-02-15',
                extension_reason: 'Project extended',
                extended_by: 'admin-1',
                extended_at: new Date(),
                notes: null
            };

            mockQuery.mockResolvedValueOnce({ rows: [existingCheckout] }); // findById
            mockQuery.mockResolvedValueOnce({ rows: [extensionRow] }); // INSERT extension
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE checkout

            const dto: ExtendCheckoutDto = {
                checkoutId: 'checkout-1',
                newExpectedDate: '2025-02-15',
                extensionReason: 'Project extended',
                extendedBy: 'admin-1'
            };

            const result = await repository.createExtension(dto);

            expect(result.id).toBe('ext-1');
            expect(result.previousExpectedDate).toBe('2025-01-31');
            expect(result.newExpectedDate).toBe('2025-02-15');
            expect(mockQuery).toHaveBeenCalledTimes(3);
        });

        it('should throw error if checkout not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] }); // findById returns empty

            const dto: ExtendCheckoutDto = {
                checkoutId: 'non-existent',
                newExpectedDate: '2025-02-15',
                extendedBy: 'admin-1'
            };

            await expect(repository.createExtension(dto)).rejects.toThrow('Checkout not found');
        });
    });

    describe('listExtensions', () => {
        it('should return paginated list of extensions', async () => {
            const mockCountRow = { total: '1' };
            const mockDataRows = [
                {
                    id: 'ext-1',
                    checkout_id: 'checkout-1',
                    previous_expected_date: '2025-01-31',
                    new_expected_date: '2025-02-15',
                    extension_reason: 'Project extended',
                    extended_by: 'admin-1',
                    extended_at: new Date(),
                    notes: null,
                    extended_by_name: 'Admin User',
                    checkout_code: 'CHK-000001',
                    asset_tag: 'LAP-001'
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: [mockCountRow] });
            mockQuery.mockResolvedValueOnce({ rows: mockDataRows });

            const result = await repository.listExtensions({});

            expect(result.data).toHaveLength(1);
            expect(result.data[0].previousExpectedDate).toBe('2025-01-31');
            expect(result.data[0].extendedByName).toBe('Admin User');
        });
    });

    // ==================== Transfer Tests ====================

    describe('createTransfer', () => {
        it('should create transfer with new checkout', async () => {
            // Mock findById for original checkout
            const originalCheckout = {
                id: 'checkout-1',
                checkout_code: 'CHK-000001',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-1',
                expected_checkin_date: '2025-01-31',
                status: 'checked_out',
                organization_id: 'org-1',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            const newCheckoutRow = {
                id: 'checkout-2',
                checkout_code: 'CHK-000002',
                asset_id: 'asset-1',
                checkout_type: 'user',
                target_user_id: 'user-2',
                expected_checkin_date: '2025-01-31',
                status: 'checked_out',
                is_overdue: false,
                overdue_notification_count: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            const transferRow = {
                id: 'transfer-1',
                original_checkout_id: 'checkout-1',
                new_checkout_id: 'checkout-2',
                from_user_id: 'user-1',
                to_user_id: 'user-2',
                transfer_reason: 'Team change',
                transferred_by: 'admin-1',
                transferred_at: new Date(),
                notes: null
            };

            mockQuery.mockResolvedValueOnce({ rows: [originalCheckout] }); // findById
            mockQuery.mockResolvedValueOnce({ rows: [newCheckoutRow] }); // INSERT new checkout
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE original (checkin)
            mockQuery.mockResolvedValueOnce({ rows: [transferRow] }); // INSERT transfer

            const dto: TransferAssetDto = {
                checkoutId: 'checkout-1',
                toUserId: 'user-2',
                transferReason: 'Team change',
                transferredBy: 'admin-1'
            };

            const result = await repository.createTransfer(dto);

            expect(result.transfer.id).toBe('transfer-1');
            expect(result.transfer.fromUserId).toBe('user-1');
            expect(result.transfer.toUserId).toBe('user-2');
            expect(result.newCheckout.id).toBe('checkout-2');
            expect(result.newCheckout.targetUserId).toBe('user-2');
        });

        it('should throw error if checkout not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] }); // findById returns empty

            const dto: TransferAssetDto = {
                checkoutId: 'non-existent',
                toUserId: 'user-2',
                transferredBy: 'admin-1'
            };

            await expect(repository.createTransfer(dto)).rejects.toThrow('Checkout not found');
        });
    });

    describe('listTransfers', () => {
        it('should return paginated list of transfers', async () => {
            const mockCountRow = { total: '1' };
            const mockDataRows = [
                {
                    id: 'transfer-1',
                    original_checkout_id: 'checkout-1',
                    new_checkout_id: 'checkout-2',
                    from_user_id: 'user-1',
                    to_user_id: 'user-2',
                    transfer_reason: 'Team change',
                    transferred_by: 'admin-1',
                    transferred_at: new Date(),
                    notes: null,
                    from_user_name: 'John Doe',
                    to_user_name: 'Jane Doe',
                    transferred_by_name: 'Admin User',
                    asset_tag: 'LAP-001',
                    asset_name: 'Dell Laptop'
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: [mockCountRow] });
            mockQuery.mockResolvedValueOnce({ rows: mockDataRows });

            const result = await repository.listTransfers({});

            expect(result.data).toHaveLength(1);
            expect(result.data[0].fromUserName).toBe('John Doe');
            expect(result.data[0].toUserName).toBe('Jane Doe');
        });
    });

    // ==================== Overdue Tests ====================

    describe('getOverdueCheckouts', () => {
        it('should return list of overdue checkouts', async () => {
            const mockRows = [
                {
                    checkout_id: 'checkout-1',
                    checkout_code: 'CHK-000001',
                    asset_id: 'asset-1',
                    asset_tag: 'LAP-001',
                    asset_name: 'Dell Laptop',
                    target_user_id: 'user-1',
                    target_user_name: 'John Doe',
                    target_user_email: 'john@example.com',
                    expected_checkin_date: '2025-01-01',
                    days_overdue: 14,
                    overdue_notification_count: 3,
                    overdue_notified_at: new Date()
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: mockRows });

            const result = await repository.getOverdueCheckouts();

            expect(result).toHaveLength(1);
            expect(result[0].daysOverdue).toBe(14);
            expect(result[0].notificationCount).toBe(3);
        });

        it('should return empty array when no overdue checkouts', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.getOverdueCheckouts();

            expect(result).toHaveLength(0);
        });
    });

    describe('markAsOverdue', () => {
        it('should update overdue status for given IDs', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'checkout-1' }, { id: 'checkout-2' }], rowCount: 2 });

            const result = await repository.markAsOverdue(['checkout-1', 'checkout-2']);

            expect(result).toBe(2);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('is_overdue = TRUE'),
                [['checkout-1', 'checkout-2']]
            );
        });

        it('should return 0 for empty array', async () => {
            const result = await repository.markAsOverdue([]);

            expect(result).toBe(0);
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('updateOverdueStatus', () => {
        it('should update overdue status for past-due checkouts', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'checkout-1' }], rowCount: 1 });

            const result = await repository.updateOverdueStatus();

            expect(result).toBe(1);
        });
    });

    // ==================== Summary Tests ====================

    describe('getSummary', () => {
        it('should return checkout summary statistics', async () => {
            const mockRow = {
                total_active: '10',
                by_user: '7',
                by_location: '2',
                by_asset: '1',
                total_overdue: '2',
                indefinite_count: '3',
                due_soon_count: '2',
                on_track_count: '3',
                avg_days: '14.5'
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.getSummary();

            expect(result.totalActive).toBe(10);
            expect(result.byType.user).toBe(7);
            expect(result.byType.location).toBe(2);
            expect(result.byType.asset).toBe(1);
            expect(result.totalOverdue).toBe(2);
            expect(result.byStatus.indefinite).toBe(3);
            expect(result.avgCheckoutDays).toBe(15); // rounded
        });

        it('should filter by organization', async () => {
            const mockRow = {
                total_active: '5',
                by_user: '4',
                by_location: '1',
                by_asset: '0',
                total_overdue: '1',
                indefinite_count: '1',
                due_soon_count: '1',
                on_track_count: '2',
                avg_days: '10'
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.getSummary('org-1');

            expect(result.totalActive).toBe(5);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('organization_id'),
                ['org-1']
            );
        });
    });

    // ==================== Audit Log Tests ====================

    describe('createAuditLog', () => {
        it('should create audit log entry', async () => {
            const mockRow = {
                id: 'log-1',
                checkout_id: 'checkout-1',
                asset_id: 'asset-1',
                action: 'Asset checked out',
                action_type: 'checkout',
                old_values: null,
                new_values: { targetUserId: 'user-1' },
                performed_by: 'admin-1',
                performed_at: new Date(),
                ip_address: null,
                user_agent: null,
                notes: null
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.createAuditLog({
                checkoutId: 'checkout-1',
                assetId: 'asset-1',
                action: 'Asset checked out',
                actionType: 'checkout',
                oldValues: null,
                newValues: { targetUserId: 'user-1' },
                performedBy: 'admin-1',
                ipAddress: null,
                userAgent: null,
                notes: null
            });

            expect(result.id).toBe('log-1');
            expect(result.action).toBe('Asset checked out');
            expect(result.actionType).toBe('checkout');
        });
    });

    describe('getAuditLogs', () => {
        it('should return audit logs for checkout', async () => {
            const mockRows = [
                {
                    id: 'log-1',
                    checkout_id: 'checkout-1',
                    asset_id: 'asset-1',
                    action: 'Asset checked out',
                    action_type: 'checkout',
                    old_values: null,
                    new_values: {},
                    performed_by: 'admin-1',
                    performed_at: new Date(),
                    ip_address: null,
                    user_agent: null,
                    notes: null
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: mockRows });

            const result = await repository.getAuditLogs('checkout-1');

            expect(result).toHaveLength(1);
            expect(result[0].checkoutId).toBe('checkout-1');
        });
    });

    // ==================== Transaction Support Tests ====================

    describe('transaction support', () => {
        it('should get client from pool', async () => {
            const client = await repository.getClient();

            expect(mockConnect).toHaveBeenCalled();
            expect(client).toBe(mockClient);
        });

        it('should begin transaction', async () => {
            const client = mockClient as PoolClient;
            mockQuery.mockResolvedValueOnce({});

            await repository.beginTransaction(client);

            expect(mockQuery).toHaveBeenCalledWith('BEGIN');
        });

        it('should commit transaction', async () => {
            const client = mockClient as PoolClient;
            mockQuery.mockResolvedValueOnce({});

            await repository.commitTransaction(client);

            expect(mockQuery).toHaveBeenCalledWith('COMMIT');
        });

        it('should rollback transaction', async () => {
            const client = mockClient as PoolClient;
            mockQuery.mockResolvedValueOnce({});

            await repository.rollbackTransaction(client);

            expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
        });

        it('should release client', () => {
            const client = mockClient as PoolClient;

            repository.releaseClient(client);

            expect(mockRelease).toHaveBeenCalled();
        });
    });
});
