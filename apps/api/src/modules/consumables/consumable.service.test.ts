/**
 * Consumable Service - Unit Tests
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ConsumableService } from './consumable.service.js';

// Mock Pool
function createMockPool() {
    const queryFn = vi.fn();
    const connectFn = vi.fn();

    const mockClient = {
        query: vi.fn(),
        release: vi.fn()
    };

    connectFn.mockResolvedValue(mockClient);

    return {
        query: queryFn,
        connect: connectFn,
        _queryFn: queryFn,
        _client: mockClient
    };
}

describe('ConsumableService', () => {
    let service: ConsumableService;
    let mockPool: ReturnType<typeof createMockPool>;
    let queryFn: Mock;

    const mockConsumableRow = {
        id: 'con-001',
        consumable_code: 'CON-202601-0001',
        name: 'HP Ink Cartridge',
        category_id: 'cat-001',
        manufacturer_id: 'mfr-001',
        model_number: 'HP950XL',
        part_number: 'CN045AN',
        image_url: null,
        unit_of_measure: 'unit',
        quantity: 50,
        min_quantity: 10,
        unit_price: 1500000,
        currency: 'VND',
        supplier_id: null,
        purchase_order: null,
        purchase_date: null,
        location_id: null,
        location_name: 'Warehouse A',
        notes: 'Black ink cartridge',
        organization_id: 'org-001',
        status: 'active',
        created_by: 'user-001',
        updated_by: 'user-001',
        created_at: new Date(),
        updated_at: new Date()
    };

    const mockConsumableWithDetailsRow = {
        ...mockConsumableRow,
        category_name: 'Ink & Toner',
        manufacturer_name: 'HP',
        supplier_name: null,
        total_issued: 20,
        stock_status: 'in_stock'
    };

    const mockIssueRow = {
        id: 'iss-001',
        consumable_id: 'con-001',
        quantity: 5,
        issue_type: 'user',
        issued_to_user_id: 'user-002',
        issued_to_department: null,
        issued_to_asset_id: null,
        issue_date: new Date(),
        issued_by: 'user-001',
        reference_number: null,
        notes: 'For printer',
        created_at: new Date(),
        updated_at: new Date()
    };

    const mockReceiptRow = {
        id: 'rec-001',
        consumable_id: 'con-001',
        quantity: 20,
        receipt_type: 'purchase',
        purchase_order: 'PO-001',
        unit_cost: 1500000,
        total_cost: 30000000,
        receipt_date: new Date(),
        supplier_id: null,
        invoice_number: 'INV-001',
        received_by: 'user-001',
        notes: 'Monthly restock',
        created_at: new Date(),
        updated_at: new Date()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPool = createMockPool();
        queryFn = mockPool._queryFn;
        service = new ConsumableService(mockPool as any);
    });

    // ==================== Consumable CRUD Tests ====================

    describe('createConsumable', () => {
        it('should create a consumable successfully', async () => {
            // Mock generateConsumableCode query - returns no existing codes
            queryFn.mockResolvedValueOnce({ rows: [] });
            // Mock create query
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableRow] });
            // Mock audit log insert
            queryFn.mockResolvedValueOnce({ rows: [] });
            // Mock findByIdWithDetails for return
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableWithDetailsRow] });

            const result = await service.createConsumable({
                name: 'HP Ink Cartridge',
                categoryId: 'cat-001',
                manufacturerId: 'mfr-001',
                unitOfMeasure: 'unit',
                quantity: 50,
                minQuantity: 10
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.name).toBe('HP Ink Cartridge');
        });
    });

    describe('getConsumable', () => {
        it('should return consumable with details', async () => {
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableWithDetailsRow] });

            const result = await service.getConsumable('con-001');

            expect(result).toBeDefined();
            expect(result?.categoryName).toBe('Ink & Toner');
            expect(result?.manufacturerName).toBe('HP');
            expect(result?.totalIssued).toBe(20);
        });

        it('should return null for non-existent consumable', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.getConsumable('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('listConsumables', () => {
        it('should return paginated consumables', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableWithDetailsRow] });

            const result = await service.listConsumables({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });

        it('should filter by status', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            queryFn.mockResolvedValueOnce({ rows: [] });

            await service.listConsumables({ status: ['active'] });

            expect(queryFn).toHaveBeenCalled();
        });
    });

    describe('updateConsumable', () => {
        it('should update consumable successfully', async () => {
            // Mock findById
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableRow] });
            // Mock update
            queryFn.mockResolvedValueOnce({ rows: [{ ...mockConsumableRow, name: 'Updated Ink' }] });
            // Mock audit log
            queryFn.mockResolvedValueOnce({ rows: [] });
            // Mock findByIdWithDetails
            queryFn.mockResolvedValueOnce({ rows: [{ ...mockConsumableWithDetailsRow, name: 'Updated Ink' }] });

            const result = await service.updateConsumable('con-001', { name: 'Updated Ink' }, 'user-001');

            expect(result).toBeDefined();
            expect(result?.name).toBe('Updated Ink');
        });

        it('should return null for non-existent consumable', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.updateConsumable('non-existent', { name: 'Test' }, 'user-001');

            expect(result).toBeNull();
        });
    });

    describe('deleteConsumable', () => {
        it('should delete consumable successfully', async () => {
            // Mock findById
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableRow] });
            // Mock getIssues count (no issues)
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            queryFn.mockResolvedValueOnce({ rows: [] });
            // Mock delete
            queryFn.mockResolvedValueOnce({ rows: [{ id: 'con-001' }], rowCount: 1 });
            // Mock audit log
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.deleteConsumable('con-001', 'user-001');

            expect(result).toBe(true);
        });

        it('should throw error when consumable not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            await expect(service.deleteConsumable('non-existent', 'user-001'))
                .rejects.toThrow('Consumable not found');
        });

        it('should throw error when consumable has issue history', async () => {
            // Mock findById
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableRow] });
            // Mock getIssues count (has issues)
            queryFn.mockResolvedValueOnce({ rows: [{ total: '5' }] });
            queryFn.mockResolvedValueOnce({ rows: [mockIssueRow] });

            await expect(service.deleteConsumable('con-001', 'user-001'))
                .rejects.toThrow('Cannot delete consumable with existing issue history');
        });
    });

    // ==================== Issue Tests ====================

    describe('issueConsumable', () => {
        it('should issue consumable successfully', async () => {
            const mockClient = mockPool._client;

            // Mock findById
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableRow] });

            // Mock transaction
            mockClient.query.mockResolvedValueOnce({}); // BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 45 }], rowCount: 1 }); // UPDATE
            mockClient.query.mockResolvedValueOnce({ rows: [mockIssueRow] }); // INSERT
            mockClient.query.mockResolvedValueOnce({}); // COMMIT

            // Mock audit log
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.issueConsumable('con-001', {
                quantity: 5,
                issueType: 'user',
                issuedToUserId: 'user-002',
                notes: 'For printer'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.quantity).toBe(5);
        });

        it('should throw error when consumable not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            await expect(service.issueConsumable('non-existent', {
                quantity: 5,
                issueType: 'user',
                issuedToUserId: 'user-002'
            }, 'user-001')).rejects.toThrow('Consumable not found');
        });

        it('should throw error when consumable is inactive', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ ...mockConsumableRow, status: 'inactive' }] });

            await expect(service.issueConsumable('con-001', {
                quantity: 5,
                issueType: 'user',
                issuedToUserId: 'user-002'
            }, 'user-001')).rejects.toThrow('Cannot issue: Consumable status is inactive');
        });

        it('should throw error when quantity exceeds available', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ ...mockConsumableRow, quantity: 3 }] });

            await expect(service.issueConsumable('con-001', {
                quantity: 5,
                issueType: 'user',
                issuedToUserId: 'user-002'
            }, 'user-001')).rejects.toThrow('Cannot issue: Requested 5 but only 3 available');
        });

        it('should throw error when consumable is out of stock', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ ...mockConsumableRow, quantity: 0 }] });

            await expect(service.issueConsumable('con-001', {
                quantity: 5,
                issueType: 'user',
                issuedToUserId: 'user-002'
            }, 'user-001')).rejects.toThrow('Cannot issue: Requested 5 but only 0 available');
        });
    });

    describe('getIssues', () => {
        it('should return paginated issues', async () => {
            const mockIssueWithDetails = {
                ...mockIssueRow,
                consumable_name: 'HP Ink',
                consumable_code: 'CON-001',
                user_name: 'John Doe',
                asset_tag: null
            };

            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: [mockIssueWithDetails] });

            const result = await service.getIssues({ consumableId: 'con-001' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].consumableName).toBe('HP Ink');
        });
    });

    describe('getConsumableIssues', () => {
        it('should return issues for specific consumable', async () => {
            const mockIssueWithDetails = {
                ...mockIssueRow,
                consumable_name: 'HP Ink',
                consumable_code: 'CON-001',
                user_name: 'John Doe',
                asset_tag: null
            };

            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: [mockIssueWithDetails] });

            const result = await service.getConsumableIssues('con-001', {});

            expect(result.data).toHaveLength(1);
        });
    });

    // ==================== Receipt Tests ====================

    describe('receiveConsumable', () => {
        it('should receive consumable successfully', async () => {
            const mockClient = mockPool._client;

            // Mock findById
            queryFn.mockResolvedValueOnce({ rows: [mockConsumableRow] });

            // Mock transaction
            mockClient.query.mockResolvedValueOnce({}); // BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 70 }], rowCount: 1 }); // UPDATE
            mockClient.query.mockResolvedValueOnce({ rows: [mockReceiptRow] }); // INSERT
            mockClient.query.mockResolvedValueOnce({}); // COMMIT

            // Mock audit log
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.receiveConsumable('con-001', {
                quantity: 20,
                receiptType: 'purchase',
                purchaseOrder: 'PO-001',
                unitCost: 1500000,
                invoiceNumber: 'INV-001',
                notes: 'Monthly restock'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.quantity).toBe(20);
        });

        it('should throw error when consumable not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            await expect(service.receiveConsumable('non-existent', {
                quantity: 20,
                receiptType: 'purchase'
            }, 'user-001')).rejects.toThrow('Consumable not found');
        });
    });

    describe('getReceipts', () => {
        it('should return paginated receipts', async () => {
            const mockReceiptWithDetails = {
                ...mockReceiptRow,
                consumable_name: 'HP Ink',
                consumable_code: 'CON-001',
                supplier_name: null
            };

            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: [mockReceiptWithDetails] });

            const result = await service.getReceipts({ consumableId: 'con-001' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].consumableName).toBe('HP Ink');
        });
    });

    // ==================== Stock Alerts Tests ====================

    describe('getLowStockItems', () => {
        it('should return low stock items', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{
                    id: 'con-001',
                    consumable_code: 'CON-001',
                    name: 'HP Ink',
                    quantity: 5,
                    min_quantity: 10,
                    deficit: 5,
                    unit_of_measure: 'unit'
                }]
            });

            const result = await service.getLowStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].deficit).toBe(5);
        });
    });

    describe('getOutOfStockItems', () => {
        it('should return out of stock items', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{
                    id: 'con-002',
                    consumable_code: 'CON-002',
                    name: 'Canon Ink',
                    quantity: 0,
                    min_quantity: 5,
                    deficit: 5,
                    unit_of_measure: 'unit'
                }]
            });

            const result = await service.getOutOfStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].quantity).toBe(0);
        });
    });

    describe('getStockSummary', () => {
        it('should return stock summary', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{
                    total_items: '100',
                    in_stock: '80',
                    low_stock: '15',
                    out_of_stock: '5',
                    total_value: '150000000'
                }]
            });

            const result = await service.getStockSummary();

            expect(result.totalItems).toBe(100);
            expect(result.inStock).toBe(80);
        });
    });

    // ==================== Categories Tests ====================

    describe('getCategories', () => {
        it('should return categories', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{ id: 'cat-001', code: 'INK', name: 'Ink & Toner', description: null, parent_id: null, is_active: true, created_at: new Date(), updated_at: new Date() }]
            });

            const result = await service.getCategories();

            expect(result).toHaveLength(1);
        });
    });

    describe('getCategory', () => {
        it('should return category when found', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{ id: 'cat-001', code: 'INK', name: 'Ink & Toner', description: null, parent_id: null, is_active: true, created_at: new Date(), updated_at: new Date() }]
            });

            const result = await service.getCategory('cat-001');

            expect(result).toBeDefined();
            expect(result?.name).toBe('Ink & Toner');
        });

        it('should return null when category not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.getCategory('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createCategory', () => {
        it('should create category successfully', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{ id: 'cat-002', code: 'PAPER', name: 'Paper', description: null, parent_id: null, is_active: true, created_at: new Date(), updated_at: new Date() }]
            });
            queryFn.mockResolvedValueOnce({ rows: [] }); // audit log

            const result = await service.createCategory({
                code: 'PAPER',
                name: 'Paper'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.code).toBe('PAPER');
        });
    });

    // ==================== Manufacturers Tests ====================

    describe('getManufacturers', () => {
        it('should return manufacturers', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{ id: 'mfr-001', code: 'HP', name: 'HP Inc.', website: null, support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_at: new Date(), updated_at: new Date() }]
            });

            const result = await service.getManufacturers();

            expect(result).toHaveLength(1);
        });
    });

    describe('getManufacturer', () => {
        it('should return manufacturer when found', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{ id: 'mfr-001', code: 'HP', name: 'HP Inc.', website: null, support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_at: new Date(), updated_at: new Date() }]
            });

            const result = await service.getManufacturer('mfr-001');

            expect(result).toBeDefined();
            expect(result?.name).toBe('HP Inc.');
        });

        it('should return null when manufacturer not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await service.getManufacturer('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createManufacturer', () => {
        it('should create manufacturer successfully', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{ id: 'mfr-002', code: 'CANON', name: 'Canon Inc.', website: null, support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_at: new Date(), updated_at: new Date() }]
            });
            queryFn.mockResolvedValueOnce({ rows: [] }); // audit log

            const result = await service.createManufacturer({
                code: 'CANON',
                name: 'Canon Inc.'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.code).toBe('CANON');
        });
    });

    // ==================== Audit Logs Tests ====================

    describe('getAuditLogs', () => {
        it('should return paginated audit logs', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({
                rows: [{
                    id: 'log-001',
                    entity_type: 'consumable',
                    entity_id: 'con-001',
                    action: 'CREATE',
                    changes: null,
                    performed_by: 'user-001',
                    performed_at: new Date(),
                    ip_address: null,
                    user_agent: null,
                    notes: null
                }]
            });

            const result = await service.getAuditLogs({});

            expect(result.data).toHaveLength(1);
        });
    });
});
