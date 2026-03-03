/**
 * Components Module - Service Layer
 * Business logic for component management
 */

import { Pool } from 'pg';
import { ComponentRepository } from './component.repository.js';
import {
    Component,
    ComponentWithDetails,
    ComponentAssignment,
    ComponentAssignmentWithDetails,
    ComponentReceipt,
    ComponentReceiptWithDetails,
    ComponentCategory,
    ComponentManufacturer,
    CreateComponentDto,
    UpdateComponentDto,
    InstallComponentDto,
    RemoveComponentDto,
    ReceiveComponentDto,
    CreateCategoryDto,
    UpdateCategoryDto,
    CreateManufacturerDto,
    UpdateManufacturerDto,
    ComponentListQuery,
    AssignmentListQuery,
    ReceiptListQuery,
    CategoryListQuery,
    ManufacturerListQuery,
    PaginatedResponse,
    StockAlert,
    StockSummary,
    AssetComponents
} from './component.types.js';

export class ComponentService {
    private readonly repository: ComponentRepository;

    constructor(private readonly pool: Pool) {
        this.repository = new ComponentRepository(pool);
    }

    // ==================== Component CRUD ====================

    async createComponent(data: CreateComponentDto): Promise<Component> {
        // Check for duplicate code
        const existing = await this.repository.findByCode(data.componentCode);
        if (existing) {
            throw new Error(`Component with code "${data.componentCode}" already exists`);
        }

        // Validate category exists if provided
        if (data.categoryId) {
            const category = await this.repository.findCategoryById(data.categoryId);
            if (!category) {
                throw new Error('Category not found');
            }
        }

        // Validate manufacturer exists if provided
        if (data.manufacturerId) {
            const manufacturer = await this.repository.findManufacturerById(data.manufacturerId);
            if (!manufacturer) {
                throw new Error('Manufacturer not found');
            }
        }

        const component = await this.repository.create(data);

        // Create audit log
        await this.repository.createAuditLog({
            componentId: component.id,
            assignmentId: null,
            receiptId: null,
            action: 'Component created',
            actionType: 'create',
            oldValues: null,
            newValues: data as unknown as Record<string, unknown>,
            performedBy: data.createdBy,
            ipAddress: null,
            userAgent: null,
            notes: null
        });

        return component;
    }

    async getComponent(id: string): Promise<Component | null> {
        return this.repository.findById(id);
    }

    async getComponentWithDetails(id: string): Promise<ComponentWithDetails | null> {
        return this.repository.findByIdWithDetails(id);
    }

    async listComponents(query: ComponentListQuery): Promise<PaginatedResponse<ComponentWithDetails>> {
        return this.repository.list(query);
    }

