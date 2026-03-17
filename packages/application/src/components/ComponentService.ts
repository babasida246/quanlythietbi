/**
 * Components Module - Service Layer (Clean Architecture)
 * Business logic for component management
 */
import type {
    Component,
    ComponentWithDetails,
    ComponentAssignment,
    ComponentAssignmentWithDetails,
    ComponentReceipt,
    ComponentReceiptWithDetails,
    ComponentCategory,
    ComponentManufacturer,
    ComponentAuditLog,
    CreateComponentDto,
    UpdateComponentDto,
    InstallComponentDto,
    RemoveComponentDto,
    ReceiveComponentDto,
    CreateComponentCategoryDto,
    UpdateComponentCategoryDto,
    CreateComponentManufacturerDto,
    UpdateComponentManufacturerDto,
    ComponentListQuery,
    ComponentAssignmentListQuery,
    ComponentReceiptListQuery,
    ComponentCategoryListQuery,
    ComponentManufacturerListQuery,
    ComponentPaginatedResponse,
    ComponentStockAlert,
    ComponentStockSummary,
    AssetComponents
} from '@qltb/contracts';

// ==================== Repository Interface ====================

export interface IComponentRepository {
    create(dto: CreateComponentDto): Promise<Component>;
    findById(id: string): Promise<Component | null>;
    findByIdWithDetails(id: string): Promise<ComponentWithDetails | null>;
    findByCode(code: string): Promise<Component | null>;
    list(query: ComponentListQuery): Promise<ComponentPaginatedResponse<ComponentWithDetails>>;
    update(id: string, dto: UpdateComponentDto): Promise<Component | null>;
    delete(id: string): Promise<boolean>;
    hasAssignments(id: string): Promise<boolean>;

    install(dto: InstallComponentDto): Promise<ComponentAssignment>;
    remove(dto: RemoveComponentDto): Promise<ComponentAssignment>;
    findAssignmentById(id: string): Promise<ComponentAssignment | null>;
    listAssignments(query: ComponentAssignmentListQuery): Promise<ComponentPaginatedResponse<ComponentAssignmentWithDetails>>;
    getAssetComponents(assetId: string): Promise<AssetComponents | null>;
    validateSerialNumbers(serialNumbers: string[]): Promise<string[]>;

    receive(dto: ReceiveComponentDto): Promise<ComponentReceipt>;
    listReceipts(query: ComponentReceiptListQuery): Promise<ComponentPaginatedResponse<ComponentReceiptWithDetails>>;

    getLowStockItems(): Promise<ComponentStockAlert[]>;
    getOutOfStockItems(): Promise<ComponentStockAlert[]>;
    getStockSummary(): Promise<ComponentStockSummary>;

    createCategory(dto: CreateComponentCategoryDto): Promise<ComponentCategory>;
    findCategoryById(id: string): Promise<ComponentCategory | null>;
    findCategoryByCode(code: string): Promise<ComponentCategory | null>;
    listCategories(query: ComponentCategoryListQuery): Promise<ComponentPaginatedResponse<ComponentCategory>>;
    updateCategory(id: string, dto: UpdateComponentCategoryDto): Promise<ComponentCategory | null>;
    deleteCategory(id: string): Promise<boolean>;
    categoryHasComponents(id: string): Promise<boolean>;

    createManufacturer(dto: CreateComponentManufacturerDto): Promise<ComponentManufacturer>;
    findManufacturerById(id: string): Promise<ComponentManufacturer | null>;
    findManufacturerByCode(code: string): Promise<ComponentManufacturer | null>;
    listManufacturers(query: ComponentManufacturerListQuery): Promise<ComponentPaginatedResponse<ComponentManufacturer>>;
    updateManufacturer(id: string, dto: UpdateComponentManufacturerDto): Promise<ComponentManufacturer | null>;
    deleteManufacturer(id: string): Promise<boolean>;
    manufacturerHasComponents(id: string): Promise<boolean>;

    createAuditLog(log: Omit<ComponentAuditLog, 'id' | 'performedAt'>): Promise<void>;
}

// ==================== Service Class ====================

export class ComponentService {
    constructor(private readonly repo: IComponentRepository) { }

    // ==================== Component CRUD ====================

