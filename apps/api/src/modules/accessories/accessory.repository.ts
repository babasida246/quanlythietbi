/**
 * Accessories Module - Repository
 * Database access layer for accessories
 */
import type { Pool } from 'pg';
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
    CheckoutListQuery,
    PaginatedResult,
    StockStatus
} from './accessory.types.js';

export class AccessoryRepository {
    constructor(private readonly db: Pool) { }

    // ==================== Accessory CRUD ====================

    async create(data: CreateAccessoryDto, createdBy: string): Promise<Accessory> {
        const accessoryCode = data.accessoryCode || await this.generateAccessoryCode();

        const query = `
            INSERT INTO accessories (
                accessory_code, name, model_number, category_id, manufacturer_id,
                image_url, total_quantity, available_quantity, min_quantity,
                unit_price, currency, supplier_id, purchase_order, purchase_date,
                location_id, location_name, notes, organization_id,
                created_by, updated_by, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18, 'active')
            RETURNING *
        `;

        const values = [
            accessoryCode,
            data.name,
            data.modelNumber || null,
            data.categoryId || null,
            data.manufacturerId || null,
            data.imageUrl || null,
            data.totalQuantity,
            data.minQuantity || 0,
            data.unitPrice || 0,
            data.currency || 'VND',
            data.supplierId || null,
            data.purchaseOrder || null,
            data.purchaseDate || null,
            data.locationId || null,
            data.locationName || null,
            data.notes || null,
            data.organizationId || null,
            createdBy
        ];

        const result = await this.db.query(query, values);
        return this.mapToAccessory(result.rows[0]);
    }

    async findById(id: string): Promise<Accessory | null> {
        const query = 'SELECT * FROM accessories WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToAccessory(result.rows[0]) : null;
    }

    async findByIdWithDetails(id: string): Promise<AccessoryWithDetails | null> {
        const query = `
            SELECT 
                a.*,
                c.name as category_name,
                m.name as manufacturer_name,
                s.name as supplier_name,
                (a.total_quantity - a.available_quantity) as checked_out_quantity,
                CASE 
                    WHEN a.available_quantity = 0 THEN 'out_of_stock'
                    WHEN a.available_quantity <= COALESCE(a.min_quantity, 0) THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status
            FROM accessories a
            LEFT JOIN accessory_categories c ON a.category_id = c.id
            LEFT JOIN accessory_manufacturers m ON a.manufacturer_id = m.id
            LEFT JOIN suppliers s ON a.supplier_id = s.id
            WHERE a.id = $1
        `;
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToAccessoryWithDetails(result.rows[0]) : null;
    }

    async findByCode(code: string): Promise<Accessory | null> {
        const query = 'SELECT * FROM accessories WHERE accessory_code = $1';
        const result = await this.db.query(query, [code]);
        return result.rows[0] ? this.mapToAccessory(result.rows[0]) : null;
    }

    async list(query: AccessoryListQuery): Promise<PaginatedResult<AccessoryWithDetails>> {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            whereClause += ` AND a.status = ANY($${paramIndex})`;
            params.push(statuses);
            paramIndex++;
        }

        if (query.categoryId) {
            whereClause += ` AND a.category_id = $${paramIndex}`;
            params.push(query.categoryId);
            paramIndex++;
        }

        if (query.manufacturerId) {
            whereClause += ` AND a.manufacturer_id = $${paramIndex}`;
            params.push(query.manufacturerId);
            paramIndex++;
        }

        if (query.supplierId) {
            whereClause += ` AND a.supplier_id = $${paramIndex}`;
            params.push(query.supplierId);
            paramIndex++;
        }

        if (query.stockStatus) {
            if (query.stockStatus === 'out_of_stock') {
                whereClause += ` AND a.available_quantity = 0`;
            } else if (query.stockStatus === 'low_stock') {
                whereClause += ` AND a.available_quantity > 0 AND a.available_quantity <= COALESCE(a.min_quantity, 0)`;
            } else if (query.stockStatus === 'in_stock') {
                whereClause += ` AND a.available_quantity > COALESCE(a.min_quantity, 0)`;
            }
        }

        if (query.organizationId) {
            whereClause += ` AND a.organization_id = $${paramIndex}`;
            params.push(query.organizationId);
            paramIndex++;
        }