    async updateComponent(id: string, data: UpdateComponentDto): Promise<Component> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Component not found');
        }

        // Validate category if changing
        if (data.categoryId !== undefined && data.categoryId !== null) {
            const category = await this.repository.findCategoryById(data.categoryId);
            if (!category) {
                throw new Error('Category not found');
            }
        }

        // Validate manufacturer if changing
        if (data.manufacturerId !== undefined && data.manufacturerId !== null) {
            const manufacturer = await this.repository.findManufacturerById(data.manufacturerId);
            if (!manufacturer) {
                throw new Error('Manufacturer not found');
            }
        }

        const updated = await this.repository.update(id, data);
        if (!updated) {
            throw new Error('Failed to update component');
        }

        // Create audit log
        await this.repository.createAuditLog({
            componentId: id,
            assignmentId: null,
            receiptId: null,
            action: 'Component updated',
            actionType: 'update',
            oldValues: existing as unknown as Record<string, unknown>,
            newValues: data as unknown as Record<string, unknown>,
            performedBy: data.updatedBy,
            ipAddress: null,
            userAgent: null,
            notes: null
        });

        return updated;
    }

    async deleteComponent(id: string, deletedBy: string): Promise<void> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Component not found');
        }

        // Check for existing assignments
        const hasAssignments = await this.repository.hasAssignments(id);
        if (hasAssignments) {
            throw new Error('Cannot delete component with existing assignment history');
        }

        const deleted = await this.repository.delete(id);
        if (!deleted) {
            throw new Error('Failed to delete component');
        }

        // Create audit log
        await this.repository.createAuditLog({
            componentId: null, // Component is deleted
            assignmentId: null,
            receiptId: null,
            action: `Component ${existing.componentCode} deleted`,
            actionType: 'delete',
            oldValues: existing as unknown as Record<string, unknown>,
            newValues: null,
            performedBy: deletedBy,
            ipAddress: null,
            userAgent: null,
            notes: null
        });
    }

    // ==================== Install/Remove Operations ====================

    async installComponent(data: InstallComponentDto): Promise<ComponentAssignment> {
        const component = await this.repository.findById(data.componentId);
        if (!component) {
            throw new Error('Component not found');
        }

        // Validate component is active
        if (component.status !== 'active') {
            throw new Error('Cannot install inactive or discontinued component');
        }

        // Validate quantity is available
        if (data.quantity > component.availableQuantity) {
            throw new Error(`Requested ${data.quantity} but only ${component.availableQuantity} available`);
        }

        // Validate serial numbers if provided
        if (data.serialNumbers && data.serialNumbers.length > 0) {
            const inUse = await this.repository.validateSerialNumbers(data.serialNumbers);
            if (inUse.length > 0) {
                throw new Error(`Serial numbers already in use: ${inUse.join(', ')}`);
            }
        }

        // Perform installation within transaction
        const assignment = await this.repository.withTransaction(async (client) => {
            return this.repository.install(data, client);
        });

        // Create audit log
        await this.repository.createAuditLog({
            componentId: data.componentId,
            assignmentId: assignment.id,
            receiptId: null,
            action: `Installed ${data.quantity} unit(s) into asset`,
            actionType: 'install',
            oldValues: { availableQuantity: component.availableQuantity },
            newValues: {
                quantity: data.quantity,
                assetId: data.assetId,
                serialNumbers: data.serialNumbers
            },
            performedBy: data.installedBy,
            ipAddress: null,
            userAgent: null,
            notes: data.installationNotes || null
        });

        return assignment;
    }

    async removeComponent(data: RemoveComponentDto): Promise<ComponentAssignment> {
        const assignment = await this.repository.findAssignmentById(data.assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        if (assignment.status !== 'installed') {
            throw new Error('Component is already removed from this asset');
        }

        // Perform removal within transaction
        const updated = await this.repository.withTransaction(async (client) => {
            return this.repository.remove(data, client);
        });

        // Create restock receipt if restocking
        if (data.postRemovalAction === 'restock') {
            await this.repository.withTransaction(async (client) => {
                return this.repository.receive({
                    componentId: assignment.componentId,
                    quantity: assignment.quantity,
                    serialNumbers: assignment.serialNumbers,
                    receiptType: 'restock',
                    referenceType: 'assignment',
                    referenceId: assignment.id,
                    notes: `Restocked from asset removal (${data.removalReason})`,
                    receivedBy: data.removedBy
                }, client);
            });
        }

        // Create audit log
        await this.repository.createAuditLog({
            componentId: assignment.componentId,
            assignmentId: data.assignmentId,
            receiptId: null,
            action: `Removed ${assignment.quantity} unit(s) from asset (${data.postRemovalAction})`,
            actionType: 'remove',
            oldValues: { status: 'installed' },
            newValues: {
                removalReason: data.removalReason,
                postRemovalAction: data.postRemovalAction
            },
            performedBy: data.removedBy,
            ipAddress: null,
            userAgent: null,
            notes: data.removalNotes || null
        });

        return updated;
    }

    async getAssignment(id: string): Promise<ComponentAssignment | null> {
        return this.repository.findAssignmentById(id);
    }

    async listAssignments(query: AssignmentListQuery): Promise<PaginatedResponse<ComponentAssignmentWithDetails>> {
        return this.repository.listAssignments(query);
    }

    async getAssetComponents(assetId: string): Promise<AssetComponents | null> {
        return this.repository.getAssetComponents(assetId);
    }

    // ==================== Receipt Operations ====================

    async receiveComponent(data: ReceiveComponentDto): Promise<ComponentReceipt> {
        const component = await this.repository.findById(data.componentId);
        if (!component) {
            throw new Error('Component not found');
        }

        // Validate serial numbers if provided
        if (data.serialNumbers && data.serialNumbers.length > 0) {
            const inUse = await this.repository.validateSerialNumbers(data.serialNumbers);
            if (inUse.length > 0) {
                throw new Error(`Serial numbers already in use: ${inUse.join(', ')}`);
            }
        }

        // Perform receipt within transaction
        const receipt = await this.repository.withTransaction(async (client) => {
            return this.repository.receive(data, client);
        });

        // Create audit log
        await this.repository.createAuditLog({
            componentId: data.componentId,
            assignmentId: null,
            receiptId: receipt.id,
            action: `Received ${data.quantity} unit(s) (${data.receiptType})`,
            actionType: 'receipt',
            oldValues: {
                totalQuantity: component.totalQuantity,
                availableQuantity: component.availableQuantity
            },
            newValues: {
                quantity: data.quantity,
                receiptType: data.receiptType,
                serialNumbers: data.serialNumbers
            },
            performedBy: data.receivedBy,
            ipAddress: null,
            userAgent: null,
            notes: data.notes || null
        });

        return receipt;
    }

    async listReceipts(query: ReceiptListQuery): Promise<PaginatedResponse<ComponentReceiptWithDetails>> {
        return this.repository.listReceipts(query);
    }

    // ==================== Stock Alerts ====================

    async getLowStockItems(): Promise<StockAlert[]> {
        return this.repository.getLowStockItems();
    }

    async getOutOfStockItems(): Promise<StockAlert[]> {
        return this.repository.getOutOfStockItems();
    }

    async getStockSummary(): Promise<StockSummary> {
        return this.repository.getStockSummary();
    }

    // ==================== Category CRUD ====================

    async createCategory(data: CreateCategoryDto): Promise<ComponentCategory> {
        // Check for duplicate code
        const existing = await this.repository.findCategoryByCode(data.code);
        if (existing) {
            throw new Error(`Category with code "${data.code}" already exists`);
        }

        // Validate parent if provided
        if (data.parentId) {
            const parent = await this.repository.findCategoryById(data.parentId);
            if (!parent) {
                throw new Error('Parent category not found');
            }
        }

        return this.repository.createCategory(data);
    }

    async getCategory(id: string): Promise<ComponentCategory | null> {
        return this.repository.findCategoryById(id);
    }

    async listCategories(query: CategoryListQuery): Promise<PaginatedResponse<ComponentCategory>> {
        return this.repository.listCategories(query);
    }

    async updateCategory(id: string, data: UpdateCategoryDto): Promise<ComponentCategory> {
        const existing = await this.repository.findCategoryById(id);
        if (!existing) {
            throw new Error('Category not found');
        }

        // Validate parent if changing
        if (data.parentId !== undefined && data.parentId !== null) {
            if (data.parentId === id) {
                throw new Error('Category cannot be its own parent');
            }
            const parent = await this.repository.findCategoryById(data.parentId);
            if (!parent) {
                throw new Error('Parent category not found');
            }
        }

        const updated = await this.repository.updateCategory(id, data);
        if (!updated) {
            throw new Error('Failed to update category');
        }

        return updated;
    }

    async deleteCategory(id: string): Promise<void> {
        const existing = await this.repository.findCategoryById(id);
        if (!existing) {
            throw new Error('Category not found');
        }

        // Check for components using this category
        const hasComponents = await this.repository.categoryHasComponents(id);
        if (hasComponents) {
            throw new Error('Cannot delete category that has components');
        }

        const deleted = await this.repository.deleteCategory(id);
        if (!deleted) {
            throw new Error('Failed to delete category');
        }
    }

    // ==================== Manufacturer CRUD ====================

    async createManufacturer(data: CreateManufacturerDto): Promise<ComponentManufacturer> {
        // Check for duplicate code
        const existing = await this.repository.findManufacturerByCode(data.code);
        if (existing) {
            throw new Error(`Manufacturer with code "${data.code}" already exists`);
        }

        return this.repository.createManufacturer(data);
    }

    async getManufacturer(id: string): Promise<ComponentManufacturer | null> {
        return this.repository.findManufacturerById(id);
    }

    async listManufacturers(query: ManufacturerListQuery): Promise<PaginatedResponse<ComponentManufacturer>> {
        return this.repository.listManufacturers(query);
    }

    async updateManufacturer(id: string, data: UpdateManufacturerDto): Promise<ComponentManufacturer> {
        const existing = await this.repository.findManufacturerById(id);
        if (!existing) {
            throw new Error('Manufacturer not found');
        }

        const updated = await this.repository.updateManufacturer(id, data);
        if (!updated) {
            throw new Error('Failed to update manufacturer');
        }

        return updated;
    }

    async deleteManufacturer(id: string): Promise<void> {
        const existing = await this.repository.findManufacturerById(id);
        if (!existing) {
            throw new Error('Manufacturer not found');
        }

        // Check for components using this manufacturer
        const hasComponents = await this.repository.manufacturerHasComponents(id);
        if (hasComponents) {
            throw new Error('Cannot delete manufacturer that has components');
        }

        const deleted = await this.repository.deleteManufacturer(id);
        if (!deleted) {
            throw new Error('Failed to delete manufacturer');
        }
    }
}
