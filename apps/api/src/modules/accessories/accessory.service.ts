/**
 * Accessories Module - Service
 * Business logic layer for accessories
 */
import type { Pool } from 'pg';
import { AccessoryRepository } from './accessory.repository.js';
import type {
    Accessory,
    AccessoryWithDetails,
    AccessoryCheckout,
    AccessoryCheckoutWithDetails,
    AccessoryStockAdjustment,
    AccessoryAuditLog,
    AccessoryCategory,
    AccessoryManufacturer,
    CreateAccessoryDto,
    UpdateAccessoryDto,
    CheckoutAccessoryDto,
    AdjustStockDto,
    CreateCategoryDto,
    CreateManufacturerDto,
    AccessoryListQuery,
    PaginatedResult,
    StockSummary,
    CheckoutSummary
} from './accessory.types.js';

export class AccessoryService {
    private repository: AccessoryRepository;

    constructor(db: Pool) {
        this.repository = new AccessoryRepository(db);
    }

    // ==================== Accessory CRUD ====================

    async createAccessory(data: CreateAccessoryDto, userId: string): Promise<AccessoryWithDetails> {
        const accessory = await this.repository.create(data, userId);

        // Log audit
        await this.repository.logAudit(
            accessory.id,
            'created',
            userId,
            undefined,
            { ...data },
            'Accessory created'
        );

        return this.getAccessory(accessory.id) as Promise<AccessoryWithDetails>;
    }

    async getAccessory(id: string): Promise<AccessoryWithDetails | null> {
        return this.repository.findByIdWithDetails(id);
    }

    async getAccessoryByCode(code: string): Promise<Accessory | null> {
        return this.repository.findByCode(code);
    }

    async listAccessories(query: AccessoryListQuery): Promise<PaginatedResult<AccessoryWithDetails>> {
        return this.repository.list(query);
    }

    async updateAccessory(id: string, data: UpdateAccessoryDto, userId: string): Promise<AccessoryWithDetails | null> {
        const existing = await this.repository.findById(id);
        if (!existing) return null;

        const updated = await this.repository.update(id, data, userId);
        if (!updated) return null;

        // Log audit
        await this.repository.logAudit(
            id,
            'updated',
            userId,
            existing,
            data,
            'Accessory updated'
        );

        return this.getAccessory(id);
    }

    async deleteAccessory(id: string, userId: string): Promise<boolean> {
        const accessory = await this.repository.findById(id);
        if (!accessory) return false;

        // Check for active checkouts
        const activeCount = await this.repository.countActiveCheckouts(id);
        if (activeCount > 0) {
            throw new Error(`Cannot delete accessory: ${activeCount} items are still checked out`);
        }

        const deleted = await this.repository.delete(id);

        if (deleted) {
            // We can't log audit for deleted item, but we could log to a separate table if needed
        }

        return deleted;
    }

    // ==================== Checkout/Checkin Operations ====================

    async checkoutAccessory(data: CheckoutAccessoryDto, userId: string): Promise<AccessoryCheckout> {
        // Validate accessory exists and is active
        const accessory = await this.repository.findById(data.accessoryId);
        if (!accessory) {
            throw new Error('Accessory not found');
        }

        if (accessory.status !== 'active') {
            throw new Error(`Cannot checkout: Accessory status is ${accessory.status}`);
        }

        // Validate available quantity
        if (data.quantity > accessory.availableQuantity) {
            throw new Error(`Cannot checkout: Requested ${data.quantity} but only ${accessory.availableQuantity} available`);
        }

        const checkout = await this.repository.checkout(data, userId);

        // Log audit
        await this.repository.logAudit(
            data.accessoryId,
            'checkout',
            userId,
            { availableQuantity: accessory.availableQuantity },
            {
                quantity: data.quantity,
                assignmentType: data.assignmentType,
                assignedUserId: data.assignedUserId,
                assignedAssetId: data.assignedAssetId
            },
            'Accessory checked out',
            checkout.id
        );

        return checkout;
    }

    async checkinAccessory(checkoutId: string, quantityReturned: number, notes: string | null, userId: string): Promise<AccessoryCheckout> {
        // Validate checkout exists
        const checkout = await this.repository.findCheckoutById(checkoutId);
        if (!checkout) {
            throw new Error('Checkout record not found');
        }

        if (checkout.status === 'returned') {
            throw new Error('This checkout has already been fully returned');
        }

        const remainingQuantity = checkout.quantity - checkout.quantityReturned;
        if (quantityReturned > remainingQuantity) {
            throw new Error(`Cannot return ${quantityReturned}: Only ${remainingQuantity} items remaining`);
        }

        const updated = await this.repository.checkin(checkoutId, quantityReturned, notes, userId);
        if (!updated) {
            throw new Error('Failed to process checkin');
        }

        // Log audit
        await this.repository.logAudit(
            checkout.accessoryId,
            'checkin',
            userId,
            { quantityReturned: checkout.quantityReturned },
            { quantityReturned: updated.quantityReturned, status: updated.status },
            notes || 'Accessory checked in',
            checkoutId
        );

        return updated;
    }

