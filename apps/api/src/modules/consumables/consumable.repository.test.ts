/**
 * Consumable Repository - Unit Tests
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ConsumableRepository } from './consumable.repository.js';

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

describe('ConsumableRepository', () => {
    let repo: ConsumableRepository;
    let mockPool: ReturnType<typeof createMockPool>;
    let queryFn: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPool = createMockPool();
        queryFn = mockPool._queryFn;
        repo = new ConsumableRepository(mockPool as any);
    });

    describe('create', () => {
        it('should create a new consumable with all fields', async () => {
            const mockConsumable = {
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
                supplier_id: 'sup-001',
                purchase_order: 'PO-001',
                purchase_date: '2024-01-01',
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

            // Mock generateConsumableCode - returns no existing codes
            queryFn.mockResolvedValueOnce({ rows: [] });
            // Mock insert
            queryFn.mockResolvedValueOnce({ rows: [mockConsumable] });

            const result = await repo.create({
                name: 'HP Ink Cartridge',
                categoryId: 'cat-001',
                manufacturerId: 'mfr-001',
                modelNumber: 'HP950XL',
                partNumber: 'CN045AN',
                unitOfMeasure: 'unit',
                quantity: 50,
                minQuantity: 10,
                unitPrice: 1500000,
                currency: 'VND',
                locationName: 'Warehouse A',
                notes: 'Black ink cartridge',
                organizationId: 'org-001'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.name).toBe('HP Ink Cartridge');
            expect(result.quantity).toBe(50);
            expect(result.status).toBe('active');
        });
    });

    describe('findById', () => {
        it('should return consumable when found', async () => {
            const mockConsumable = {
                id: 'con-001',
                consumable_code: 'CON-001',
                name: 'HP Ink',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                part_number: null,
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
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            };

            queryFn.mockResolvedValueOnce({ rows: [mockConsumable] });

            const result = await repo.findById('con-001');

            expect(result).toBeDefined();
            expect(result?.id).toBe('con-001');
            expect(result?.name).toBe('HP Ink');
        });

        it('should return null when not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await repo.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByIdWithDetails', () => {
        it('should return consumable with related details', async () => {
            const mockRow = {
                id: 'con-001',
                consumable_code: 'CON-001',
                name: 'HP Ink',
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
                notes: null,
                organization_id: 'org-001',
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date(),
                category_name: 'Ink & Toner',
                manufacturer_name: 'HP',
                supplier_name: null,
                total_issued: 20,
                stock_status: 'in_stock'
            };

            queryFn.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repo.findByIdWithDetails('con-001');

            expect(result).toBeDefined();
            expect(result?.categoryName).toBe('Ink & Toner');
            expect(result?.manufacturerName).toBe('HP');
            expect(result?.totalIssued).toBe(20);
            expect(result?.stockStatus).toBe('in_stock');
        });
    });

    describe('findByCode', () => {
        it('should return consumable when found by code', async () => {
            const mockConsumable = {
                id: 'con-001',
                consumable_code: 'CON-202601-0001',
                name: 'HP Ink',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                part_number: null,
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
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            };

            queryFn.mockResolvedValueOnce({ rows: [mockConsumable] });

            const result = await repo.findByCode('CON-202601-0001');

            expect(result).toBeDefined();
            expect(result?.consumableCode).toBe('CON-202601-0001');
        });

        it('should return null when code not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await repo.findByCode('NON-EXISTENT');

            expect(result).toBeNull();
        });
    });

    describe('list', () => {
        it('should return paginated consumables', async () => {
            const mockRows = [
                {
                    id: 'con-001',
                    consumable_code: 'CON-001',
                    name: 'HP Ink',
                    category_id: null,
                    manufacturer_id: null,
                    model_number: null,
                    part_number: null,
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
                    location_name: null,
                    notes: null,
                    organization_id: null,
                    status: 'active',
                    created_by: 'user-001',
                    updated_by: 'user-001',
                    created_at: new Date(),
                    updated_at: new Date(),
                    category_name: null,
                    manufacturer_name: null,
                    supplier_name: null,
                    total_issued: 0,
                    stock_status: 'in_stock'
                }
            ];

            // Count query
            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            // Data query
            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.list({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.page).toBe(1);
        });

        it('should filter by status', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            queryFn.mockResolvedValueOnce({ rows: [] });

            await repo.list({ status: ['active'] });

            expect(queryFn).toHaveBeenCalled();
            const callArgs = queryFn.mock.calls[0];
            // Status is passed as an array
            expect(callArgs[1]).toContainEqual(['active']);
        });

        it('should filter by stockStatus', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            queryFn.mockResolvedValueOnce({ rows: [] });

            await repo.list({ stockStatus: 'low_stock' });

            expect(queryFn).toHaveBeenCalled();
        });

        it('should search by name or code', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            queryFn.mockResolvedValueOnce({ rows: [] });

            await repo.list({ search: 'ink' });

            expect(queryFn).toHaveBeenCalled();
            const callArgs = queryFn.mock.calls[0];
            expect(callArgs[1]).toContain('%ink%');
        });
    });

    describe('update', () => {
        it('should update consumable fields', async () => {
            const mockConsumable = {
                id: 'con-001',
                consumable_code: 'CON-001',
                name: 'Updated Ink',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                part_number: null,
                image_url: null,
                unit_of_measure: 'unit',
                quantity: 50,
                min_quantity: 15,
                unit_price: 1500000,
                currency: 'VND',
                supplier_id: null,
                purchase_order: null,
                purchase_date: null,
                location_id: null,
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-002',
                created_at: new Date(),
                updated_at: new Date()
            };

            queryFn.mockResolvedValueOnce({ rows: [mockConsumable] });

            const result = await repo.update('con-001', {
                name: 'Updated Ink',
                minQuantity: 15
            }, 'user-002');

            expect(result).toBeDefined();
            expect(result?.name).toBe('Updated Ink');
        });

        it('should return existing when no fields to update', async () => {
            const mockConsumable = {
                id: 'con-001',
                consumable_code: 'CON-001',
                name: 'HP Ink',
                category_id: null,
                manufacturer_id: null,
                model_number: null,
                part_number: null,
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
                location_name: null,
                notes: null,
                organization_id: null,
                status: 'active',
                created_by: 'user-001',
                updated_by: 'user-001',
                created_at: new Date(),
                updated_at: new Date()
            };

            queryFn.mockResolvedValueOnce({ rows: [mockConsumable] });

            const result = await repo.update('con-001', {}, 'user-002');

            expect(result).toBeDefined();
        });
    });

    describe('delete', () => {
        it('should delete consumable and return true', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ id: 'con-001' }], rowCount: 1 });

            const result = await repo.delete('con-001');

            expect(result).toBe(true);
        });

        it('should return false when consumable not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [], rowCount: 0 });

            const result = await repo.delete('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('issue', () => {
        it('should issue consumable and create issue record', async () => {
            const mockClient = mockPool._client;
            const mockIssue = {
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
                notes: 'For printer replacement',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockClient.query.mockResolvedValueOnce({}); // BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 45 }], rowCount: 1 }); // UPDATE
            mockClient.query.mockResolvedValueOnce({ rows: [mockIssue] }); // INSERT
            mockClient.query.mockResolvedValueOnce({}); // COMMIT

            const result = await repo.issue('con-001', {
                consumableId: 'con-001',
                quantity: 5,
                issueType: 'user',
                issuedToUserId: 'user-002',
                notes: 'For printer replacement'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.quantity).toBe(5);
            expect(result.issueType).toBe('user');
            expect(mockClient.query).toHaveBeenCalledTimes(4);
        });
    });

    describe('findIssueById', () => {
        it('should return issue when found', async () => {
            const mockIssue = {
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
                notes: null,
                created_at: new Date(),
                updated_at: new Date()
            };

            queryFn.mockResolvedValueOnce({ rows: [mockIssue] });

            const result = await repo.findIssueById('iss-001');

            expect(result).toBeDefined();
            expect(result?.id).toBe('iss-001');
        });

        it('should return null when issue not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await repo.findIssueById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getIssues', () => {
        it('should return paginated issues', async () => {
            const mockRows = [
                {
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
                    notes: null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    consumable_name: 'HP Ink',
                    consumable_code: 'CON-001',
                    user_name: 'John Doe',
                    asset_tag: null
                }
            ];

            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getIssues({ consumableId: 'con-001' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].consumableName).toBe('HP Ink');
        });

        it('should filter by issue type', async () => {
            queryFn.mockResolvedValueOnce({ rows: [{ total: '0' }] });
            queryFn.mockResolvedValueOnce({ rows: [] });

            await repo.getIssues({ issueType: ['user', 'asset'] });

            expect(queryFn).toHaveBeenCalled();
        });
    });

    describe('receive', () => {
        it('should receive consumable and create receipt record', async () => {
            const mockClient = mockPool._client;
            const mockReceipt = {
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

            mockClient.query.mockResolvedValueOnce({}); // BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [{ quantity: 70 }], rowCount: 1 }); // UPDATE
            mockClient.query.mockResolvedValueOnce({ rows: [mockReceipt] }); // INSERT
            mockClient.query.mockResolvedValueOnce({}); // COMMIT

            const result = await repo.receive('con-001', {
                consumableId: 'con-001',
                quantity: 20,
                receiptType: 'purchase',
                purchaseOrder: 'PO-001',
                unitCost: 1500000,
                invoiceNumber: 'INV-001',
                notes: 'Monthly restock'
            }, 'user-001');

            expect(result).toBeDefined();
            expect(result.quantity).toBe(20);
            expect(result.receiptType).toBe('purchase');
        });
    });

    describe('findReceiptById', () => {
        it('should return receipt when found', async () => {
            const mockReceipt = {
                id: 'rec-001',
                consumable_id: 'con-001',
                quantity: 20,
                receipt_type: 'purchase',
                purchase_order: 'PO-001',
                unit_cost: 1500000,
                total_cost: 30000000,
                receipt_date: new Date(),
                supplier_id: null,
                invoice_number: null,
                received_by: 'user-001',
                notes: null,
                created_at: new Date(),
                updated_at: new Date()
            };

            queryFn.mockResolvedValueOnce({ rows: [mockReceipt] });

            const result = await repo.findReceiptById('rec-001');

            expect(result).toBeDefined();
            expect(result?.id).toBe('rec-001');
        });

        it('should return null when receipt not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await repo.findReceiptById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getReceipts', () => {
        it('should return paginated receipts', async () => {
            const mockRows = [
                {
                    id: 'rec-001',
                    consumable_id: 'con-001',
                    quantity: 20,
                    receipt_type: 'purchase',
                    purchase_order: 'PO-001',
                    unit_cost: 1500000,
                    total_cost: 30000000,
                    receipt_date: new Date(),
                    supplier_id: null,
                    invoice_number: null,
                    received_by: 'user-001',
                    notes: null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    consumable_name: 'HP Ink',
                    consumable_code: 'CON-001',
                    supplier_name: null
                }
            ];

            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getReceipts({ consumableId: 'con-001' });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].consumableName).toBe('HP Ink');
        });
    });

    describe('getLowStockItems', () => {
        it('should return low stock consumables', async () => {
            const mockRows = [
                {
                    id: 'con-001',
                    consumable_code: 'CON-001',
                    name: 'HP Ink',
                    quantity: 5,
                    min_quantity: 10,
                    deficit: 5,
                    unit_of_measure: 'unit'
                }
            ];

            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getLowStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].deficit).toBe(5);
        });
    });

    describe('getOutOfStockItems', () => {
        it('should return out of stock consumables', async () => {
            const mockRows = [
                {
                    id: 'con-002',
                    consumable_code: 'CON-002',
                    name: 'Canon Ink',
                    quantity: 0,
                    min_quantity: 5,
                    deficit: 5,
                    unit_of_measure: 'unit'
                }
            ];

            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getOutOfStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].quantity).toBe(0);
        });
    });

    describe('getStockSummary', () => {
        it('should return stock summary statistics', async () => {
            queryFn.mockResolvedValueOnce({
                rows: [{
                    total_items: '100',
                    in_stock: '80',
                    low_stock: '15',
                    out_of_stock: '5',
                    total_value: '150000000'
                }]
            });

            const result = await repo.getStockSummary();

            expect(result.totalItems).toBe(100);
            expect(result.inStock).toBe(80);
            expect(result.lowStock).toBe(15);
            expect(result.outOfStock).toBe(5);
            expect(result.totalValue).toBe(150000000);
        });
    });

    describe('getCategories', () => {
        it('should return active categories', async () => {
            const mockRows = [
                { id: 'cat-001', code: 'INK', name: 'Ink & Toner', description: null, parent_id: null, is_active: true, created_at: new Date(), updated_at: new Date() }
            ];

            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getCategories(true);

            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('INK');
        });
    });

    describe('getCategoryById', () => {
        it('should return category when found', async () => {
            const mockRow = { id: 'cat-001', code: 'INK', name: 'Ink & Toner', description: 'Printer ink', parent_id: null, is_active: true, created_at: new Date(), updated_at: new Date() };

            queryFn.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repo.getCategoryById('cat-001');

            expect(result).toBeDefined();
            expect(result?.name).toBe('Ink & Toner');
        });

        it('should return null when category not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await repo.getCategoryById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createCategory', () => {
        it('should create a new category', async () => {
            const mockRow = { id: 'cat-002', code: 'PAPER', name: 'Paper Products', description: 'Printing paper', parent_id: null, is_active: true, created_at: new Date(), updated_at: new Date() };

            queryFn.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repo.createCategory({
                code: 'PAPER',
                name: 'Paper Products',
                description: 'Printing paper'
            });

            expect(result).toBeDefined();
            expect(result.code).toBe('PAPER');
        });
    });

    describe('getManufacturers', () => {
        it('should return active manufacturers', async () => {
            const mockRows = [
                { id: 'mfr-001', code: 'HP', name: 'HP Inc.', website: 'https://hp.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_at: new Date(), updated_at: new Date() }
            ];

            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getManufacturers(true);

            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('HP');
        });
    });

    describe('getManufacturerById', () => {
        it('should return manufacturer when found', async () => {
            const mockRow = { id: 'mfr-001', code: 'HP', name: 'HP Inc.', website: 'https://hp.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_at: new Date(), updated_at: new Date() };

            queryFn.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repo.getManufacturerById('mfr-001');

            expect(result).toBeDefined();
            expect(result?.name).toBe('HP Inc.');
        });

        it('should return null when manufacturer not found', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            const result = await repo.getManufacturerById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createManufacturer', () => {
        it('should create a new manufacturer', async () => {
            const mockRow = { id: 'mfr-002', code: 'CANON', name: 'Canon Inc.', website: 'https://canon.com', support_url: null, support_phone: null, support_email: null, notes: null, is_active: true, created_at: new Date(), updated_at: new Date() };

            queryFn.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repo.createManufacturer({
                code: 'CANON',
                name: 'Canon Inc.',
                website: 'https://canon.com'
            });

            expect(result).toBeDefined();
            expect(result.code).toBe('CANON');
        });
    });

    describe('logAudit', () => {
        it('should create audit log entry', async () => {
            queryFn.mockResolvedValueOnce({ rows: [] });

            await repo.logAudit(
                'consumable',
                'con-001',
                'CREATE',
                { name: 'HP Ink' },
                'user-001'
            );

            expect(queryFn).toHaveBeenCalled();
            const callArgs = queryFn.mock.calls[0];
            expect(callArgs[1]).toContain('consumable');
            expect(callArgs[1]).toContain('CREATE');
        });
    });

    describe('getAuditLogs', () => {
        it('should return paginated audit logs', async () => {
            const mockRows = [
                {
                    id: 'log-001',
                    entity_type: 'consumable',
                    entity_id: 'con-001',
                    action: 'CREATE',
                    changes: { name: 'HP Ink' },
                    performed_by: 'user-001',
                    performed_at: new Date(),
                    ip_address: null,
                    user_agent: null,
                    notes: null
                }
            ];

            queryFn.mockResolvedValueOnce({ rows: [{ total: '1' }] });
            queryFn.mockResolvedValueOnce({ rows: mockRows });

            const result = await repo.getAuditLogs({});

            expect(result.data).toHaveLength(1);
            expect(result.data[0].action).toBe('CREATE');
        });
    });
});