        if (query.search) {
            whereClause += ` AND (a.name ILIKE $${paramIndex} OR a.accessory_code ILIKE $${paramIndex} OR a.model_number ILIKE $${paramIndex})`;
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM accessories a
            ${whereClause}
        `;
        const countResult = await this.db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Get data with sorting
        const sortColumn = this.getSortColumn(query.sortBy || 'createdAt');
        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        const dataQuery = `
            SELECT 
                a.*,
                c.name as category_name,
                m.name as manufacturer_name,
                s.name as supplier_name,
                (a.total_quantity - a.available_quantity) as checked_out_quantity,
                CASE 
                    WHEN a.available_quantity = 0 THEN 'out_of_stock'
                    WHEN a.available_quantity <= COALESCE(a.min_quantity, 0) THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status
            FROM accessories a
            LEFT JOIN accessory_categories c ON a.category_id = c.id
            LEFT JOIN accessory_manufacturers m ON a.manufacturer_id = m.id
            LEFT JOIN suppliers s ON a.supplier_id = s.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const dataResult = await this.db.query(dataQuery, [...params, limit, offset]);

        return {
            data: dataResult.rows.map(row => this.mapToAccessoryWithDetails(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async update(id: string, data: UpdateAccessoryDto, updatedBy: string): Promise<Accessory | null> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        const fieldMap: Record<string, string> = {
            name: 'name',
            modelNumber: 'model_number',
            categoryId: 'category_id',
            manufacturerId: 'manufacturer_id',
            imageUrl: 'image_url',
            minQuantity: 'min_quantity',
            unitPrice: 'unit_price',
            currency: 'currency',
            supplierId: 'supplier_id',
            purchaseOrder: 'purchase_order',
            purchaseDate: 'purchase_date',
            locationId: 'location_id',
            locationName: 'location_name',
            notes: 'notes',
            status: 'status'
        };

        for (const [key, column] of Object.entries(fieldMap)) {
            if (key in data) {
                fields.push(`${column} = $${paramIndex}`);
                values.push((data as any)[key]);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        fields.push(`updated_by = $${paramIndex}`);
        values.push(updatedBy);
        paramIndex++;

        fields.push(`updated_at = NOW()`);

        values.push(id);
        const query = `
            UPDATE accessories 
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await this.db.query(query, values);
        return result.rows[0] ? this.mapToAccessory(result.rows[0]) : null;
    }

    async delete(id: string): Promise<boolean> {
        const query = 'DELETE FROM accessories WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return (result.rowCount ?? 0) > 0;
    }

    // ==================== Checkout Operations ====================

    async checkout(data: CheckoutAccessoryDto, checkedOutBy: string): Promise<AccessoryCheckout> {
        const query = `
            INSERT INTO accessory_checkouts (
                accessory_id, quantity, assignment_type, 
                assigned_user_id, assigned_asset_id,
                expected_checkin_date, checkout_notes, checked_out_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const values = [
            data.accessoryId,
            data.quantity,
            data.assignmentType,
            data.assignedUserId || null,
            data.assignedAssetId || null,
            data.expectedCheckinDate || null,
            data.notes || null,
            checkedOutBy
        ];

        const result = await this.db.query(query, values);

        // Update available quantity
        await this.db.query(
            'UPDATE accessories SET available_quantity = available_quantity - $1 WHERE id = $2',
            [data.quantity, data.accessoryId]
        );

        return this.mapToCheckout(result.rows[0]);
    }

    async checkin(checkoutId: string, quantityReturned: number, notes: string | null, checkedInBy: string): Promise<AccessoryCheckout | null> {
        // Get checkout record
        const checkoutResult = await this.db.query(
            'SELECT * FROM accessory_checkouts WHERE id = $1',
            [checkoutId]
        );

        if (!checkoutResult.rows[0]) return null;

        const checkout = checkoutResult.rows[0];
        const newQuantityReturned = checkout.quantity_returned + quantityReturned;
        const newStatus = newQuantityReturned >= checkout.quantity ? 'returned' : 'partially_returned';

        const updateQuery = `
            UPDATE accessory_checkouts 
            SET quantity_returned = $1,
                status = $2,
                checkin_notes = COALESCE($3, checkin_notes),
                checked_in_by = $4,
                actual_checkin_date = CASE WHEN $2 = 'returned' THEN NOW() ELSE actual_checkin_date END,
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `;

        const result = await this.db.query(updateQuery, [
            newQuantityReturned,
            newStatus,
            notes,
            checkedInBy,
            checkoutId
        ]);

        // Update available quantity
        await this.db.query(
            'UPDATE accessories SET available_quantity = available_quantity + $1 WHERE id = $2',
            [quantityReturned, checkout.accessory_id]
        );

        return this.mapToCheckout(result.rows[0]);
    }

    async findCheckoutById(id: string): Promise<AccessoryCheckout | null> {
        const query = 'SELECT * FROM accessory_checkouts WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToCheckout(result.rows[0]) : null;
    }

    async getCheckouts(accessoryId: string, status?: string[]): Promise<AccessoryCheckoutWithDetails[]> {
        let query = `
            SELECT 
                co.*,
                a.name as accessory_name,
                a.accessory_code,
                (co.quantity - co.quantity_returned) as remaining_quantity,
                CASE 
                    WHEN co.expected_checkin_date < CURRENT_DATE AND co.status != 'returned' THEN true
                    ELSE false
                END as is_overdue
            FROM accessory_checkouts co
            JOIN accessories a ON co.accessory_id = a.id
            WHERE co.accessory_id = $1
        `;

        const params: any[] = [accessoryId];

        if (status && status.length > 0) {
            query += ` AND co.status = ANY($2)`;
            params.push(status);
        }

        query += ` ORDER BY co.checkout_date DESC`;

        const result = await this.db.query(query, params);
        return result.rows.map(row => this.mapToCheckoutWithDetails(row));
    }

    async getActiveCheckouts(accessoryId: string): Promise<AccessoryCheckoutWithDetails[]> {
        return this.getCheckouts(accessoryId, ['checked_out', 'partially_returned']);
    }

    async countActiveCheckouts(accessoryId: string): Promise<number> {
        const query = `
            SELECT COALESCE(SUM(quantity - quantity_returned), 0) as total
            FROM accessory_checkouts
            WHERE accessory_id = $1 AND status IN ('checked_out', 'partially_returned')
        `;
        const result = await this.db.query(query, [accessoryId]);
        return parseInt(result.rows[0].total);
    }

    // ==================== Stock Adjustments ====================

    async adjustStock(data: AdjustStockDto, performedBy: string): Promise<AccessoryStockAdjustment> {
        // Get current quantities
        const accessory = await this.findById(data.accessoryId);
        if (!accessory) {
            throw new Error('Accessory not found');
        }

        const quantityBefore = accessory.totalQuantity;
        const quantityAfter = quantityBefore + data.quantityChange;

        // Insert adjustment record
        const insertQuery = `
            INSERT INTO accessory_stock_adjustments (
                accessory_id, adjustment_type, quantity_change,
                quantity_before, quantity_after,
                reference_number, reason, notes, performed_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const result = await this.db.query(insertQuery, [
            data.accessoryId,
            data.adjustmentType,
            data.quantityChange,
            quantityBefore,
            quantityAfter,
            data.referenceNumber || null,
            data.reason || null,
            data.notes || null,
            performedBy
        ]);

        // Update accessory quantities
        await this.db.query(
            `UPDATE accessories 
             SET total_quantity = total_quantity + $1,
                 available_quantity = available_quantity + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [data.quantityChange, data.accessoryId]
        );

        return this.mapToStockAdjustment(result.rows[0]);
    }

    async getStockAdjustments(accessoryId: string): Promise<AccessoryStockAdjustment[]> {
        const query = `
            SELECT * FROM accessory_stock_adjustments
            WHERE accessory_id = $1
            ORDER BY performed_at DESC
        `;
        const result = await this.db.query(query, [accessoryId]);
        return result.rows.map(row => this.mapToStockAdjustment(row));
    }

    // ==================== Audit Logging ====================

    async logAudit(
        accessoryId: string,
        action: string,
        performedBy: string,
        oldValue?: any,
        newValue?: any,
        notes?: string,
        checkoutId?: string,
        adjustmentId?: string
    ): Promise<void> {
        const query = `
            INSERT INTO accessory_audit_logs (
                accessory_id, action, old_value, new_value, 
                checkout_id, adjustment_id, notes, performed_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        await this.db.query(query, [
            accessoryId,
            action,
            oldValue ? JSON.stringify(oldValue) : null,
            newValue ? JSON.stringify(newValue) : null,
            checkoutId || null,
            adjustmentId || null,
            notes || null,
            performedBy
        ]);
    }

    async getAuditLogs(accessoryId: string): Promise<AccessoryAuditLog[]> {
        const query = `
            SELECT * FROM accessory_audit_logs
            WHERE accessory_id = $1
            ORDER BY performed_at DESC
        `;
        const result = await this.db.query(query, [accessoryId]);
        return result.rows.map(row => this.mapToAuditLog(row));
    }

    // ==================== Categories ====================

    async getCategories(): Promise<AccessoryCategory[]> {
        const query = 'SELECT * FROM accessory_categories WHERE is_active = true ORDER BY name';
        const result = await this.db.query(query);
        return result.rows.map(row => this.mapToCategory(row));
    }

    async getCategoryById(id: string): Promise<AccessoryCategory | null> {
        const query = 'SELECT * FROM accessory_categories WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToCategory(result.rows[0]) : null;
    }

    async createCategory(data: CreateCategoryDto, createdBy: string): Promise<AccessoryCategory> {
        const query = `
            INSERT INTO accessory_categories (code, name, description, parent_id, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const result = await this.db.query(query, [
            data.code,
            data.name,
            data.description || null,
            data.parentId || null,
            createdBy
        ]);
        return this.mapToCategory(result.rows[0]);
    }

    // ==================== Manufacturers ====================

    async getManufacturers(): Promise<AccessoryManufacturer[]> {
        const query = 'SELECT * FROM accessory_manufacturers WHERE is_active = true ORDER BY name';
        const result = await this.db.query(query);
        return result.rows.map(row => this.mapToManufacturer(row));
    }

    async getManufacturerById(id: string): Promise<AccessoryManufacturer | null> {
        const query = 'SELECT * FROM accessory_manufacturers WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToManufacturer(result.rows[0]) : null;
    }

    async createManufacturer(data: CreateManufacturerDto, createdBy: string): Promise<AccessoryManufacturer> {
        const query = `
            INSERT INTO accessory_manufacturers (code, name, website, support_url, support_phone, support_email, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const result = await this.db.query(query, [
            data.code,
            data.name,
            data.website || null,
            data.supportUrl || null,
            data.supportPhone || null,
            data.supportEmail || null,
            data.notes || null,
            createdBy
        ]);
        return this.mapToManufacturer(result.rows[0]);
    }

    // ==================== Stock Summary ====================

    async getLowStockItems(organizationId?: string): Promise<AccessoryWithDetails[]> {
        let query = `
            SELECT 
                a.*,
                c.name as category_name,
                m.name as manufacturer_name,
                s.name as supplier_name,
                (a.total_quantity - a.available_quantity) as checked_out_quantity,
                'low_stock' as stock_status
            FROM accessories a
            LEFT JOIN accessory_categories c ON a.category_id = c.id
            LEFT JOIN accessory_manufacturers m ON a.manufacturer_id = m.id
            LEFT JOIN suppliers s ON a.supplier_id = s.id
            WHERE a.available_quantity <= COALESCE(a.min_quantity, 0)
            AND a.available_quantity > 0
            AND a.status = 'active'
        `;

        const params: any[] = [];
        if (organizationId) {
            query += ` AND a.organization_id = $1`;
            params.push(organizationId);
        }

        query += ` ORDER BY a.available_quantity ASC`;

        const result = await this.db.query(query, params);
        return result.rows.map(row => this.mapToAccessoryWithDetails(row));
    }

    async getOutOfStockItems(organizationId?: string): Promise<AccessoryWithDetails[]> {
        let query = `
            SELECT 
                a.*,
                c.name as category_name,
                m.name as manufacturer_name,
                s.name as supplier_name,
                (a.total_quantity - a.available_quantity) as checked_out_quantity,
                'out_of_stock' as stock_status
            FROM accessories a
            LEFT JOIN accessory_categories c ON a.category_id = c.id
            LEFT JOIN accessory_manufacturers m ON a.manufacturer_id = m.id
            LEFT JOIN suppliers s ON a.supplier_id = s.id
            WHERE a.available_quantity = 0
            AND a.status = 'active'
        `;

        const params: any[] = [];
        if (organizationId) {
            query += ` AND a.organization_id = $1`;
            params.push(organizationId);
        }

        const result = await this.db.query(query, params);
        return result.rows.map(row => this.mapToAccessoryWithDetails(row));
    }

    async getOverdueCheckouts(): Promise<AccessoryCheckoutWithDetails[]> {
        const query = `
            SELECT 
                co.*,
                a.name as accessory_name,
                a.accessory_code,
                (co.quantity - co.quantity_returned) as remaining_quantity,
                true as is_overdue
            FROM accessory_checkouts co
            JOIN accessories a ON co.accessory_id = a.id
            WHERE co.status IN ('checked_out', 'partially_returned')
            AND co.expected_checkin_date < CURRENT_DATE
            ORDER BY co.expected_checkin_date ASC
        `;
        const result = await this.db.query(query);
        return result.rows.map(row => this.mapToCheckoutWithDetails(row));
    }

    // ==================== Helpers ====================

    private async generateAccessoryCode(): Promise<string> {
        const date = new Date();
        const prefix = `ACC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

        const query = `
            SELECT accessory_code FROM accessories 
            WHERE accessory_code LIKE $1 
            ORDER BY accessory_code DESC 
            LIMIT 1
        `;
        const result = await this.db.query(query, [`${prefix}%`]);

        let sequence = 1;
        if (result.rows[0]) {
            const lastCode = result.rows[0].accessory_code;
            const lastSeq = parseInt(lastCode.split('-').pop() || '0');
            sequence = lastSeq + 1;
        }

        return `${prefix}-${String(sequence).padStart(4, '0')}`;
    }

    private getSortColumn(sortBy: string): string {
        const map: Record<string, string> = {
            name: 'a.name',
            accessoryCode: 'a.accessory_code',
            createdAt: 'a.created_at',
            availableQuantity: 'a.available_quantity',
            totalQuantity: 'a.total_quantity'
        };
        return map[sortBy] || 'a.created_at';
    }

    private mapToAccessory(row: any): Accessory {
        return {
            id: row.id,
            accessoryCode: row.accessory_code,
            name: row.name,
            modelNumber: row.model_number,
            categoryId: row.category_id,
            manufacturerId: row.manufacturer_id,
            imageUrl: row.image_url,
            totalQuantity: row.total_quantity,
            availableQuantity: row.available_quantity,
            minQuantity: row.min_quantity,
            unitPrice: parseFloat(row.unit_price) || 0,
            currency: row.currency,
            supplierId: row.supplier_id,
            purchaseOrder: row.purchase_order,
            purchaseDate: row.purchase_date,
            locationId: row.location_id,
            locationName: row.location_name,
            notes: row.notes,
            organizationId: row.organization_id,
            status: row.status,
            createdBy: row.created_by,
            updatedBy: row.updated_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapToAccessoryWithDetails(row: any): AccessoryWithDetails {
        return {
            ...this.mapToAccessory(row),
            categoryName: row.category_name,
            manufacturerName: row.manufacturer_name,
            supplierName: row.supplier_name,
            checkedOutQuantity: parseInt(row.checked_out_quantity) || 0,
            stockStatus: row.stock_status as StockStatus
        };
    }

    private mapToCheckout(row: any): AccessoryCheckout {
        return {
            id: row.id,
            accessoryId: row.accessory_id,
            quantity: row.quantity,
            quantityReturned: row.quantity_returned,
            assignmentType: row.assignment_type,
            assignedUserId: row.assigned_user_id,
            assignedAssetId: row.assigned_asset_id,
            checkoutDate: row.checkout_date,
            expectedCheckinDate: row.expected_checkin_date,
            actualCheckinDate: row.actual_checkin_date,
            checkedOutBy: row.checked_out_by,
            checkedInBy: row.checked_in_by,
            checkoutNotes: row.checkout_notes,
            checkinNotes: row.checkin_notes,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapToCheckoutWithDetails(row: any): AccessoryCheckoutWithDetails {
        return {
            ...this.mapToCheckout(row),
            accessoryName: row.accessory_name,
            accessoryCode: row.accessory_code,
            remainingQuantity: parseInt(row.remaining_quantity) || 0,
            isOverdue: row.is_overdue
        };
    }

    private mapToStockAdjustment(row: any): AccessoryStockAdjustment {
        return {
            id: row.id,
            accessoryId: row.accessory_id,
            adjustmentType: row.adjustment_type,
            quantityChange: row.quantity_change,
            quantityBefore: row.quantity_before,
            quantityAfter: row.quantity_after,
            referenceType: row.reference_type,
            referenceId: row.reference_id,
            referenceNumber: row.reference_number,
            reason: row.reason,
            notes: row.notes,
            performedBy: row.performed_by,
            performedAt: row.performed_at
        };
    }

    private mapToAuditLog(row: any): AccessoryAuditLog {
        return {
            id: row.id,
            accessoryId: row.accessory_id,
            action: row.action,
            fieldName: row.field_name,
            oldValue: row.old_value,
            newValue: row.new_value,
            checkoutId: row.checkout_id,
            adjustmentId: row.adjustment_id,
            notes: row.notes,
            performedBy: row.performed_by,
            performedAt: row.performed_at
        };
    }

    private mapToCategory(row: any): AccessoryCategory {
        return {
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            parentId: row.parent_id,
            isActive: row.is_active,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private mapToManufacturer(row: any): AccessoryManufacturer {
        return {
            id: row.id,
            code: row.code,
            name: row.name,
            website: row.website,
            supportUrl: row.support_url,
            supportPhone: row.support_phone,
            supportEmail: row.support_email,
            notes: row.notes,
            isActive: row.is_active,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
