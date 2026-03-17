/**
 * Accessories Module - Service
 * Business logic layer for accessories (Clean Architecture)
 */
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
    AccessoryPaginatedResult,
    StockSummary,
    AccessoryCheckoutSummary
} from '@qltb/contracts';

// ==================== Repository Interface ====================

export interface IAccessoryRepository {
    create(data: CreateAccessoryDto, createdBy: string): Promise<Accessory>;
    findById(id: string): Promise<Accessory | null>;
    findByIdWithDetails(id: string): Promise<AccessoryWithDetails | null>;
    findByCode(code: string): Promise<Accessory | null>;
    list(query: AccessoryListQuery): Promise<AccessoryPaginatedResult<AccessoryWithDetails>>;
    update(id: string, data: UpdateAccessoryDto, updatedBy: string): Promise<Accessory | null>;
    delete(id: string): Promise<boolean>;

    checkout(data: CheckoutAccessoryDto, checkedOutBy: string): Promise<AccessoryCheckout>;
    checkin(checkoutId: string, quantityReturned: number, notes: string | null, checkedInBy: string): Promise<AccessoryCheckout | null>;
    findCheckoutById(id: string): Promise<AccessoryCheckout | null>;
    getCheckouts(accessoryId: string, status?: string[]): Promise<AccessoryCheckoutWithDetails[]>;
    getActiveCheckouts(accessoryId: string): Promise<AccessoryCheckoutWithDetails[]>;
    countActiveCheckouts(accessoryId: string): Promise<number>;

    adjustStock(data: AdjustStockDto, performedBy: string): Promise<AccessoryStockAdjustment>;
    getStockAdjustments(accessoryId: string): Promise<AccessoryStockAdjustment[]>;

    logAudit(
        accessoryId: string,
        action: string,
        performedBy: string,
        oldValue?: any,
        newValue?: any,
        notes?: string,
        checkoutId?: string,
        adjustmentId?: string
    ): Promise<void>;
    getAuditLogs(accessoryId: string): Promise<AccessoryAuditLog[]>;

    getCategories(): Promise<AccessoryCategory[]>;
    getCategoryById(id: string): Promise<AccessoryCategory | null>;
    createCategory(data: CreateCategoryDto, createdBy: string): Promise<AccessoryCategory>;

    getManufacturers(): Promise<AccessoryManufacturer[]>;
    getManufacturerById(id: string): Promise<AccessoryManufacturer | null>;
    createManufacturer(data: CreateManufacturerDto, createdBy: string): Promise<AccessoryManufacturer>;

    getLowStockItems(organizationId?: string): Promise<AccessoryWithDetails[]>;
    getOutOfStockItems(organizationId?: string): Promise<AccessoryWithDetails[]>;
    getOverdueCheckouts(): Promise<AccessoryCheckoutWithDetails[]>;
}

// ==================== Service ====================

export class AccessoryService {
    constructor(private readonly repo: IAccessoryRepository) { }

    // ==================== Accessory CRUD ====================

    async createAccessory(data: CreateAccessoryDto, userId: string): Promise<AccessoryWithDetails> {
        const accessory = await this.repo.create(data, userId);

        // Log audit
        await this.repo.logAudit(
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
        return this.repo.findByIdWithDetails(id);
    }

    async getAccessoryByCode(code: string): Promise<Accessory | null> {
        return this.repo.findByCode(code);
    }

    async listAccessories(query: AccessoryListQuery): Promise<AccessoryPaginatedResult<AccessoryWithDetails>> {
        return this.repo.list(query);
    }

    async updateAccessory(id: string, data: UpdateAccessoryDto, userId: string): Promise<AccessoryWithDetails | null> {
        const existing = await this.repo.findById(id);
        if (!existing) return null;

        const updated = await this.repo.update(id, data, userId);
        if (!updated) return null;

        // Log audit
        await this.repo.logAudit(
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
        const accessory = await this.repo.findById(id);
        if (!accessory) return false;

        // Check for active checkouts
        const activeCount = await this.repo.countActiveCheckouts(id);
        if (activeCount > 0) {
            throw new Error(`Cannot delete accessory: ${activeCount} items are still checked out`);
        }

        return this.repo.delete(id);
    }

    // ==================== Checkout/Checkin Operations ====================

    async checkoutAccessory(data: CheckoutAccessoryDto, userId: string): Promise<AccessoryCheckout> {
        // Validate accessory exists and is active
        const accessory = await this.repo.findById(data.accessoryId);
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

        const checkout = await this.repo.checkout(data, userId);

        // Log audit
        await this.repo.logAudit(
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
        const checkout = await this.repo.findCheckoutById(checkoutId);
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

        const updated = await this.repo.checkin(checkoutId, quantityReturned, notes, userId);
        if (!updated) {
            throw new Error('Failed to process checkin');
        }

        // Log audit
        await this.repo.logAudit(
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
            return this.repo.getActiveCheckouts(accessoryId);
        }
        return this.repo.getCheckouts(accessoryId);
    }

    async getCheckoutById(checkoutId: string): Promise<AccessoryCheckout | null> {
        return this.repo.findCheckoutById(checkoutId);
    }

    // ==================== Stock Management ====================

    async adjustStock(data: AdjustStockDto, userId: string): Promise<AccessoryStockAdjustment> {
        const accessory = await this.repo.findById(data.accessoryId);
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

        const adjustment = await this.repo.adjustStock(data, userId);

        // Log audit
        await this.repo.logAudit(
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
        return this.repo.getStockAdjustments(accessoryId);
    }

    // ==================== Alerts & Monitoring ====================

    async getLowStockItems(organizationId?: string): Promise<AccessoryWithDetails[]> {
        return this.repo.getLowStockItems(organizationId);
    }

    async getOutOfStockItems(organizationId?: string): Promise<AccessoryWithDetails[]> {
        return this.repo.getOutOfStockItems(organizationId);
    }

    async getOverdueCheckouts(): Promise<AccessoryCheckoutWithDetails[]> {
        return this.repo.getOverdueCheckouts();
    }

    async getStockSummary(organizationId?: string): Promise<StockSummary> {
        const accessories = await this.repo.list({
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

    async getCheckoutSummary(organizationId?: string): Promise<AccessoryCheckoutSummary> {
        const overdueCheckouts = await this.repo.getOverdueCheckouts();

        return {
            totalCheckouts: 0,
            activeCheckouts: 0,
            overdueCheckouts: overdueCheckouts.length,
            returnedThisMonth: 0
        };
    }

    // ==================== Categories ====================

    async getCategories(): Promise<AccessoryCategory[]> {
        return this.repo.getCategories();
    }

    async getCategory(id: string): Promise<AccessoryCategory | null> {
        return this.repo.getCategoryById(id);
    }

    async createCategory(data: CreateCategoryDto, userId: string): Promise<AccessoryCategory> {
        return this.repo.createCategory(data, userId);
    }

    // ==================== Manufacturers ====================

    async getManufacturers(): Promise<AccessoryManufacturer[]> {
        return this.repo.getManufacturers();
    }

    async getManufacturer(id: string): Promise<AccessoryManufacturer | null> {
        return this.repo.getManufacturerById(id);
    }

    async createManufacturer(data: CreateManufacturerDto, userId: string): Promise<AccessoryManufacturer> {
        return this.repo.createManufacturer(data, userId);
    }

    // ==================== Audit Logs ====================

    async getAuditLogs(accessoryId: string): Promise<AccessoryAuditLog[]> {
        return this.repo.getAuditLogs(accessoryId);
    }
}