    async getCheckouts(accessoryId: string, activeOnly: boolean = false): Promise<AccessoryCheckoutWithDetails[]> {
        if (activeOnly) {
            return this.repository.getActiveCheckouts(accessoryId);
        }
        return this.repository.getCheckouts(accessoryId);
    }

    async getCheckoutById(checkoutId: string): Promise<AccessoryCheckout | null> {
        return this.repository.findCheckoutById(checkoutId);
    }

    // ==================== Stock Management ====================

    async adjustStock(data: AdjustStockDto, userId: string): Promise<AccessoryStockAdjustment> {
        const accessory = await this.repository.findById(data.accessoryId);
        if (!accessory) {
            throw new Error('Accessory not found');
        }

        // Validate stock won't go negative
        const newTotal = accessory.totalQuantity + data.quantityChange;
        const newAvailable = accessory.availableQuantity + data.quantityChange;

        if (newTotal < 0) {
            throw new Error(`Cannot adjust: Would result in negative total quantity (${newTotal})`);
        }

        if (newAvailable < 0) {
            throw new Error(`Cannot adjust: Would result in negative available quantity (${newAvailable})`);
        }

        const adjustment = await this.repository.adjustStock(data, userId);

        // Log audit
        await this.repository.logAudit(
            data.accessoryId,
            'stock_adjusted',
            userId,
            { totalQuantity: accessory.totalQuantity, availableQuantity: accessory.availableQuantity },
            { totalQuantity: newTotal, availableQuantity: newAvailable, adjustment: data },
            data.reason || 'Stock adjusted',
            undefined,
            adjustment.id
        );

        return adjustment;
    }

    async getStockAdjustments(accessoryId: string): Promise<AccessoryStockAdjustment[]> {
        return this.repository.getStockAdjustments(accessoryId);
    }

    // ==================== Alerts & Monitoring ====================

    async getLowStockItems(organizationId?: string): Promise<AccessoryWithDetails[]> {
        return this.repository.getLowStockItems(organizationId);
    }

    async getOutOfStockItems(organizationId?: string): Promise<AccessoryWithDetails[]> {
        return this.repository.getOutOfStockItems(organizationId);
    }

    async getOverdueCheckouts(): Promise<AccessoryCheckoutWithDetails[]> {
        return this.repository.getOverdueCheckouts();
    }

    async getStockSummary(organizationId?: string): Promise<StockSummary> {
        const accessories = await this.repository.list({
            status: ['active'],
            organizationId,
            limit: 1000
        });

        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let totalValue = 0;

        for (const acc of accessories.data) {
            if (acc.stockStatus === 'in_stock') inStock++;
            else if (acc.stockStatus === 'low_stock') lowStock++;
            else if (acc.stockStatus === 'out_of_stock') outOfStock++;

            totalValue += acc.unitPrice * acc.totalQuantity;
        }

        return {
            totalItems: accessories.pagination.total,
            inStock,
            lowStock,
            outOfStock,
            totalValue,
            currency: 'VND'
        };
    }

    async getCheckoutSummary(organizationId?: string): Promise<CheckoutSummary> {
        // This would need a more complex query in production
        const overdueCheckouts = await this.repository.getOverdueCheckouts();

        return {
            totalCheckouts: 0, // Would need to count from DB
            activeCheckouts: 0, // Would need to count active
            overdueCheckouts: overdueCheckouts.length,
            returnedThisMonth: 0 // Would need date-based query
        };
    }

    // ==================== Categories ====================

    async getCategories(): Promise<AccessoryCategory[]> {
        return this.repository.getCategories();
    }

    async getCategory(id: string): Promise<AccessoryCategory | null> {
        return this.repository.getCategoryById(id);
    }

    async createCategory(data: CreateCategoryDto, userId: string): Promise<AccessoryCategory> {
        return this.repository.createCategory(data, userId);
    }

    // ==================== Manufacturers ====================

    async getManufacturers(): Promise<AccessoryManufacturer[]> {
        return this.repository.getManufacturers();
    }

    async getManufacturer(id: string): Promise<AccessoryManufacturer | null> {
        return this.repository.getManufacturerById(id);
    }

    async createManufacturer(data: CreateManufacturerDto, userId: string): Promise<AccessoryManufacturer> {
        return this.repository.createManufacturer(data, userId);
    }

    // ==================== Audit Logs ====================

    async getAuditLogs(accessoryId: string): Promise<AccessoryAuditLog[]> {
        return this.repository.getAuditLogs(accessoryId);
    }
}
