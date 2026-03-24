/**
 * Consumables Module - Service Layer (Clean Architecture)
 * Business logic for consumable management
 */
import type {
    Consumable,
    ConsumableWithDetails,
    ConsumableIssue,
    ConsumableIssueWithDetails,
    ConsumableReceipt,
    ConsumableReceiptWithDetails,
    ConsumableCategory,
    ConsumableManufacturer,
    ConsumableAuditLog,
    CreateConsumableDto,
    UpdateConsumableDto,
    IssueConsumableDto,
    ReceiveConsumableDto,
    CreateConsumableCategoryDto,
    UpdateConsumableCategoryDto,
    CreateConsumableManufacturerDto,
    UpdateConsumableManufacturerDto,
    ConsumableListQuery,
    ConsumableIssueListQuery,
    ConsumableReceiptListQuery,
    ConsumableAuditLogQuery,
    ConsumablePaginatedResponse,
    ConsumableStockSummary,
    LowStockConsumableItem
} from '@qltb/contracts';

// ==================== Repository Interface ====================

export interface IConsumableRepository {
    create(data: CreateConsumableDto, userId: string): Promise<Consumable>;
    findById(id: string): Promise<Consumable | null>;
    findByIdWithDetails(id: string): Promise<ConsumableWithDetails | null>;
    findByCode(code: string): Promise<Consumable | null>;
    list(query: ConsumableListQuery): Promise<ConsumablePaginatedResponse<ConsumableWithDetails>>;
    update(id: string, data: UpdateConsumableDto, userId: string): Promise<Consumable | null>;
    delete(id: string): Promise<boolean>;

    issue(consumableId: string, data: IssueConsumableDto, userId: string): Promise<ConsumableIssue>;
    findIssueById(issueId: string): Promise<ConsumableIssue | null>;
    getIssues(query: ConsumableIssueListQuery): Promise<ConsumablePaginatedResponse<ConsumableIssueWithDetails>>;

    receive(consumableId: string, data: ReceiveConsumableDto, userId: string): Promise<ConsumableReceipt>;
    findReceiptById(receiptId: string): Promise<ConsumableReceipt | null>;
    getReceipts(query: ConsumableReceiptListQuery): Promise<ConsumablePaginatedResponse<ConsumableReceiptWithDetails>>;

    getLowStockItems(): Promise<LowStockConsumableItem[]>;
    getOutOfStockItems(): Promise<LowStockConsumableItem[]>;
    getStockSummary(): Promise<ConsumableStockSummary>;

    getCategories(activeOnly?: boolean): Promise<ConsumableCategory[]>;
    getCategoryById(id: string): Promise<ConsumableCategory | null>;
    createCategory(data: CreateConsumableCategoryDto): Promise<ConsumableCategory>;
    updateCategory(id: string, data: UpdateConsumableCategoryDto): Promise<ConsumableCategory | null>;
    deleteCategory(id: string): Promise<boolean>;

    getManufacturers(activeOnly?: boolean): Promise<ConsumableManufacturer[]>;
    getManufacturerById(id: string): Promise<ConsumableManufacturer | null>;
    createManufacturer(data: CreateConsumableManufacturerDto): Promise<ConsumableManufacturer>;
    updateManufacturer(id: string, data: UpdateConsumableManufacturerDto): Promise<ConsumableManufacturer | null>;
    deleteManufacturer(id: string): Promise<boolean>;

    logAudit(entityType: string, entityId: string, action: string, changes: Record<string, unknown>, performedBy: string): Promise<void>;
    getAuditLogs(query: ConsumableAuditLogQuery): Promise<ConsumablePaginatedResponse<ConsumableAuditLog>>;
}

// ==================== Service Class ====================

export class ConsumableService {
    constructor(private readonly repo: IConsumableRepository) { }

    // ==================== Consumable CRUD ====================

    async createConsumable(data: CreateConsumableDto, userId: string): Promise<ConsumableWithDetails> {
        const consumable = await this.repo.create(data, userId);

        await this.repo.logAudit(
            'consumable',
            consumable.id,
            'CREATE',
            data as unknown as Record<string, unknown>,
            userId
        );

        const result = await this.repo.findByIdWithDetails(consumable.id);
        return result!;
    }