    async createComponent(data: CreateComponentDto): Promise<Component> {
        const existing = await this.repo.findByCode(data.componentCode);
        if (existing) {
            throw new Error(`Component with code "${data.componentCode}" already exists`);
        }

        if (data.categoryId) {
            const category = await this.repo.findCategoryById(data.categoryId);
            if (!category) {
                throw new Error('Category not found');
            }
        }

        if (data.manufacturerId) {
            const manufacturer = await this.repo.findManufacturerById(data.manufacturerId);
            if (!manufacturer) {
                throw new Error('Manufacturer not found');
            }
        }

        const component = await this.repo.create(data);

        await this.repo.createAuditLog({
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
        return this.repo.findById(id);
    }

    async getComponentWithDetails(id: string): Promise<ComponentWithDetails | null> {
        return this.repo.findByIdWithDetails(id);
    }

    async listComponents(query: ComponentListQuery): Promise<ComponentPaginatedResponse<ComponentWithDetails>> {
        return this.repo.list(query);
    }

    async updateComponent(id: string, data: UpdateComponentDto): Promise<Component> {
        const existing = await this.repo.findById(id);
        if (!existing) {
            throw new Error('Component not found');
        }

        if (data.categoryId !== undefined && data.categoryId !== null) {
            const category = await this.repo.findCategoryById(data.categoryId);
            if (!category) {
                throw new Error('Category not found');
            }
        }

        if (data.manufacturerId !== undefined && data.manufacturerId !== null) {
            const manufacturer = await this.repo.findManufacturerById(data.manufacturerId);
            if (!manufacturer) {
                throw new Error('Manufacturer not found');
            }
        }

        const updated = await this.repo.update(id, data);
        if (!updated) {
            throw new Error('Failed to update component');
        }

        await this.repo.createAuditLog({
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
        const existing = await this.repo.findById(id);
        if (!existing) {
            throw new Error('Component not found');
        }

        const hasAssignments = await this.repo.hasAssignments(id);
        if (hasAssignments) {
            throw new Error('Cannot delete component with existing assignment history');
        }

        const deleted = await this.repo.delete(id);
        if (!deleted) {
            throw new Error('Failed to delete component');
        }

        await this.repo.createAuditLog({
            componentId: null,
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
        const component = await this.repo.findById(data.componentId);
        if (!component) {
            throw new Error('Component not found');
        }

        if (component.status !== 'active') {
            throw new Error('Cannot install inactive or discontinued component');
        }

        if (data.quantity > component.availableQuantity) {
            throw new Error(`Requested ${data.quantity} but only ${component.availableQuantity} available`);
        }

        if (data.serialNumbers && data.serialNumbers.length > 0) {
            const inUse = await this.repo.validateSerialNumbers(data.serialNumbers);
            if (inUse.length > 0) {
                throw new Error(`Serial numbers already in use: ${inUse.join(', ')}`);
            }
        }

        const assignment = await this.repo.install(data);

        await this.repo.createAuditLog({
            componentId: data.componentId,
            assignmentId: assignment.id,
            receiptId: null,
            action: `Installed ${data.quantity} unit(s) into asset`,
            actionType: 'install',
            oldValues: { availableQuantity: component.availableQuantity },
            newValues: { quantity: data.quantity, assetId: data.assetId, serialNumbers: data.serialNumbers },
            performedBy: data.installedBy,
            ipAddress: null,
            userAgent: null,
            notes: data.installationNotes ?? null
        });

        return assignment;
    }

    async removeComponent(data: RemoveComponentDto): Promise<ComponentAssignment> {
        const assignment = await this.repo.findAssignmentById(data.assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        if (assignment.status !== 'installed') {
            throw new Error('Component is already removed from this asset');
        }

        const updated = await this.repo.remove(data);

        if (data.postRemovalAction === 'restock') {
            await this.repo.receive({
                componentId: assignment.componentId,
                quantity: assignment.quantity,
                serialNumbers: assignment.serialNumbers ?? undefined,
                receiptType: 'restock',
                referenceType: 'assignment',
                referenceId: assignment.id,
                notes: `Restocked from asset removal (${data.removalReason})`,
                receivedBy: data.removedBy
            });
        }

        await this.repo.createAuditLog({
            componentId: assignment.componentId,
            assignmentId: data.assignmentId,
            receiptId: null,
            action: `Removed ${assignment.quantity} unit(s) from asset (${data.postRemovalAction})`,
            actionType: 'remove',
            oldValues: { status: 'installed' },
            newValues: { removalReason: data.removalReason, postRemovalAction: data.postRemovalAction },
            performedBy: data.removedBy,
            ipAddress: null,
            userAgent: null,
            notes: data.removalNotes ?? null
        });

        return updated;
    }

    async getAssignment(id: string): Promise<ComponentAssignment | null> {
        return this.repo.findAssignmentById(id);
    }

    async listAssignments(query: ComponentAssignmentListQuery): Promise<ComponentPaginatedResponse<ComponentAssignmentWithDetails>> {
        return this.repo.listAssignments(query);
    }

    async getAssetComponents(assetId: string): Promise<AssetComponents | null> {
        return this.repo.getAssetComponents(assetId);
    }

    // ==================== Receipt Operations ====================

    async receiveComponent(data: ReceiveComponentDto): Promise<ComponentReceipt> {
        const component = await this.repo.findById(data.componentId);
        if (!component) {
            throw new Error('Component not found');
        }

        if (data.serialNumbers && data.serialNumbers.length > 0) {
            const inUse = await this.repo.validateSerialNumbers(data.serialNumbers);
            if (inUse.length > 0) {
                throw new Error(`Serial numbers already in use: ${inUse.join(', ')}`);
            }
        }

        const receipt = await this.repo.receive(data);

        await this.repo.createAuditLog({
            componentId: data.componentId,
            assignmentId: null,
            receiptId: receipt.id,
            action: `Received ${data.quantity} unit(s) (${data.receiptType})`,
            actionType: 'receipt',
            oldValues: { totalQuantity: component.totalQuantity, availableQuantity: component.availableQuantity },
            newValues: { quantity: data.quantity, receiptType: data.receiptType, serialNumbers: data.serialNumbers },
            performedBy: data.receivedBy,
            ipAddress: null,
            userAgent: null,
            notes: data.notes ?? null
        });

        return receipt;
    }

    async listReceipts(query: ComponentReceiptListQuery): Promise<ComponentPaginatedResponse<ComponentReceiptWithDetails>> {
        return this.repo.listReceipts(query);
    }

    // ==================== Stock Alerts ====================

    async getLowStockItems(): Promise<ComponentStockAlert[]> {
        return this.repo.getLowStockItems();
    }

    async getOutOfStockItems(): Promise<ComponentStockAlert[]> {
        return this.repo.getOutOfStockItems();
    }

    async getStockSummary(): Promise<ComponentStockSummary> {
        return this.repo.getStockSummary();
    }

    // ==================== Category CRUD ====================

    async createCategory(data: CreateComponentCategoryDto): Promise<ComponentCategory> {
        const existing = await this.repo.findCategoryByCode(data.code);
        if (existing) {
            throw new Error(`Category with code "${data.code}" already exists`);
        }

        if (data.parentId) {
            const parent = await this.repo.findCategoryById(data.parentId);
            if (!parent) {
                throw new Error('Parent category not found');
            }
        }

        return this.repo.createCategory(data);
    }

    async getCategory(id: string): Promise<ComponentCategory | null> {
        return this.repo.findCategoryById(id);
    }

    async listCategories(query: ComponentCategoryListQuery): Promise<ComponentPaginatedResponse<ComponentCategory>> {
        return this.repo.listCategories(query);
    }

    async updateCategory(id: string, data: UpdateComponentCategoryDto): Promise<ComponentCategory> {
        const existing = await this.repo.findCategoryById(id);
        if (!existing) {
            throw new Error('Category not found');
        }

        if (data.parentId !== undefined && data.parentId !== null) {
            if (data.parentId === id) {
                throw new Error('Category cannot be its own parent');
            }
            const parent = await this.repo.findCategoryById(data.parentId);
            if (!parent) {
                throw new Error('Parent category not found');
            }
        }

        const updated = await this.repo.updateCategory(id, data);
        if (!updated) {
            throw new Error('Failed to update category');
        }

        return updated;
    }

    async deleteCategory(id: string): Promise<void> {
        const existing = await this.repo.findCategoryById(id);
        if (!existing) {
            throw new Error('Category not found');
        }

        const hasComponents = await this.repo.categoryHasComponents(id);
        if (hasComponents) {
            throw new Error('Cannot delete category that has components');
        }

        const deleted = await this.repo.deleteCategory(id);
        if (!deleted) {
            throw new Error('Failed to delete category');
        }
    }

    // ==================== Manufacturer CRUD ====================

    async createManufacturer(data: CreateComponentManufacturerDto): Promise<ComponentManufacturer> {
        const existing = await this.repo.findManufacturerByCode(data.code);
        if (existing) {
            throw new Error(`Manufacturer with code "${data.code}" already exists`);
        }

        return this.repo.createManufacturer(data);
    }

    async getManufacturer(id: string): Promise<ComponentManufacturer | null> {
        return this.repo.findManufacturerById(id);
    }

    async listManufacturers(query: ComponentManufacturerListQuery): Promise<ComponentPaginatedResponse<ComponentManufacturer>> {
        return this.repo.listManufacturers(query);
    }

    async updateManufacturer(id: string, data: UpdateComponentManufacturerDto): Promise<ComponentManufacturer> {
        const existing = await this.repo.findManufacturerById(id);
        if (!existing) {
            throw new Error('Manufacturer not found');
        }

        const updated = await this.repo.updateManufacturer(id, data);
        if (!updated) {
            throw new Error('Failed to update manufacturer');
        }

        return updated;
    }

    async deleteManufacturer(id: string): Promise<void> {
        const existing = await this.repo.findManufacturerById(id);
        if (!existing) {
            throw new Error('Manufacturer not found');
        }

        const hasComponents = await this.repo.manufacturerHasComponents(id);
        if (hasComponents) {
            throw new Error('Cannot delete manufacturer that has components');
        }

        const deleted = await this.repo.deleteManufacturer(id);
        if (!deleted) {
            throw new Error('Failed to delete manufacturer');
        }
    }
}
