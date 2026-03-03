/**
 * Components Service - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { ComponentService } from './component.service.js';
import { ComponentRepository } from './component.repository.js';
import {
    Component,
    ComponentCategory,
    ComponentManufacturer,
    ComponentAssignment,
    CreateComponentDto,
    UpdateComponentDto,
    InstallComponentDto,
    RemoveComponentDto,
    ReceiveComponentDto
} from './component.types.js';

// Mock the repository
vi.mock('./component.repository.js');

describe('ComponentService', () => {
    let service: ComponentService;
    let mockRepository: ComponentRepository;
    let mockPool: Pool;

    const mockComponent: Component = {
        id: 'comp-1',
        componentCode: 'RAM-001',
        name: 'DDR4 16GB',
        modelNumber: null,
        categoryId: 'cat-1',
        manufacturerId: 'mfr-1',
        componentType: 'ram',
        specifications: '16GB DDR4 3200MHz',
        imageUrl: null,
        totalQuantity: 10,
        availableQuantity: 8,
        minQuantity: 2,
        unitPrice: 100,
        currency: 'VND',
        supplierId: null,
        purchaseOrder: null,
        purchaseDate: null,
        locationId: null,
        locationName: 'Warehouse A',
        organizationId: null,
        notes: null,
        status: 'active',
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockCategory: ComponentCategory = {
        id: 'cat-1',
        code: 'MEMORY',
        name: 'Memory',
        description: 'RAM modules',
        parentId: null,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockManufacturer: ComponentManufacturer = {
        id: 'mfr-1',
        code: 'KINGSTON',
        name: 'Kingston Technology',
        website: 'https://kingston.com',
        supportUrl: null,
        supportPhone: null,
        supportEmail: null,
        notes: null,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockAssignment: ComponentAssignment = {
        id: 'assign-1',
        componentId: 'comp-1',
        quantity: 2,
        serialNumbers: ['SN-001', 'SN-002'],
        assetId: 'asset-1',
        installedAt: new Date(),
        installedBy: 'user-1',
        installationNotes: null,
        removedAt: null,
        removedBy: null,
        removalReason: null,
        removalNotes: null,
        postRemovalAction: null,
        status: 'installed',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockPool = {} as Pool;
        service = new ComponentService(mockPool);

        // Get the mocked repository instance
        mockRepository = (service as unknown as { repository: ComponentRepository }).repository;
    });

    // ==================== Component CRUD Tests ====================

    describe('createComponent', () => {
        it('should create a component successfully', async () => {
            vi.mocked(mockRepository.findByCode).mockResolvedValue(null);
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(mockCategory);
            vi.mocked(mockRepository.findManufacturerById).mockResolvedValue(mockManufacturer);
            vi.mocked(mockRepository.create).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(undefined);

            const dto: CreateComponentDto = {
                componentCode: 'RAM-001',
                name: 'DDR4 16GB',
                componentType: 'ram',
                categoryId: 'cat-1',
                manufacturerId: 'mfr-1',
                totalQuantity: 10,
                createdBy: 'user-1'
            };

            const result = await service.createComponent(dto);

            expect(result.componentCode).toBe('RAM-001');
            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockRepository.createAuditLog).toHaveBeenCalled();
        });

        it('should throw error if component code already exists', async () => {
            vi.mocked(mockRepository.findByCode).mockResolvedValue(mockComponent);

            const dto: CreateComponentDto = {
                componentCode: 'RAM-001',
                name: 'DDR4 16GB',
                componentType: 'ram',
                totalQuantity: 10,
                createdBy: 'user-1'
            };

            await expect(service.createComponent(dto)).rejects.toThrow(
                'Component with code "RAM-001" already exists'
            );
        });

        it('should throw error if category not found', async () => {
            vi.mocked(mockRepository.findByCode).mockResolvedValue(null);
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(null);

            const dto: CreateComponentDto = {
                componentCode: 'RAM-002',
                name: 'DDR4 32GB',
                componentType: 'ram',
                categoryId: 'non-existent',
                totalQuantity: 10,
                createdBy: 'user-1'
            };

            await expect(service.createComponent(dto)).rejects.toThrow('Category not found');
        });

        it('should throw error if manufacturer not found', async () => {
            vi.mocked(mockRepository.findByCode).mockResolvedValue(null);
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(mockCategory);
            vi.mocked(mockRepository.findManufacturerById).mockResolvedValue(null);

            const dto: CreateComponentDto = {
                componentCode: 'RAM-002',
                name: 'DDR4 32GB',
                componentType: 'ram',
                categoryId: 'cat-1',
                manufacturerId: 'non-existent',
                totalQuantity: 10,
                createdBy: 'user-1'
            };

            await expect(service.createComponent(dto)).rejects.toThrow('Manufacturer not found');
        });
    });

    describe('getComponent', () => {
        it('should return component when found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);

            const result = await service.getComponent('comp-1');

            expect(result?.id).toBe('comp-1');
        });

        it('should return null when not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const result = await service.getComponent('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('updateComponent', () => {
        it('should update component successfully', async () => {
            const updatedComponent = { ...mockComponent, name: 'DDR4 32GB' };

            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.update).mockResolvedValue(updatedComponent);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(undefined);

            const dto: UpdateComponentDto = {
                name: 'DDR4 32GB',
                updatedBy: 'user-1'
            };

            const result = await service.updateComponent('comp-1', dto);

            expect(result.name).toBe('DDR4 32GB');
            expect(mockRepository.createAuditLog).toHaveBeenCalled();
        });

        it('should throw error if component not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const dto: UpdateComponentDto = {
                name: 'DDR4 32GB',
                updatedBy: 'user-1'
            };

            await expect(service.updateComponent('non-existent', dto)).rejects.toThrow(
                'Component not found'
            );
        });
    });

    describe('deleteComponent', () => {
        it('should delete component successfully', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.hasAssignments).mockResolvedValue(false);
            vi.mocked(mockRepository.delete).mockResolvedValue(true);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(undefined);

            await expect(service.deleteComponent('comp-1', 'user-1')).resolves.not.toThrow();
            expect(mockRepository.delete).toHaveBeenCalledWith('comp-1');
        });

        it('should throw error if component not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            await expect(service.deleteComponent('non-existent', 'user-1')).rejects.toThrow(
                'Component not found'
            );
        });

        it('should throw error if component has assignments', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.hasAssignments).mockResolvedValue(true);

            await expect(service.deleteComponent('comp-1', 'user-1')).rejects.toThrow(
                'Cannot delete component with existing assignment history'
            );
        });
    });

    // ==================== Install/Remove Tests ====================

    describe('installComponent', () => {
        it('should install component successfully', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.validateSerialNumbers).mockResolvedValue([]);
            vi.mocked(mockRepository.withTransaction).mockImplementation(async (callback) => {
                return callback({} as never);
            });
            vi.mocked(mockRepository.install).mockResolvedValue(mockAssignment);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(undefined);

            const dto: InstallComponentDto = {
                componentId: 'comp-1',
                quantity: 2,
                assetId: 'asset-1',
                serialNumbers: ['SN-001', 'SN-002'],
                installedBy: 'user-1'
            };

            const result = await service.installComponent(dto);

            expect(result.id).toBe('assign-1');
            expect(result.status).toBe('installed');
        });

        it('should throw error if component not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const dto: InstallComponentDto = {
                componentId: 'non-existent',
                quantity: 2,
                assetId: 'asset-1',
                installedBy: 'user-1'
            };

            await expect(service.installComponent(dto)).rejects.toThrow('Component not found');
        });

        it('should throw error if component is inactive', async () => {
            const inactiveComponent = { ...mockComponent, status: 'inactive' as const };
            vi.mocked(mockRepository.findById).mockResolvedValue(inactiveComponent);

            const dto: InstallComponentDto = {
                componentId: 'comp-1',
                quantity: 2,
                assetId: 'asset-1',
                installedBy: 'user-1'
            };

            await expect(service.installComponent(dto)).rejects.toThrow(
                'Cannot install inactive or discontinued component'
            );
        });

        it('should throw error if quantity exceeds available', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);

            const dto: InstallComponentDto = {
                componentId: 'comp-1',
                quantity: 20, // More than available (8)
                assetId: 'asset-1',
                installedBy: 'user-1'
            };

            await expect(service.installComponent(dto)).rejects.toThrow(
                'Requested 20 but only 8 available'
            );
        });

        it('should throw error if serial numbers are in use', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.validateSerialNumbers).mockResolvedValue(['SN-001']);

            const dto: InstallComponentDto = {
                componentId: 'comp-1',
                quantity: 2,
                assetId: 'asset-1',
                serialNumbers: ['SN-001', 'SN-002'],
                installedBy: 'user-1'
            };

            await expect(service.installComponent(dto)).rejects.toThrow(
                'Serial numbers already in use: SN-001'
            );
        });
    });

    describe('removeComponent', () => {
        it('should remove component with restock successfully', async () => {
            const removedAssignment: ComponentAssignment = {
                ...mockAssignment,
                status: 'removed',
                removedAt: new Date(),
                removedBy: 'user-1',
                removalReason: 'upgrade',
                postRemovalAction: 'restock'
            };

            vi.mocked(mockRepository.findAssignmentById).mockResolvedValue(mockAssignment);
            vi.mocked(mockRepository.withTransaction).mockImplementation(async (callback) => {
                return callback({} as never);
            });
            vi.mocked(mockRepository.remove).mockResolvedValue(removedAssignment);
            vi.mocked(mockRepository.receive).mockResolvedValue({} as never);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(undefined);

            const dto: RemoveComponentDto = {
                assignmentId: 'assign-1',
                removalReason: 'upgrade',
                postRemovalAction: 'restock',
                removedBy: 'user-1'
            };

            const result = await service.removeComponent(dto);

            expect(result.status).toBe('removed');
            expect(result.postRemovalAction).toBe('restock');
        });

        it('should throw error if assignment not found', async () => {
            vi.mocked(mockRepository.findAssignmentById).mockResolvedValue(null);

            const dto: RemoveComponentDto = {
                assignmentId: 'non-existent',
                removalReason: 'upgrade',
                postRemovalAction: 'restock',
                removedBy: 'user-1'
            };

            await expect(service.removeComponent(dto)).rejects.toThrow('Assignment not found');
        });

        it('should throw error if already removed', async () => {
            const alreadyRemoved: ComponentAssignment = {
                ...mockAssignment,
                status: 'removed'
            };
            vi.mocked(mockRepository.findAssignmentById).mockResolvedValue(alreadyRemoved);

            const dto: RemoveComponentDto = {
                assignmentId: 'assign-1',
                removalReason: 'upgrade',
                postRemovalAction: 'restock',
                removedBy: 'user-1'
            };

            await expect(service.removeComponent(dto)).rejects.toThrow(
                'Component is already removed from this asset'
            );
        });
    });

    // ==================== Receipt Tests ====================

    describe('receiveComponent', () => {
        it('should receive component successfully', async () => {
            const mockReceipt = {
                id: 'receipt-1',
                componentId: 'comp-1',
                quantity: 5,
                serialNumbers: null,
                receiptType: 'purchase' as const,
                supplierId: null,
                purchaseOrder: null,
                unitCost: null,
                referenceNumber: null,
                referenceType: null,
                referenceId: null,
                receivedBy: 'user-1',
                receivedAt: new Date(),
                notes: null,
                createdAt: new Date()
            };

            vi.mocked(mockRepository.findById).mockResolvedValue(mockComponent);
            vi.mocked(mockRepository.validateSerialNumbers).mockResolvedValue([]);
            vi.mocked(mockRepository.withTransaction).mockImplementation(async (callback) => {
                return callback({} as never);
            });
            vi.mocked(mockRepository.receive).mockResolvedValue(mockReceipt);
            vi.mocked(mockRepository.createAuditLog).mockResolvedValue(undefined);

            const dto: ReceiveComponentDto = {
                componentId: 'comp-1',
                quantity: 5,
                receiptType: 'purchase',
                receivedBy: 'user-1'
            };

            const result = await service.receiveComponent(dto);

            expect(result.id).toBe('receipt-1');
            expect(result.quantity).toBe(5);
        });

        it('should throw error if component not found', async () => {
            vi.mocked(mockRepository.findById).mockResolvedValue(null);

            const dto: ReceiveComponentDto = {
                componentId: 'non-existent',
                quantity: 5,
                receiptType: 'purchase',
                receivedBy: 'user-1'
            };

            await expect(service.receiveComponent(dto)).rejects.toThrow('Component not found');
        });
    });

    // ==================== Category Tests ====================

    describe('createCategory', () => {
        it('should create category successfully', async () => {
            vi.mocked(mockRepository.findCategoryByCode).mockResolvedValue(null);
            vi.mocked(mockRepository.createCategory).mockResolvedValue(mockCategory);

            const result = await service.createCategory({
                code: 'MEMORY',
                name: 'Memory',
                createdBy: 'user-1'
            });

            expect(result.code).toBe('MEMORY');
        });

        it('should throw error if code already exists', async () => {
            vi.mocked(mockRepository.findCategoryByCode).mockResolvedValue(mockCategory);

            await expect(service.createCategory({
                code: 'MEMORY',
                name: 'Memory',
                createdBy: 'user-1'
            })).rejects.toThrow('Category with code "MEMORY" already exists');
        });
    });

    describe('updateCategory', () => {
        it('should update category successfully', async () => {
            const updatedCategory = { ...mockCategory, name: 'RAM Modules' };

            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(mockCategory);
            vi.mocked(mockRepository.updateCategory).mockResolvedValue(updatedCategory);

            const result = await service.updateCategory('cat-1', { name: 'RAM Modules' });

            expect(result.name).toBe('RAM Modules');
        });

        it('should throw error if category not found', async () => {
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(null);

            await expect(service.updateCategory('non-existent', { name: 'Test' })).rejects.toThrow(
                'Category not found'
            );
        });

        it('should throw error if setting self as parent', async () => {
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(mockCategory);

            await expect(service.updateCategory('cat-1', { parentId: 'cat-1' })).rejects.toThrow(
                'Category cannot be its own parent'
            );
        });
    });

    describe('deleteCategory', () => {
        it('should delete category successfully', async () => {
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(mockCategory);
            vi.mocked(mockRepository.categoryHasComponents).mockResolvedValue(false);
            vi.mocked(mockRepository.deleteCategory).mockResolvedValue(true);

            await expect(service.deleteCategory('cat-1')).resolves.not.toThrow();
        });

        it('should throw error if category has components', async () => {
            vi.mocked(mockRepository.findCategoryById).mockResolvedValue(mockCategory);
            vi.mocked(mockRepository.categoryHasComponents).mockResolvedValue(true);

            await expect(service.deleteCategory('cat-1')).rejects.toThrow(
                'Cannot delete category that has components'
            );
        });
    });

    // ==================== Manufacturer Tests ====================

    describe('createManufacturer', () => {
        it('should create manufacturer successfully', async () => {
            vi.mocked(mockRepository.findManufacturerByCode).mockResolvedValue(null);
            vi.mocked(mockRepository.createManufacturer).mockResolvedValue(mockManufacturer);

            const result = await service.createManufacturer({
                code: 'KINGSTON',
                name: 'Kingston Technology',
                createdBy: 'user-1'
            });

            expect(result.code).toBe('KINGSTON');
        });

        it('should throw error if code already exists', async () => {
            vi.mocked(mockRepository.findManufacturerByCode).mockResolvedValue(mockManufacturer);

            await expect(service.createManufacturer({
                code: 'KINGSTON',
                name: 'Kingston Technology',
                createdBy: 'user-1'
            })).rejects.toThrow('Manufacturer with code "KINGSTON" already exists');
        });
    });

    describe('updateManufacturer', () => {
        it('should update manufacturer successfully', async () => {
            const updatedManufacturer = { ...mockManufacturer, name: 'Kingston Tech' };

            vi.mocked(mockRepository.findManufacturerById).mockResolvedValue(mockManufacturer);
            vi.mocked(mockRepository.updateManufacturer).mockResolvedValue(updatedManufacturer);

            const result = await service.updateManufacturer('mfr-1', { name: 'Kingston Tech' });

            expect(result.name).toBe('Kingston Tech');
        });

        it('should throw error if manufacturer not found', async () => {
            vi.mocked(mockRepository.findManufacturerById).mockResolvedValue(null);

            await expect(service.updateManufacturer('non-existent', { name: 'Test' })).rejects.toThrow(
                'Manufacturer not found'
            );
        });
    });

    describe('deleteManufacturer', () => {
        it('should delete manufacturer successfully', async () => {
            vi.mocked(mockRepository.findManufacturerById).mockResolvedValue(mockManufacturer);
            vi.mocked(mockRepository.manufacturerHasComponents).mockResolvedValue(false);
            vi.mocked(mockRepository.deleteManufacturer).mockResolvedValue(true);

            await expect(service.deleteManufacturer('mfr-1')).resolves.not.toThrow();
        });

        it('should throw error if manufacturer has components', async () => {
            vi.mocked(mockRepository.findManufacturerById).mockResolvedValue(mockManufacturer);
            vi.mocked(mockRepository.manufacturerHasComponents).mockResolvedValue(true);

            await expect(service.deleteManufacturer('mfr-1')).rejects.toThrow(
                'Cannot delete manufacturer that has components'
            );
        });
    });

    // ==================== Stock Alert Tests ====================

    describe('getLowStockItems', () => {
        it('should return low stock items', async () => {
            const mockAlerts = [
                {
                    id: 'comp-1',
                    componentCode: 'RAM-001',
                    name: 'DDR4 16GB',
                    componentType: 'ram' as const,
                    totalQuantity: 10,
                    availableQuantity: 2,
                    minQuantity: 5,
                    stockStatus: 'low_stock' as const,
                    categoryName: 'Memory',
                    locationName: 'Warehouse A'
                }
            ];

            vi.mocked(mockRepository.getLowStockItems).mockResolvedValue(mockAlerts);

            const result = await service.getLowStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].stockStatus).toBe('low_stock');
        });
    });

    describe('getOutOfStockItems', () => {
        it('should return out of stock items', async () => {
            const mockAlerts = [
                {
                    id: 'comp-1',
                    componentCode: 'RAM-001',
                    name: 'DDR4 16GB',
                    componentType: 'ram' as const,
                    totalQuantity: 10,
                    availableQuantity: 0,
                    minQuantity: 5,
                    stockStatus: 'out_of_stock' as const,
                    categoryName: 'Memory',
                    locationName: 'Warehouse A'
                }
            ];

            vi.mocked(mockRepository.getOutOfStockItems).mockResolvedValue(mockAlerts);

            const result = await service.getOutOfStockItems();

            expect(result).toHaveLength(1);
            expect(result[0].stockStatus).toBe('out_of_stock');
        });
    });

    describe('getStockSummary', () => {
        it('should return stock summary', async () => {
            const mockSummary = {
                totalComponents: 10,
                totalQuantity: 100,
                totalAvailable: 80,
                totalInstalled: 20,
                inStockCount: 6,
                lowStockCount: 3,
                outOfStockCount: 1,
                totalValue: 50000
            };

            vi.mocked(mockRepository.getStockSummary).mockResolvedValue(mockSummary);

            const result = await service.getStockSummary();

            expect(result.totalComponents).toBe(10);
            expect(result.totalValue).toBe(50000);
        });
    });
});