    async getConsumable(id: string): Promise<ConsumableWithDetails | null> {
        return this.repo.findByIdWithDetails(id);
    }

    async getConsumableByCode(code: string): Promise<Consumable | null> {
        return this.repo.findByCode(code);
    }

    async listConsumables(query: ConsumableListQuery): Promise<ConsumablePaginatedResponse<ConsumableWithDetails>> {
        return this.repo.list(query);
    }

    async updateConsumable(id: string, data: UpdateConsumableDto, userId: string): Promise<ConsumableWithDetails | null> {
        const existing = await this.repo.findById(id);
        if (!existing) {
            return null;
        }

        const updated = await this.repo.update(id, data, userId);
        if (!updated) {
            return null;
        }

        await this.repo.logAudit(
            'consumable',
            id,
            'UPDATE',
            { before: existing, after: data },
            userId
        );

        return this.repo.findByIdWithDetails(id);
    }

    async deleteConsumable(id: string, userId: string): Promise<boolean> {
        const existing = await this.repo.findById(id);
        if (!existing) {
            throw new Error('Consumable not found');
        }

        const issues = await this.repo.getIssues({ consumableId: id, limit: 1 });
        if (issues.pagination.total > 0) {
            throw new Error('Cannot delete consumable with existing issue history');
        }

        const deleted = await this.repo.delete(id);

        if (deleted) {
            await this.repo.logAudit(
                'consumable',
                id,
                'DELETE',
                existing as unknown as Record<string, unknown>,
                userId
            );
        }

        return deleted;
    }

    // ==================== Issue Operations ====================

    async issueConsumable(
        consumableId: string,
        data: Omit<IssueConsumableDto, 'consumableId'>,
        userId: string
    ): Promise<ConsumableIssue> {
        const consumable = await this.repo.findById(consumableId);
        if (!consumable) {
            throw new Error('Consumable not found');
        }

        if (consumable.status !== 'active') {
            throw new Error(`Cannot issue: Consumable status is ${consumable.status}`);
        }

        if (data.quantity > consumable.quantity) {
            throw new Error(`Cannot issue: Requested ${data.quantity} but only ${consumable.quantity} available`);
        }

        if (consumable.quantity === 0) {
            throw new Error('Cannot issue: Consumable is out of stock');
        }

        const issue = await this.repo.issue(consumableId, { ...data, consumableId }, userId);

        await this.repo.logAudit(
            'issue',
            issue.id,
            'ISSUE',
            {
                consumableId,
                quantity: data.quantity,
                issueType: data.issueType,
                issuedToUserId: data.issuedToUserId,
                issuedToDepartment: data.issuedToDepartment,
                issuedToAssetId: data.issuedToAssetId
            },
            userId
        );

        return issue;
    }

    async getIssue(issueId: string): Promise<ConsumableIssue | null> {
        return this.repo.findIssueById(issueId);
    }

    async getConsumableIssues(
        consumableId: string,
        query: Omit<ConsumableIssueListQuery, 'consumableId'>
    ): Promise<ConsumablePaginatedResponse<ConsumableIssueWithDetails>> {
        return this.repo.getIssues({ ...query, consumableId });
    }

    // ==================== Receipt Operations ====================

    async receiveConsumable(
        consumableId: string,
        data: Omit<ReceiveConsumableDto, 'consumableId'>,
        userId: string
    ): Promise<ConsumableReceipt> {
        const consumable = await this.repo.findById(consumableId);
        if (!consumable) {
            throw new Error('Consumable not found');
        }

        const receipt = await this.repo.receive(consumableId, { ...data, consumableId }, userId);

        await this.repo.logAudit(
            'receipt',
            receipt.id,
            'RECEIVE',
            {
                consumableId,
                quantity: data.quantity,
                receiptType: data.receiptType,
                purchaseOrder: data.purchaseOrder,
                unitCost: data.unitCost
            },
            userId
        );

        return receipt;
    }

    async getConsumableReceipts(
        consumableId: string,
        query: Omit<ConsumableReceiptListQuery, 'consumableId'>
    ): Promise<ConsumablePaginatedResponse<ConsumableReceiptWithDetails>> {
        return this.repo.getReceipts({ ...query, consumableId });
    }

