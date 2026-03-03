/**
 * Consumables Module - Service Layer
 * Business logic for consumable management
 */
import type { Pool } from 'pg';
import { ConsumableRepository } from './consumable.repository.js';
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
    CreateCategoryDto,
    UpdateCategoryDto,
    CreateManufacturerDto,
    UpdateManufacturerDto,
    ConsumableListQuery,
    IssueListQuery,
    ReceiptListQuery,
    AuditLogQuery,
    PaginatedResponse,
    StockSummary,
    LowStockItem
} from './consumable.types.js';

export class ConsumableService {
    private repository: ConsumableRepository;

    constructor(db: Pool) {
        this.repository = new ConsumableRepository(db);
    }

    // ==================== Consumable CRUD ====================

    async createConsumable(data: CreateConsumableDto, userId: string): Promise<ConsumableWithDetails> {
        const consumable = await this.repository.create(data, userId);

        // Log audit
        await this.repository.logAudit(
            'consumable',
            consumable.id,
            'CREATE',
            data as unknown as Record<string, unknown>,
            userId
        );

        const result = await this.repository.findByIdWithDetails(consumable.id);
        return result!;
    }

    async getConsumable(id: string): Promise<ConsumableWithDetails | null> {
        return this.repository.findByIdWithDetails(id);
    }

    async getConsumableByCode(code: string): Promise<Consumable | null> {
        return this.repository.findByCode(code);
    }

    async listConsumables(query: ConsumableListQuery): Promise<PaginatedResponse<ConsumableWithDetails>> {
        return this.repository.list(query);
    }

