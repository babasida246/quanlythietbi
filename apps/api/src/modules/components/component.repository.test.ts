/**
 * Components Repository - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { ComponentRepository } from './component.repository.js';
import {
    CreateComponentDto,
    UpdateComponentDto,
    InstallComponentDto,
    RemoveComponentDto,
    ReceiveComponentDto,
    CreateCategoryDto,
    CreateManufacturerDto
} from './component.types.js';

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

describe('ComponentRepository', () => {
    let repository: ComponentRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new ComponentRepository(mockPool);
        mockConnect.mockResolvedValue(mockClient);
    });

    // ==================== Component CRUD Tests ====================

    describe('create', () => {
        it('should create a component and return it', async () => {
            const dto: CreateComponentDto = {
                componentCode: 'RAM-001',
                name: 'DDR4 16GB',
                componentType: 'ram',
                totalQuantity: 10,
                createdBy: 'user-1'
            };

            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 16GB',
                model_number: null,
                category_id: null,
                manufacturer_id: null,
                component_type: 'ram',
                specifications: null,
                image_url: null,
                total_quantity: 10,
                available_quantity: 10,
                min_quantity: 0,
                unit_price: 0,
                currency: 'VND',
                supplier_id: null,
                purchase_order: null,
                purchase_date: null,
                location_id: null,
                location_name: null,
                organization_id: null,
                notes: null,
                status: 'active',
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.create(dto);

            expect(result.id).toBe('comp-1');
            expect(result.componentCode).toBe('RAM-001');
            expect(result.name).toBe('DDR4 16GB');
            expect(result.componentType).toBe('ram');
            expect(mockQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('findById', () => {
        it('should return component when found', async () => {
            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 16GB',
                component_type: 'ram',
                total_quantity: 10,
                available_quantity: 8,
                min_quantity: 2,
                unit_price: 100,
                currency: 'VND',
                status: 'active',
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findById('comp-1');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('comp-1');
            expect(result?.componentCode).toBe('RAM-001');
        });

        it('should return null when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.findById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findByIdWithDetails', () => {
        it('should return component with category and manufacturer names', async () => {
            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 16GB',
                component_type: 'ram',
                total_quantity: 10,
                available_quantity: 8,
                min_quantity: 2,
                unit_price: 100,
                currency: 'VND',
                status: 'active',
                category_name: 'Memory',
                manufacturer_name: 'Kingston',
                supplier_name: null,
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findByIdWithDetails('comp-1');

            expect(result).not.toBeNull();
            expect(result?.categoryName).toBe('Memory');
            expect(result?.manufacturerName).toBe('Kingston');
            expect(result?.installedQuantity).toBe(2); // 10 - 8
            expect(result?.stockStatus).toBe('in_stock');
        });

        it('should return low_stock status when available <= min', async () => {
            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 16GB',
                component_type: 'ram',
                total_quantity: 10,
                available_quantity: 2,
                min_quantity: 5,
                unit_price: 100,
                currency: 'VND',
                status: 'active',
                category_name: 'Memory',
                manufacturer_name: 'Kingston',
                supplier_name: null,
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findByIdWithDetails('comp-1');

            expect(result?.stockStatus).toBe('low_stock');
        });

        it('should return out_of_stock status when available = 0', async () => {
            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 16GB',
                component_type: 'ram',
                total_quantity: 10,
                available_quantity: 0,
                min_quantity: 5,
                unit_price: 100,
                currency: 'VND',
                status: 'active',
                category_name: 'Memory',
                manufacturer_name: 'Kingston',
                supplier_name: null,
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findByIdWithDetails('comp-1');

            expect(result?.stockStatus).toBe('out_of_stock');
        });
    });

    describe('findByCode', () => {
        it('should return component when found by code', async () => {
            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 16GB',
                component_type: 'ram',
                total_quantity: 10,
                available_quantity: 8,
                min_quantity: 2,
                unit_price: 100,
                currency: 'VND',
                status: 'active',
                created_by: 'user-1',
                updated_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findByCode('RAM-001');

            expect(result?.componentCode).toBe('RAM-001');
        });
    });

    describe('list', () => {
        it('should return paginated components', async () => {
            const mockRows = [
                {
                    id: 'comp-1',
                    component_code: 'RAM-001',
                    name: 'DDR4 16GB',
                    component_type: 'ram',
                    total_quantity: 10,
                    available_quantity: 8,
                    min_quantity: 2,
                    unit_price: 100,
                    currency: 'VND',
                    status: 'active',
                    category_name: 'Memory',
                    manufacturer_name: 'Kingston',
                    supplier_name: null,
                    created_by: 'user-1',
                    updated_by: 'user-1',
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ];

            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '1' }] })
                .mockResolvedValueOnce({ rows: mockRows });

            const result = await repository.list({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.page).toBe(1);
        });

        it('should filter by componentType', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await repository.list({ componentType: ['ram', 'ssd'] });

            expect(mockQuery).toHaveBeenCalled();
            const countCall = mockQuery.mock.calls[0];
            expect(countCall[1]).toContainEqual(['ram', 'ssd']);
        });

        it('should filter by status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await repository.list({ status: ['active'] });

            expect(mockQuery).toHaveBeenCalled();
            const countCall = mockQuery.mock.calls[0];
            expect(countCall[1]).toContainEqual(['active']);
        });
    });

    describe('update', () => {
        it('should update component fields', async () => {
            const mockRow = {
                id: 'comp-1',
                component_code: 'RAM-001',
                name: 'DDR4 32GB',
                component_type: 'ram',
                total_quantity: 10,
                available_quantity: 8,
                min_quantity: 2,
                unit_price: 200,
                currency: 'VND',
                status: 'active',
                created_by: 'user-1',
                updated_by: 'user-2',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const dto: UpdateComponentDto = {
                name: 'DDR4 32GB',
                unitPrice: 200,
                updatedBy: 'user-2'
            };

            const result = await repository.update('comp-1', dto);

            expect(result?.name).toBe('DDR4 32GB');
            expect(result?.unitPrice).toBe(200);
        });
    });

    describe('delete', () => {
        it('should delete component and return true', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1 });

            const result = await repository.delete('comp-1');

            expect(result).toBe(true);
        });

        it('should return false when component not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0 });

            const result = await repository.delete('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('hasAssignments', () => {
        it('should return true if component has assignments', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'assign-1' }] });

            const result = await repository.hasAssignments('comp-1');

            expect(result).toBe(true);
        });

        it('should return false if component has no assignments', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.hasAssignments('comp-1');

            expect(result).toBe(false);
        });
    });

    // ==================== Install/Remove Tests ====================

    describe('install', () => {
        it('should create assignment and update available quantity', async () => {
            const dto: InstallComponentDto = {
                componentId: 'comp-1',
                quantity: 2,
                assetId: 'asset-1',
                installedBy: 'user-1'
            };

            const mockAssignment = {
                id: 'assign-1',
                component_id: 'comp-1',
                quantity: 2,
                serial_numbers: null,
                asset_id: 'asset-1',
                installed_at: new Date(),
                installed_by: 'user-1',
                installation_notes: null,
                removed_at: null,
                removed_by: null,
                removal_reason: null,
                removal_notes: null,
                post_removal_action: null,
                status: 'installed',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery
                .mockResolvedValueOnce({ rows: [mockAssignment] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await repository.install(dto);

            expect(result.id).toBe('assign-1');
            expect(result.status).toBe('installed');
            expect(mockQuery).toHaveBeenCalledTimes(2);
        });
    });

    describe('remove', () => {
        it('should update assignment and increase available quantity for restock', async () => {
            const dto: RemoveComponentDto = {
                assignmentId: 'assign-1',
                removalReason: 'upgrade',
                postRemovalAction: 'restock',
                removedBy: 'user-1'
            };

            const mockAssignment = {
                id: 'assign-1',
                component_id: 'comp-1',
                quantity: 2,
                serial_numbers: null,
                asset_id: 'asset-1',
                installed_at: new Date(),
                installed_by: 'user-1',
                status: 'installed',
                created_at: new Date(),
                updated_at: new Date()
            };

            const mockUpdatedAssignment = {
                ...mockAssignment,
                removed_at: new Date(),
                removed_by: 'user-1',
                removal_reason: 'upgrade',
                post_removal_action: 'restock',
                status: 'removed'
            };

            mockQuery
                .mockResolvedValueOnce({ rows: [mockAssignment] })
                .mockResolvedValueOnce({ rows: [mockUpdatedAssignment] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await repository.remove(dto);

            expect(result.status).toBe('removed');
            expect(result.removalReason).toBe('upgrade');
            expect(result.postRemovalAction).toBe('restock');
        });

        it('should throw error if assignment not found', async () => {
            const dto: RemoveComponentDto = {
                assignmentId: 'non-existent',
                removalReason: 'upgrade',
                postRemovalAction: 'restock',
                removedBy: 'user-1'
            };

            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(repository.remove(dto)).rejects.toThrow('Assignment not found or already removed');
        });
    });

    describe('findAssignmentById', () => {
        it('should return assignment when found', async () => {
            const mockAssignment = {
                id: 'assign-1',
                component_id: 'comp-1',
                quantity: 2,
                serial_numbers: ['SN-001', 'SN-002'],
                asset_id: 'asset-1',
                installed_at: new Date(),
                installed_by: 'user-1',
                status: 'installed',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockAssignment] });

            const result = await repository.findAssignmentById('assign-1');

            expect(result?.id).toBe('assign-1');
            expect(result?.serialNumbers).toEqual(['SN-001', 'SN-002']);
        });
    });

    describe('listAssignments', () => {
        it('should return paginated assignments', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await repository.listAssignments({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(0);
            expect(result.pagination.page).toBe(1);
        });
    });

    describe('getAssetComponents', () => {
        it('should return components installed in an asset', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.getAssetComponents('asset-1');

            expect(result?.assetId).toBe('asset-1');
            expect(result?.components).toHaveLength(0);
        });
    });

    // ==================== Receipt Tests ====================

    describe('receive', () => {
        it('should create receipt and update quantities', async () => {
            const dto: ReceiveComponentDto = {
                componentId: 'comp-1',
                quantity: 5,
                receiptType: 'purchase',
                receivedBy: 'user-1'
            };

            const mockReceipt = {
                id: 'receipt-1',
                component_id: 'comp-1',
                quantity: 5,
                serial_numbers: null,
                receipt_type: 'purchase',
                supplier_id: null,
                purchase_order: null,
                unit_cost: null,
                reference_number: null,
                reference_type: null,
                reference_id: null,
                received_by: 'user-1',
                received_at: new Date(),
                notes: null,
                created_at: new Date()
            };

            mockQuery
                .mockResolvedValueOnce({ rows: [mockReceipt] })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await repository.receive(dto);

            expect(result.id).toBe('receipt-1');
            expect(result.quantity).toBe(5);
            expect(result.receiptType).toBe('purchase');
        });
    });

    describe('listReceipts', () => {
        it('should return paginated receipts', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await repository.listReceipts({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(0);
            expect(result.pagination.page).toBe(1);
        });
    });

    // ==================== Stock Alert Tests ====================

    describe('getLowStockItems', () => {
        it('should return components with low stock', async () => {
            const mockRows = [
                {
                    id: 'comp-1',
                    component_code: 'RAM-001',
                    name: 'DDR4 16GB',
                    component_type: 'ram',
                    total_quantity: 10,
                    available_quantity: 2,
                    min_quantity: 5,
                    location_name: 'Warehouse A',
                    category_name: 'Memory'
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: mockRows });

            const result = await repository.getLowStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].stockStatus).toBe('low_stock');
        });
    });

    describe('getOutOfStockItems', () => {
        it('should return components with zero stock', async () => {
            const mockRows = [
                {
                    id: 'comp-1',
                    component_code: 'RAM-001',
                    name: 'DDR4 16GB',
                    component_type: 'ram',
                    total_quantity: 10,
                    available_quantity: 0,
                    min_quantity: 5,
                    location_name: 'Warehouse A',
                    category_name: 'Memory'
                }
            ];

            mockQuery.mockResolvedValueOnce({ rows: mockRows });

            const result = await repository.getOutOfStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].stockStatus).toBe('out_of_stock');
            expect(result[0].availableQuantity).toBe(0);
        });
    });

    describe('getStockSummary', () => {
        it('should return stock summary', async () => {
            const mockRow = {
                total_components: '10',
                total_quantity: '100',
                total_available: '80',
                total_installed: '20',
                in_stock_count: '6',
                low_stock_count: '3',
                out_of_stock_count: '1',
                total_value: '50000.00'
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.getStockSummary();

            expect(result.totalComponents).toBe(10);
            expect(result.totalQuantity).toBe(100);
            expect(result.totalAvailable).toBe(80);
            expect(result.totalInstalled).toBe(20);
            expect(result.inStockCount).toBe(6);
            expect(result.lowStockCount).toBe(3);
            expect(result.outOfStockCount).toBe(1);
            expect(result.totalValue).toBe(50000);
        });
    });

    // ==================== Category Tests ====================

    describe('createCategory', () => {
        it('should create a category', async () => {
            const dto: CreateCategoryDto = {
                code: 'MEMORY',
                name: 'Memory',
                createdBy: 'user-1'
            };

            const mockRow = {
                id: 'cat-1',
                code: 'MEMORY',
                name: 'Memory',
                description: null,
                parent_id: null,
                is_active: true,
                created_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.createCategory(dto);

            expect(result.code).toBe('MEMORY');
            expect(result.name).toBe('Memory');
        });
    });

    describe('findCategoryById', () => {
        it('should return category when found', async () => {
            const mockRow = {
                id: 'cat-1',
                code: 'MEMORY',
                name: 'Memory',
                description: null,
                parent_id: null,
                is_active: true,
                created_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findCategoryById('cat-1');

            expect(result?.code).toBe('MEMORY');
        });
    });

    describe('listCategories', () => {
        it('should return paginated categories', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await repository.listCategories({ page: 1, limit: 20 });

            expect(result.pagination.page).toBe(1);
        });
    });

    describe('categoryHasComponents', () => {
        it('should return true if category has components', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'comp-1' }] });

            const result = await repository.categoryHasComponents('cat-1');

            expect(result).toBe(true);
        });
    });

    // ==================== Manufacturer Tests ====================

    describe('createManufacturer', () => {
        it('should create a manufacturer', async () => {
            const dto: CreateManufacturerDto = {
                code: 'KINGSTON',
                name: 'Kingston Technology',
                createdBy: 'user-1'
            };

            const mockRow = {
                id: 'mfr-1',
                code: 'KINGSTON',
                name: 'Kingston Technology',
                website: null,
                support_url: null,
                support_phone: null,
                support_email: null,
                notes: null,
                is_active: true,
                created_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.createManufacturer(dto);

            expect(result.code).toBe('KINGSTON');
            expect(result.name).toBe('Kingston Technology');
        });
    });

    describe('findManufacturerById', () => {
        it('should return manufacturer when found', async () => {
            const mockRow = {
                id: 'mfr-1',
                code: 'KINGSTON',
                name: 'Kingston Technology',
                website: 'https://kingston.com',
                support_url: null,
                support_phone: null,
                support_email: null,
                notes: null,
                is_active: true,
                created_by: 'user-1',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

            const result = await repository.findManufacturerById('mfr-1');

            expect(result?.code).toBe('KINGSTON');
            expect(result?.website).toBe('https://kingston.com');
        });
    });

    describe('listManufacturers', () => {
        it('should return paginated manufacturers', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await repository.listManufacturers({ page: 1, limit: 20 });

            expect(result.pagination.page).toBe(1);
        });
    });

    describe('manufacturerHasComponents', () => {
        it('should return true if manufacturer has components', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'comp-1' }] });

            const result = await repository.manufacturerHasComponents('mfr-1');

            expect(result).toBe(true);
        });
    });

    // ==================== Serial Number Tests ====================

    describe('isSerialNumberInUse', () => {
        it('should return true if serial number is in use', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'assign-1' }] });

            const result = await repository.isSerialNumberInUse('SN-001');

            expect(result).toBe(true);
        });

        it('should return false if serial number is not in use', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await repository.isSerialNumberInUse('SN-NEW');

            expect(result).toBe(false);
        });
    });

    describe('validateSerialNumbers', () => {
        it('should return list of serial numbers already in use', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'assign-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ id: 'assign-2' }] });

            const result = await repository.validateSerialNumbers(['SN-001', 'SN-NEW', 'SN-002']);

            expect(result).toEqual(['SN-001', 'SN-002']);
        });
    });

    // ==================== Transaction Tests ====================

    describe('withTransaction', () => {
        it('should commit transaction on success', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 'result' }] }) // User operation
                .mockResolvedValueOnce({ rows: [] }); // COMMIT

            const result = await repository.withTransaction(async (client) => {
                const res = await client.query('SELECT 1');
                return res.rows[0];
            });

            expect(result).toEqual({ id: 'result' });
            expect(mockQuery).toHaveBeenCalledWith('BEGIN');
            expect(mockQuery).toHaveBeenCalledWith('COMMIT');
        });

        it('should rollback transaction on error', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // BEGIN
                .mockRejectedValueOnce(new Error('Test error')) // User operation
                .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

            await expect(
                repository.withTransaction(async () => {
                    throw new Error('Test error');
                })
            ).rejects.toThrow('Test error');

            expect(mockQuery).toHaveBeenCalledWith('BEGIN');
            expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
        });
    });

    // ==================== Audit Log Test ====================

    describe('createAuditLog', () => {
        it('should create an audit log entry', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1 });

            await repository.createAuditLog({
                componentId: 'comp-1',
                assignmentId: null,
                receiptId: null,
                action: 'Component created',
                actionType: 'create',
                oldValues: null,
                newValues: { name: 'Test' },
                performedBy: 'user-1',
                ipAddress: null,
                userAgent: null,
                notes: null
            });

            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO component_audit_logs');
        });
    });
});
