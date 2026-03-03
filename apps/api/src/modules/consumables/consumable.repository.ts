/**
 * Consumables Module - Repository Layer
 * Database access for consumable management
 */
import type { Pool } from 'pg';
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

export class ConsumableRepository {
    constructor(private db: Pool) { }

    // ==================== Consumable CRUD ====================

    async create(data: CreateConsumableDto, userId: string): Promise<Consumable> {
        const code = await this.generateConsumableCode();

        const query = `
            INSERT INTO consumables (
                consumable_code, name, category_id, manufacturer_id,
                model_number, part_number, image_url, unit_of_measure,
                quantity, min_quantity, unit_price, currency,
                supplier_id, purchase_order, purchase_date,
                location_id, location_name, notes, organization_id,
                status, created_by, updated_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19,
                'active', $20, $20
            )
            RETURNING *
        `;

        const values = [
            code,
            data.name,
            data.categoryId || null,
            data.manufacturerId || null,
            data.modelNumber || null,
            data.partNumber || null,
            data.imageUrl || null,
            data.unitOfMeasure,
            data.quantity,
            data.minQuantity ?? 0,
            data.unitPrice ?? 0,
            data.currency ?? 'VND',
            data.supplierId || null,
            data.purchaseOrder || null,
            data.purchaseDate || null,
            data.locationId || null,
            data.locationName || null,
            data.notes || null,
            data.organizationId || null,
            userId
        ];

        const result = await this.db.query(query, values);
        return this.mapToConsumable(result.rows[0]);
    }