    // ==================== Stock Alerts ====================

    async getLowStockItems(): Promise<LowStockConsumableItem[]> {
        return this.repo.getLowStockItems();
    }

    async getOutOfStockItems(): Promise<LowStockConsumableItem[]> {
        return this.repo.getOutOfStockItems();
    }

    async getStockSummary(): Promise<ConsumableStockSummary> {
        return this.repo.getStockSummary();
    }

    // ==================== Categories ====================

    async getCategories(activeOnly = true): Promise<ConsumableCategory[]> {
        return this.repo.getCategories(activeOnly);
    }

    async getCategory(id: string): Promise<ConsumableCategory | null> {
        return this.repo.getCategoryById(id);
    }

    async createCategory(data: CreateConsumableCategoryDto, userId: string): Promise<ConsumableCategory> {
        const category = await this.repo.createCategory(data);

        await this.repo.logAudit(
            'category',
            category.id,
            'CREATE',
            data as unknown as Record<string, unknown>,
            userId
        );

        return category;
    }

    async updateCategory(id: string, data: UpdateConsumableCategoryDto, userId: string): Promise<ConsumableCategory | null> {
        const existing = await this.repo.getCategoryById(id);
        if (!existing) {
            return null;
        }

        const updated = await this.repo.updateCategory(id, data);

        if (updated) {
            await this.repo.logAudit(
                'category',
                id,
                'UPDATE',
                { before: existing, after: data },
                userId
            );
        }

        return updated;
    }

    async deleteCategory(id: string, userId: string): Promise<boolean> {
        const existing = await this.repo.getCategoryById(id);
        if (!existing) {
            throw new Error('Category not found');
        }

        const deleted = await this.repo.deleteCategory(id);

        if (deleted) {
            await this.repo.logAudit(
                'category',
                id,
                'DELETE',
                existing as unknown as Record<string, unknown>,
                userId
            );
        }

        return deleted;
    }

    // ==================== Manufacturers ====================

    async getManufacturers(activeOnly = true): Promise<ConsumableManufacturer[]> {
        return this.repo.getManufacturers(activeOnly);
    }

    async getManufacturer(id: string): Promise<ConsumableManufacturer | null> {
        return this.repo.getManufacturerById(id);
    }

    async createManufacturer(data: CreateConsumableManufacturerDto, userId: string): Promise<ConsumableManufacturer> {
        const manufacturer = await this.repo.createManufacturer(data);

        await this.repo.logAudit(
            'manufacturer',
            manufacturer.id,
            'CREATE',
            data as unknown as Record<string, unknown>,
            userId
        );

        return manufacturer;
    }

    async updateManufacturer(id: string, data: UpdateConsumableManufacturerDto, userId: string): Promise<ConsumableManufacturer | null> {
        const existing = await this.repo.getManufacturerById(id);
        if (!existing) {
            return null;
        }

        const updated = await this.repo.updateManufacturer(id, data);

        if (updated) {
            await this.repo.logAudit(
                'manufacturer',
                id,
                'UPDATE',
                { before: existing, after: data },
                userId
            );
        }

        return updated;
    }

    async deleteManufacturer(id: string, userId: string): Promise<boolean> {
        const existing = await this.repo.getManufacturerById(id);
        if (!existing) {
            throw new Error('Manufacturer not found');
        }

        const deleted = await this.repo.deleteManufacturer(id);

        if (deleted) {
            await this.repo.logAudit(
                'manufacturer',
                id,
                'DELETE',
                existing as unknown as Record<string, unknown>,
                userId
            );
        }

        return deleted;
    }

    // ==================== Audit Logs ====================

    async getAuditLogs(query: ConsumableAuditLogQuery): Promise<ConsumablePaginatedResponse<ConsumableAuditLog>> {
        return this.repo.getAuditLogs(query);
    }

    async getConsumableAuditLogs(
        consumableId: string,
        query: Omit<ConsumableAuditLogQuery, 'entityId'>
    ): Promise<ConsumablePaginatedResponse<ConsumableAuditLog>> {
        return this.repo.getAuditLogs({ ...query, entityType: 'consumable', entityId: consumableId });
    }
}