    async updateConsumable(
        id: string,
        data: UpdateConsumableDto,
        userId: string
    ): Promise<ConsumableWithDetails | null> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            return null;
        }

        const updated = await this.repository.update(id, data, userId);
        if (!updated) {
            return null;
        }

        // Log audit
        await this.repository.logAudit(
            'consumable',
            id,
            'UPDATE',
            { before: existing, after: data },
            userId
        );

        return this.repository.findByIdWithDetails(id);
    }

    async deleteConsumable(id: string, userId: string): Promise<boolean> {
        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('Consumable not found');
        }

        // Check if there are any issues for this consumable
        const issues = await this.repository.getIssues({ consumableId: id, limit: 1 });
        if (issues.pagination.total > 0) {
            throw new Error('Cannot delete consumable with existing issue history');
        }

        const deleted = await this.repository.delete(id);

        if (deleted) {
            await this.repository.logAudit(
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
        // Validate consumable exists and is active
        const consumable = await this.repository.findById(consumableId);
        if (!consumable) {
            throw new Error('Consumable not found');
        }

        if (consumable.status !== 'active') {
            throw new Error(`Cannot issue: Consumable status is ${consumable.status}`);
        }

        // Validate quantity
        if (data.quantity > consumable.quantity) {
            throw new Error(
                `Cannot issue: Requested ${data.quantity} but only ${consumable.quantity} available`
            );
        }

        if (consumable.quantity === 0) {
            throw new Error('Cannot issue: Consumable is out of stock');
        }

        const issue = await this.repository.issue(consumableId, {
            ...data,
            consumableId
        }, userId);

        // Log audit
        await this.repository.logAudit(
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
        return this.repository.findIssueById(issueId);
    }

    async getIssues(query: IssueListQuery): Promise<PaginatedResponse<ConsumableIssueWithDetails>> {
        return this.repository.getIssues(query);
    }

    async getConsumableIssues(
        consumableId: string,
        query: Omit<IssueListQuery, 'consumableId'>
    ): Promise<PaginatedResponse<ConsumableIssueWithDetails>> {
        return this.repository.getIssues({ ...query, consumableId });
    }

    // ==================== Receipt Operations ====================

    async receiveConsumable(
        consumableId: string,
        data: Omit<ReceiveConsumableDto, 'consumableId'>,
        userId: string
    ): Promise<ConsumableReceipt> {
        // Validate consumable exists
        const consumable = await this.repository.findById(consumableId);
        if (!consumable) {
            throw new Error('Consumable not found');
        }

        const receipt = await this.repository.receive(consumableId, {
            ...data,
            consumableId
        }, userId);

        // Log audit
        await this.repository.logAudit(
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

    async getReceipt(receiptId: string): Promise<ConsumableReceipt | null> {
        return this.repository.findReceiptById(receiptId);
    }

    async getReceipts(query: ReceiptListQuery): Promise<PaginatedResponse<ConsumableReceiptWithDetails>> {
        return this.repository.getReceipts(query);
    }

    async getConsumableReceipts(
        consumableId: string,
        query: Omit<ReceiptListQuery, 'consumableId'>
    ): Promise<PaginatedResponse<ConsumableReceiptWithDetails>> {
        return this.repository.getReceipts({ ...query, consumableId });
    }

    // ==================== Stock Alerts ====================

    async getLowStockItems(): Promise<LowStockItem[]> {
        return this.repository.getLowStockItems();
    }

    async getOutOfStockItems(): Promise<LowStockItem[]> {
        return this.repository.getOutOfStockItems();
    }

    async getStockSummary(): Promise<StockSummary> {
        return this.repository.getStockSummary();
    }

    // ==================== Categories ====================

    async getCategories(activeOnly: boolean = true): Promise<ConsumableCategory[]> {
        return this.repository.getCategories(activeOnly);
    }

    async getCategory(id: string): Promise<ConsumableCategory | null> {
        return this.repository.getCategoryById(id);
    }

    async createCategory(data: CreateCategoryDto, userId: string): Promise<ConsumableCategory> {
        const category = await this.repository.createCategory(data);

        await this.repository.logAudit(
            'category',
            category.id,
            'CREATE',
            data as unknown as Record<string, unknown>,
            userId
        );

        return category;
    }

    async updateCategory(
        id: string,
        data: UpdateCategoryDto,
        userId: string
    ): Promise<ConsumableCategory | null> {
        const existing = await this.repository.getCategoryById(id);
        if (!existing) {
            return null;
        }

        const updated = await this.repository.updateCategory(id, data);

        if (updated) {
            await this.repository.logAudit(
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
        const existing = await this.repository.getCategoryById(id);
        if (!existing) {
            throw new Error('Category not found');
        }

        const deleted = await this.repository.deleteCategory(id);

        if (deleted) {
            await this.repository.logAudit(
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

    async getManufacturers(activeOnly: boolean = true): Promise<ConsumableManufacturer[]> {
        return this.repository.getManufacturers(activeOnly);
    }

    async getManufacturer(id: string): Promise<ConsumableManufacturer | null> {
        return this.repository.getManufacturerById(id);
    }

    async createManufacturer(data: CreateManufacturerDto, userId: string): Promise<ConsumableManufacturer> {
        const manufacturer = await this.repository.createManufacturer(data);

        await this.repository.logAudit(
            'manufacturer',
            manufacturer.id,
            'CREATE',
            data as unknown as Record<string, unknown>,
            userId
        );

        return manufacturer;
    }

    async updateManufacturer(
        id: string,
        data: UpdateManufacturerDto,
        userId: string
    ): Promise<ConsumableManufacturer | null> {
        const existing = await this.repository.getManufacturerById(id);
        if (!existing) {
            return null;
        }

        const updated = await this.repository.updateManufacturer(id, data);

        if (updated) {
            await this.repository.logAudit(
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
        const existing = await this.repository.getManufacturerById(id);
        if (!existing) {
            throw new Error('Manufacturer not found');
        }

        const deleted = await this.repository.deleteManufacturer(id);

        if (deleted) {
            await this.repository.logAudit(
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

    async getAuditLogs(query: AuditLogQuery): Promise<PaginatedResponse<ConsumableAuditLog>> {
        return this.repository.getAuditLogs(query);
    }

    async getConsumableAuditLogs(
        consumableId: string,
        query: Omit<AuditLogQuery, 'entityId'>
    ): Promise<PaginatedResponse<ConsumableAuditLog>> {
        return this.repository.getAuditLogs({
            ...query,
            entityType: 'consumable',
            entityId: consumableId
        });
    }
}