    async findById(id: string): Promise<Consumable | null> {
        const query = `SELECT * FROM consumables WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToConsumable(result.rows[0]) : null;
    }

    async findByIdWithDetails(id: string): Promise<ConsumableWithDetails | null> {
        const query = `
            SELECT 
                c.*,
                cat.name as category_name,
                m.name as manufacturer_name,
                s.name as supplier_name,
                COALESCE(
                    (SELECT SUM(ci.quantity) FROM consumable_issues ci WHERE ci.consumable_id = c.id),
                    0
                ) as total_issued,
                CASE 
                    WHEN c.quantity = 0 THEN 'out_of_stock'
                    WHEN c.quantity <= c.min_quantity THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status
            FROM consumables c
            LEFT JOIN consumable_categories cat ON c.category_id = cat.id
            LEFT JOIN consumable_manufacturers m ON c.manufacturer_id = m.id
            LEFT JOIN suppliers s ON c.supplier_id = s.id
            WHERE c.id = $1
        `;
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToConsumableWithDetails(result.rows[0]) : null;
    }

    async findByCode(code: string): Promise<Consumable | null> {
        const query = `SELECT * FROM consumables WHERE consumable_code = $1`;
        const result = await this.db.query(query, [code]);
        return result.rows[0] ? this.mapToConsumable(result.rows[0]) : null;
    }

    async list(query: ConsumableListQuery): Promise<PaginatedResponse<ConsumableWithDetails>> {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search,
            status,
            categoryId,
            manufacturerId,
            supplierId,
            stockStatus,
            organizationId
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(c.name ILIKE $${paramIndex} OR c.consumable_code ILIKE $${paramIndex} OR c.part_number ILIKE $${paramIndex})`);
            values.push(`%${search}%`);
            paramIndex++;
        }

        if (status && status.length > 0) {
            conditions.push(`c.status = ANY($${paramIndex})`);
            values.push(status);
            paramIndex++;
        }

        if (categoryId) {
            conditions.push(`c.category_id = $${paramIndex}`);
            values.push(categoryId);
            paramIndex++;
        }

        if (manufacturerId) {
            conditions.push(`c.manufacturer_id = $${paramIndex}`);
            values.push(manufacturerId);
            paramIndex++;
        }

        if (supplierId) {
            conditions.push(`c.supplier_id = $${paramIndex}`);
            values.push(supplierId);
            paramIndex++;
        }

        if (stockStatus) {
            if (stockStatus === 'out_of_stock') {
                conditions.push(`c.quantity = 0`);
            } else if (stockStatus === 'low_stock') {
                conditions.push(`c.quantity > 0 AND c.quantity <= c.min_quantity`);
            } else {
                conditions.push(`c.quantity > c.min_quantity`);
            }
        }

        if (organizationId) {
            conditions.push(`c.organization_id = $${paramIndex}`);
            values.push(organizationId);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sortColumn = this.getSortColumn(sortBy);
        const offset = (page - 1) * limit;

        // Count query
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM consumables c 
            ${whereClause}
        `;
        const countResult = await this.db.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total);

        // Data query
        const dataQuery = `
            SELECT 
                c.*,
                cat.name as category_name,
                m.name as manufacturer_name,
                s.name as supplier_name,
                COALESCE(
                    (SELECT SUM(ci.quantity) FROM consumable_issues ci WHERE ci.consumable_id = c.id),
                    0
                ) as total_issued,
                CASE 
                    WHEN c.quantity = 0 THEN 'out_of_stock'
                    WHEN c.quantity <= c.min_quantity THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status
            FROM consumables c
            LEFT JOIN consumable_categories cat ON c.category_id = cat.id
            LEFT JOIN consumable_manufacturers m ON c.manufacturer_id = m.id
            LEFT JOIN suppliers s ON c.supplier_id = s.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        values.push(limit, offset);
        const dataResult = await this.db.query(dataQuery, values);

        return {
            data: dataResult.rows.map(row => this.mapToConsumableWithDetails(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async update(id: string, data: UpdateConsumableDto, userId: string): Promise<Consumable | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        const fieldMap: Record<string, string> = {
            name: 'name',
            categoryId: 'category_id',
            manufacturerId: 'manufacturer_id',
            modelNumber: 'model_number',
            partNumber: 'part_number',
            imageUrl: 'image_url',
            unitOfMeasure: 'unit_of_measure',
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
                values.push((data as Record<string, unknown>)[key]);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        fields.push(`updated_by = $${paramIndex}`);
        values.push(userId);
        paramIndex++;

        fields.push(`updated_at = NOW()`);

        values.push(id);

        const query = `
            UPDATE consumables 
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await this.db.query(query, values);
        return result.rows[0] ? this.mapToConsumable(result.rows[0]) : null;
    }

    async delete(id: string): Promise<boolean> {
        const query = `DELETE FROM consumables WHERE id = $1 RETURNING id`;
        const result = await this.db.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    // ==================== Issue Operations ====================

    async issue(consumableId: string, data: IssueConsumableDto, userId: string): Promise<ConsumableIssue> {
        // Start transaction
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');

            // Decrease quantity
            const updateQuery = `
                UPDATE consumables 
                SET quantity = quantity - $1, updated_by = $2, updated_at = NOW()
                WHERE id = $3 AND quantity >= $1
                RETURNING quantity
            `;
            const updateResult = await client.query(updateQuery, [data.quantity, userId, consumableId]);

            if (updateResult.rowCount === 0) {
                throw new Error('Insufficient quantity or consumable not found');
            }

            // Create issue record
            const insertQuery = `
                INSERT INTO consumable_issues (
                    consumable_id, quantity, issue_type,
                    issued_to_user_id, issued_to_department, issued_to_asset_id,
                    issue_date, issued_by, reference_number, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
                RETURNING *
            `;

            const insertValues = [
                consumableId,
                data.quantity,
                data.issueType,
                data.issuedToUserId || null,
                data.issuedToDepartment || null,
                data.issuedToAssetId || null,
                userId,
                data.referenceNumber || null,
                data.notes || null
            ];

            const insertResult = await client.query(insertQuery, insertValues);

            await client.query('COMMIT');
            return this.mapToIssue(insertResult.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async findIssueById(issueId: string): Promise<ConsumableIssue | null> {
        const query = `SELECT * FROM consumable_issues WHERE id = $1`;
        const result = await this.db.query(query, [issueId]);
        return result.rows[0] ? this.mapToIssue(result.rows[0]) : null;
    }

    async getIssues(query: IssueListQuery): Promise<PaginatedResponse<ConsumableIssueWithDetails>> {
        const {
            page = 1,
            limit = 20,
            consumableId,
            issueType,
            issuedToUserId,
            issuedToAssetId,
            startDate,
            endDate
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (consumableId) {
            conditions.push(`ci.consumable_id = $${paramIndex}`);
            values.push(consumableId);
            paramIndex++;
        }

        if (issueType && issueType.length > 0) {
            conditions.push(`ci.issue_type = ANY($${paramIndex})`);
            values.push(issueType);
            paramIndex++;
        }

        if (issuedToUserId) {
            conditions.push(`ci.issued_to_user_id = $${paramIndex}`);
            values.push(issuedToUserId);
            paramIndex++;
        }

        if (issuedToAssetId) {
            conditions.push(`ci.issued_to_asset_id = $${paramIndex}`);
            values.push(issuedToAssetId);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`ci.issue_date >= $${paramIndex}`);
            values.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`ci.issue_date <= $${paramIndex}`);
            values.push(endDate + 'T23:59:59Z');
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        const countQuery = `SELECT COUNT(*) as total FROM consumable_issues ci ${whereClause}`;
        const countResult = await this.db.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total);

        const dataQuery = `
            SELECT 
                ci.*,
                c.name as consumable_name,
                c.consumable_code,
                u.full_name as user_name,
                a.asset_tag
            FROM consumable_issues ci
            JOIN consumables c ON ci.consumable_id = c.id
            LEFT JOIN users u ON ci.issued_to_user_id = u.id
            LEFT JOIN assets a ON ci.issued_to_asset_id = a.id
            ${whereClause}
            ORDER BY ci.issue_date DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        values.push(limit, offset);
        const dataResult = await this.db.query(dataQuery, values);

        return {
            data: dataResult.rows.map(row => this.mapToIssueWithDetails(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ==================== Receipt Operations ====================

    async receive(consumableId: string, data: ReceiveConsumableDto, userId: string): Promise<ConsumableReceipt> {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');

            // Increase quantity
            const updateQuery = `
                UPDATE consumables 
                SET quantity = quantity + $1, updated_by = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING quantity
            `;
            const updateResult = await client.query(updateQuery, [data.quantity, userId, consumableId]);

            if (updateResult.rowCount === 0) {
                throw new Error('Consumable not found');
            }

            // Calculate total cost
            const totalCost = data.unitCost ? data.unitCost * data.quantity : null;

            // Create receipt record
            const insertQuery = `
                INSERT INTO consumable_receipts (
                    consumable_id, quantity, receipt_type,
                    purchase_order, unit_cost, total_cost,
                    receipt_date, supplier_id, invoice_number,
                    received_by, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)
                RETURNING *
            `;

            const insertValues = [
                consumableId,
                data.quantity,
                data.receiptType || 'purchase',
                data.purchaseOrder || null,
                data.unitCost || null,
                totalCost,
                data.supplierId || null,
                data.invoiceNumber || null,
                userId,
                data.notes || null
            ];

            const insertResult = await client.query(insertQuery, insertValues);

            await client.query('COMMIT');
            return this.mapToReceipt(insertResult.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async findReceiptById(receiptId: string): Promise<ConsumableReceipt | null> {
        const query = `SELECT * FROM consumable_receipts WHERE id = $1`;
        const result = await this.db.query(query, [receiptId]);
        return result.rows[0] ? this.mapToReceipt(result.rows[0]) : null;
    }

    async getReceipts(query: ReceiptListQuery): Promise<PaginatedResponse<ConsumableReceiptWithDetails>> {
        const {
            page = 1,
            limit = 20,
            consumableId,
            receiptType,
            supplierId,
            startDate,
            endDate
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (consumableId) {
            conditions.push(`cr.consumable_id = $${paramIndex}`);
            values.push(consumableId);
            paramIndex++;
        }

        if (receiptType && receiptType.length > 0) {
            conditions.push(`cr.receipt_type = ANY($${paramIndex})`);
            values.push(receiptType);
            paramIndex++;
        }

        if (supplierId) {
            conditions.push(`cr.supplier_id = $${paramIndex}`);
            values.push(supplierId);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`cr.receipt_date >= $${paramIndex}`);
            values.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`cr.receipt_date <= $${paramIndex}`);
            values.push(endDate + 'T23:59:59Z');
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        const countQuery = `SELECT COUNT(*) as total FROM consumable_receipts cr ${whereClause}`;
        const countResult = await this.db.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total);

        const dataQuery = `
            SELECT 
                cr.*,
                c.name as consumable_name,
                c.consumable_code,
                s.name as supplier_name
            FROM consumable_receipts cr
            JOIN consumables c ON cr.consumable_id = c.id
            LEFT JOIN suppliers s ON cr.supplier_id = s.id
            ${whereClause}
            ORDER BY cr.receipt_date DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        values.push(limit, offset);
        const dataResult = await this.db.query(dataQuery, values);

        return {
            data: dataResult.rows.map(row => this.mapToReceiptWithDetails(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ==================== Stock Alerts ====================

    async getLowStockItems(): Promise<LowStockItem[]> {
        const query = `
            SELECT 
                id, consumable_code, name, quantity, min_quantity,
                (min_quantity - quantity) as deficit,
                unit_of_measure
            FROM consumables
            WHERE status = 'active' 
              AND quantity <= min_quantity 
              AND quantity > 0
            ORDER BY deficit DESC
        `;
        const result = await this.db.query(query);
        return result.rows.map(row => ({
            id: row.id,
            consumableCode: row.consumable_code,
            name: row.name,
            quantity: row.quantity,
            minQuantity: row.min_quantity,
            deficit: row.deficit,
            unitOfMeasure: row.unit_of_measure
        }));
    }

    async getOutOfStockItems(): Promise<LowStockItem[]> {
        const query = `
            SELECT 
                id, consumable_code, name, quantity, min_quantity,
                min_quantity as deficit,
                unit_of_measure
            FROM consumables
            WHERE status = 'active' AND quantity = 0
            ORDER BY name
        `;
        const result = await this.db.query(query);
        return result.rows.map(row => ({
            id: row.id,
            consumableCode: row.consumable_code,
            name: row.name,
            quantity: row.quantity,
            minQuantity: row.min_quantity,
            deficit: row.deficit,
            unitOfMeasure: row.unit_of_measure
        }));
    }

    async getStockSummary(): Promise<StockSummary> {
        const query = `
            SELECT 
                COUNT(*) as total_items,
                COUNT(*) FILTER (WHERE quantity > min_quantity) as in_stock,
                COUNT(*) FILTER (WHERE quantity <= min_quantity AND quantity > 0) as low_stock,
                COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock,
                COALESCE(SUM(quantity * unit_price), 0) as total_value
            FROM consumables
            WHERE status = 'active'
        `;
        const result = await this.db.query(query);
        const row = result.rows[0];

        return {
            totalItems: parseInt(row.total_items),
            inStock: parseInt(row.in_stock),
            lowStock: parseInt(row.low_stock),
            outOfStock: parseInt(row.out_of_stock),
            totalValue: parseFloat(row.total_value)
        };
    }

    // ==================== Categories ====================

    async getCategories(activeOnly: boolean = true): Promise<ConsumableCategory[]> {
        const query = activeOnly
            ? `SELECT * FROM consumable_categories WHERE is_active = true ORDER BY name`
            : `SELECT * FROM consumable_categories ORDER BY name`;
        const result = await this.db.query(query);
        return result.rows.map(row => this.mapToCategory(row));
    }

    async getCategoryById(id: string): Promise<ConsumableCategory | null> {
        const query = `SELECT * FROM consumable_categories WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToCategory(result.rows[0]) : null;
    }

    async createCategory(data: CreateCategoryDto): Promise<ConsumableCategory> {
        const query = `
            INSERT INTO consumable_categories (code, name, description, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [data.code, data.name, data.description || null, data.parentId || null];
        const result = await this.db.query(query, values);
        return this.mapToCategory(result.rows[0]);
    }

    async updateCategory(id: string, data: UpdateCategoryDto): Promise<ConsumableCategory | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(data.description);
        }
        if (data.parentId !== undefined) {
            fields.push(`parent_id = $${paramIndex++}`);
            values.push(data.parentId);
        }
        if (data.isActive !== undefined) {
            fields.push(`is_active = $${paramIndex++}`);
            values.push(data.isActive);
        }

        if (fields.length === 0) {
            return this.getCategoryById(id);
        }

        values.push(id);
        const query = `
            UPDATE consumable_categories 
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await this.db.query(query, values);
        return result.rows[0] ? this.mapToCategory(result.rows[0]) : null;
    }

    async deleteCategory(id: string): Promise<boolean> {
        const query = `DELETE FROM consumable_categories WHERE id = $1 RETURNING id`;
        const result = await this.db.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    // ==================== Manufacturers ====================

    async getManufacturers(activeOnly: boolean = true): Promise<ConsumableManufacturer[]> {
        const query = activeOnly
            ? `SELECT * FROM consumable_manufacturers WHERE is_active = true ORDER BY name`
            : `SELECT * FROM consumable_manufacturers ORDER BY name`;
        const result = await this.db.query(query);
        return result.rows.map(row => this.mapToManufacturer(row));
    }

    async getManufacturerById(id: string): Promise<ConsumableManufacturer | null> {
        const query = `SELECT * FROM consumable_manufacturers WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        return result.rows[0] ? this.mapToManufacturer(result.rows[0]) : null;
    }

    async createManufacturer(data: CreateManufacturerDto): Promise<ConsumableManufacturer> {
        const query = `
            INSERT INTO consumable_manufacturers (
                code, name, website, support_url, support_phone, support_email, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const values = [
            data.code,
            data.name,
            data.website || null,
            data.supportUrl || null,
            data.supportPhone || null,
            data.supportEmail || null,
            data.notes || null
        ];
        const result = await this.db.query(query, values);
        return this.mapToManufacturer(result.rows[0]);
    }

    async updateManufacturer(id: string, data: UpdateManufacturerDto): Promise<ConsumableManufacturer | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        const fieldMap: Record<string, string> = {
            name: 'name',
            website: 'website',
            supportUrl: 'support_url',
            supportPhone: 'support_phone',
            supportEmail: 'support_email',
            notes: 'notes',
            isActive: 'is_active'
        };

        for (const [key, column] of Object.entries(fieldMap)) {
            if (key in data) {
                fields.push(`${column} = $${paramIndex++}`);
                values.push((data as Record<string, unknown>)[key]);
            }
        }

        if (fields.length === 0) {
            return this.getManufacturerById(id);
        }

        values.push(id);
        const query = `
            UPDATE consumable_manufacturers 
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await this.db.query(query, values);
        return result.rows[0] ? this.mapToManufacturer(result.rows[0]) : null;
    }

    async deleteManufacturer(id: string): Promise<boolean> {
        const query = `DELETE FROM consumable_manufacturers WHERE id = $1 RETURNING id`;
        const result = await this.db.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    // ==================== Audit Logging ====================

    async logAudit(
        entityType: string,
        entityId: string,
        action: string,
        changes: Record<string, unknown> | null,
        performedBy: string,
        ipAddress?: string,
        userAgent?: string,
        notes?: string
    ): Promise<void> {
        const query = `
            INSERT INTO consumable_audit_logs (
                entity_type, entity_id, action, changes,
                performed_by, ip_address, user_agent, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        await this.db.query(query, [
            entityType,
            entityId,
            action,
            changes ? JSON.stringify(changes) : null,
            performedBy,
            ipAddress || null,
            userAgent || null,
            notes || null
        ]);
    }

    async getAuditLogs(query: AuditLogQuery): Promise<PaginatedResponse<ConsumableAuditLog>> {
        const {
            page = 1,
            limit = 50,
            entityType,
            entityId,
            action,
            startDate,
            endDate
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (entityType) {
            conditions.push(`entity_type = $${paramIndex++}`);
            values.push(entityType);
        }

        if (entityId) {
            conditions.push(`entity_id = $${paramIndex++}`);
            values.push(entityId);
        }

        if (action) {
            conditions.push(`action = $${paramIndex++}`);
            values.push(action);
        }

        if (startDate) {
            conditions.push(`performed_at >= $${paramIndex++}`);
            values.push(startDate);
        }

        if (endDate) {
            conditions.push(`performed_at <= $${paramIndex++}`);
            values.push(endDate + 'T23:59:59Z');
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        const countQuery = `SELECT COUNT(*) as total FROM consumable_audit_logs ${whereClause}`;
        const countResult = await this.db.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total);

        const dataQuery = `
            SELECT * FROM consumable_audit_logs
            ${whereClause}
            ORDER BY performed_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        values.push(limit, offset);
        const dataResult = await this.db.query(dataQuery, values);

        return {
            data: dataResult.rows.map(row => this.mapToAuditLog(row)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ==================== Helper Methods ====================

    private async generateConsumableCode(): Promise<string> {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `CON-${year}${month}`;

        const query = `
            SELECT consumable_code FROM consumables 
            WHERE consumable_code LIKE $1 
            ORDER BY consumable_code DESC 
            LIMIT 1
        `;
        const result = await this.db.query(query, [`${prefix}%`]);

        let sequence = 1;
        if (result.rows[0]) {
            const lastCode = result.rows[0].consumable_code;
            const lastSeq = parseInt(lastCode.split('-').pop() || '0');
            sequence = lastSeq + 1;
        }

        return `${prefix}-${String(sequence).padStart(4, '0')}`;
    }

    private getSortColumn(sortBy: string): string {
        const map: Record<string, string> = {
            name: 'c.name',
            consumableCode: 'c.consumable_code',
            createdAt: 'c.created_at',
            quantity: 'c.quantity',
            unitPrice: 'c.unit_price'
        };
        return map[sortBy] || 'c.created_at';
    }

    private mapToConsumable(row: Record<string, unknown>): Consumable {
        return {
            id: row.id as string,
            consumableCode: row.consumable_code as string,
            name: row.name as string,
            categoryId: row.category_id as string | null,
            manufacturerId: row.manufacturer_id as string | null,
            modelNumber: row.model_number as string | null,
            partNumber: row.part_number as string | null,
            imageUrl: row.image_url as string | null,
            unitOfMeasure: row.unit_of_measure as string,
            quantity: row.quantity as number,
            minQuantity: row.min_quantity as number,
            unitPrice: parseFloat(String(row.unit_price)) || 0,
            currency: row.currency as string,
            supplierId: row.supplier_id as string | null,
            purchaseOrder: row.purchase_order as string | null,
            purchaseDate: row.purchase_date as string | null,
            locationId: row.location_id as string | null,
            locationName: row.location_name as string | null,
            notes: row.notes as string | null,
            organizationId: row.organization_id as string | null,
            status: row.status as Consumable['status'],
            createdBy: row.created_by as string,
            updatedBy: row.updated_by as string,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date
        };
    }

    private mapToConsumableWithDetails(row: Record<string, unknown>): ConsumableWithDetails {
        return {
            ...this.mapToConsumable(row),
            categoryName: row.category_name as string | null,
            manufacturerName: row.manufacturer_name as string | null,
            supplierName: row.supplier_name as string | null,
            stockStatus: row.stock_status as ConsumableWithDetails['stockStatus'],
            totalIssued: parseInt(String(row.total_issued)) || 0
        };
    }

    private mapToIssue(row: Record<string, unknown>): ConsumableIssue {
        return {
            id: row.id as string,
            consumableId: row.consumable_id as string,
            quantity: row.quantity as number,
            issueType: row.issue_type as ConsumableIssue['issueType'],
            issuedToUserId: row.issued_to_user_id as string | null,
            issuedToDepartment: row.issued_to_department as string | null,
            issuedToAssetId: row.issued_to_asset_id as string | null,
            issueDate: row.issue_date as Date,
            issuedBy: row.issued_by as string,
            referenceNumber: row.reference_number as string | null,
            notes: row.notes as string | null,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date
        };
    }

    private mapToIssueWithDetails(row: Record<string, unknown>): ConsumableIssueWithDetails {
        return {
            ...this.mapToIssue(row),
            consumableName: row.consumable_name as string,
            consumableCode: row.consumable_code as string,
            userName: row.user_name as string | null,
            assetTag: row.asset_tag as string | null
        };
    }

    private mapToReceipt(row: Record<string, unknown>): ConsumableReceipt {
        return {
            id: row.id as string,
            consumableId: row.consumable_id as string,
            quantity: row.quantity as number,
            receiptType: row.receipt_type as ConsumableReceipt['receiptType'],
            purchaseOrder: row.purchase_order as string | null,
            unitCost: row.unit_cost ? parseFloat(String(row.unit_cost)) : null,
            totalCost: row.total_cost ? parseFloat(String(row.total_cost)) : null,
            receiptDate: row.receipt_date as Date,
            supplierId: row.supplier_id as string | null,
            invoiceNumber: row.invoice_number as string | null,
            receivedBy: row.received_by as string,
            notes: row.notes as string | null,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date
        };
    }

    private mapToReceiptWithDetails(row: Record<string, unknown>): ConsumableReceiptWithDetails {
        return {
            ...this.mapToReceipt(row),
            consumableName: row.consumable_name as string,
            consumableCode: row.consumable_code as string,
            supplierName: row.supplier_name as string | null
        };
    }

    private mapToCategory(row: Record<string, unknown>): ConsumableCategory {
        return {
            id: row.id as string,
            code: row.code as string,
            name: row.name as string,
            description: row.description as string | null,
            parentId: row.parent_id as string | null,
            isActive: row.is_active as boolean,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date
        };
    }

    private mapToManufacturer(row: Record<string, unknown>): ConsumableManufacturer {
        return {
            id: row.id as string,
            code: row.code as string,
            name: row.name as string,
            website: row.website as string | null,
            supportUrl: row.support_url as string | null,
            supportPhone: row.support_phone as string | null,
            supportEmail: row.support_email as string | null,
            notes: row.notes as string | null,
            isActive: row.is_active as boolean,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date
        };
    }

    private mapToAuditLog(row: Record<string, unknown>): ConsumableAuditLog {
        return {
            id: row.id as string,
            entityType: row.entity_type as string,
            entityId: row.entity_id as string,
            action: row.action as string,
            changes: row.changes as Record<string, unknown> | null,
            performedBy: row.performed_by as string,
            performedAt: row.performed_at as Date,
            ipAddress: row.ip_address as string | null,
            userAgent: row.user_agent as string | null,
            notes: row.notes as string | null
        };
    }
}
