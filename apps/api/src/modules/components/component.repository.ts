/**
 * Components Module - Repository Layer
 * Database operations for component management
 */

import { Pool, PoolClient } from 'pg';
import {
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
    StockStatus,
    AssetComponents
} from './component.types.js';

// ==================== Helper Functions ====================

function mapRowToComponent(row: Record<string, unknown>): Component {
    return {
        id: row.id as string,
        componentCode: row.component_code as string,
        name: row.name as string,
        modelNumber: row.model_number as string | null,
        categoryId: row.category_id as string | null,
        manufacturerId: row.manufacturer_id as string | null,
        componentType: row.component_type as Component['componentType'],
        specifications: row.specifications as string | null,
        imageUrl: row.image_url as string | null,
        totalQuantity: Number(row.total_quantity),
        availableQuantity: Number(row.available_quantity),
        minQuantity: Number(row.min_quantity),
        unitPrice: Number(row.unit_price),
        currency: row.currency as string,
        supplierId: row.supplier_id as string | null,
        purchaseOrder: row.purchase_order as string | null,
        purchaseDate: row.purchase_date as string | null,
        locationId: row.location_id as string | null,
        locationName: row.location_name as string | null,
        organizationId: row.organization_id as string | null,
        notes: row.notes as string | null,
        status: row.status as Component['status'],
        createdBy: row.created_by as string,
        updatedBy: row.updated_by as string,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date
    };
}

function mapRowToComponentWithDetails(row: Record<string, unknown>): ComponentWithDetails {
    const base = mapRowToComponent(row);
    const installedQuantity = base.totalQuantity - base.availableQuantity;

    let stockStatus: StockStatus = 'in_stock';
    if (base.availableQuantity === 0) {
        stockStatus = 'out_of_stock';
    } else if (base.availableQuantity <= base.minQuantity) {
        stockStatus = 'low_stock';
    }

    return {
        ...base,
        categoryName: row.category_name as string | null,
        manufacturerName: row.manufacturer_name as string | null,
        supplierName: row.supplier_name as string | null,
        installedQuantity,
        stockStatus
    };
}

function mapRowToAssignment(row: Record<string, unknown>): ComponentAssignment {
    return {
        id: row.id as string,
        componentId: row.component_id as string,
        quantity: Number(row.quantity),
        serialNumbers: row.serial_numbers as string[] | null,
        assetId: row.asset_id as string,
        installedAt: row.installed_at as Date,
        installedBy: row.installed_by as string,
        installationNotes: row.installation_notes as string | null,
        removedAt: row.removed_at as Date | null,
        removedBy: row.removed_by as string | null,
        removalReason: row.removal_reason as ComponentAssignment['removalReason'],
        removalNotes: row.removal_notes as string | null,
        postRemovalAction: row.post_removal_action as ComponentAssignment['postRemovalAction'],
        status: row.status as ComponentAssignment['status'],
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date
    };
}

function mapRowToAssignmentWithDetails(row: Record<string, unknown>): ComponentAssignmentWithDetails {
    const base = mapRowToAssignment(row);
    return {
        ...base,
        componentCode: row.component_code as string,
        componentName: row.component_name as string,
        componentType: row.component_type as ComponentAssignment['componentId'] extends string ? Component['componentType'] : never,
        assetTag: row.asset_tag as string,
        assetName: row.asset_name as string,
        installedByName: row.installed_by_name as string | null,
        removedByName: row.removed_by_name as string | null
    } as ComponentAssignmentWithDetails;
}

function mapRowToReceipt(row: Record<string, unknown>): ComponentReceipt {
    return {
        id: row.id as string,
        componentId: row.component_id as string,
        quantity: Number(row.quantity),
        serialNumbers: row.serial_numbers as string[] | null,
        receiptType: row.receipt_type as ComponentReceipt['receiptType'],
        supplierId: row.supplier_id as string | null,
        purchaseOrder: row.purchase_order as string | null,
        unitCost: row.unit_cost ? Number(row.unit_cost) : null,
        referenceNumber: row.reference_number as string | null,
        referenceType: row.reference_type as string | null,
        referenceId: row.reference_id as string | null,
        receivedBy: row.received_by as string,
        receivedAt: row.received_at as Date,
        notes: row.notes as string | null,
        createdAt: row.created_at as Date
    };
}

function mapRowToReceiptWithDetails(row: Record<string, unknown>): ComponentReceiptWithDetails {
    const base = mapRowToReceipt(row);
    return {
        ...base,
        componentCode: row.component_code as string,
        componentName: row.component_name as string,
        receivedByName: row.received_by_name as string | null,
        supplierName: row.supplier_name as string | null
    };
}

function mapRowToCategory(row: Record<string, unknown>): ComponentCategory {
    return {
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        description: row.description as string | null,
        parentId: row.parent_id as string | null,
        isActive: row.is_active as boolean,
        createdBy: row.created_by as string,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date
    };
}

function mapRowToManufacturer(row: Record<string, unknown>): ComponentManufacturer {
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
        createdBy: row.created_by as string,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date
    };
}

// ==================== Repository Class ====================

export class ComponentRepository {
    constructor(private readonly pool: Pool) { }

    // ==================== Component CRUD ====================

    async create(dto: CreateComponentDto): Promise<Component> {
        const availableQuantity = dto.availableQuantity ?? dto.totalQuantity;

        const result = await this.pool.query(
            `INSERT INTO components (
                component_code, name, model_number, category_id, manufacturer_id,
                component_type, specifications, image_url, total_quantity, available_quantity,
                min_quantity, unit_price, currency, supplier_id, purchase_order,
                purchase_date, location_id, location_name, organization_id, notes,
                status, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22)
            RETURNING *`,
            [
                dto.componentCode,
                dto.name,
                dto.modelNumber ?? null,
                dto.categoryId ?? null,
                dto.manufacturerId ?? null,
                dto.componentType,
                dto.specifications ?? null,
                dto.imageUrl ?? null,
                dto.totalQuantity,
                availableQuantity,
                dto.minQuantity ?? 0,
                dto.unitPrice ?? 0,
                dto.currency ?? 'VND',
                dto.supplierId ?? null,
                dto.purchaseOrder ?? null,
                dto.purchaseDate ?? null,
                dto.locationId ?? null,
                dto.locationName ?? null,
                dto.organizationId ?? null,
                dto.notes ?? null,
                dto.status ?? 'active',
                dto.createdBy
            ]
        );

        return mapRowToComponent(result.rows[0]);
    }

    async findById(id: string): Promise<Component | null> {
        const result = await this.pool.query(
            'SELECT * FROM components WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToComponent(result.rows[0]);
    }

    async findByIdWithDetails(id: string): Promise<ComponentWithDetails | null> {
        const result = await this.pool.query(
            `SELECT 
                c.*,
                cat.name as category_name,
                m.name as manufacturer_name,
                NULL as supplier_name
            FROM components c
            LEFT JOIN component_categories cat ON c.category_id = cat.id
            LEFT JOIN component_manufacturers m ON c.manufacturer_id = m.id
            WHERE c.id = $1`,
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToComponentWithDetails(result.rows[0]);
    }

    async findByCode(code: string): Promise<Component | null> {
        const result = await this.pool.query(
            'SELECT * FROM components WHERE component_code = $1',
            [code]
        );

        if (result.rows.length === 0) return null;
        return mapRowToComponent(result.rows[0]);
    }

    async list(query: ComponentListQuery): Promise<PaginatedResponse<ComponentWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.search) {
            conditions.push(`(c.name ILIKE $${paramIndex} OR c.component_code ILIKE $${paramIndex} OR c.model_number ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        if (query.componentType) {
            const types = Array.isArray(query.componentType) ? query.componentType : [query.componentType];
            conditions.push(`c.component_type = ANY($${paramIndex})`);
            params.push(types);
            paramIndex++;
        }

        if (query.categoryId) {
            conditions.push(`c.category_id = $${paramIndex}`);
            params.push(query.categoryId);
            paramIndex++;
        }

        if (query.manufacturerId) {
            conditions.push(`c.manufacturer_id = $${paramIndex}`);
            params.push(query.manufacturerId);
            paramIndex++;
        }

        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            conditions.push(`c.status = ANY($${paramIndex})`);
            params.push(statuses);
            paramIndex++;
        }

        if (query.locationId) {
            conditions.push(`c.location_id = $${paramIndex}`);
            params.push(query.locationId);
            paramIndex++;
        }

        if (query.supplierId) {
            conditions.push(`c.supplier_id = $${paramIndex}`);
            params.push(query.supplierId);
            paramIndex++;
        }

        if (query.organizationId) {
            conditions.push(`c.organization_id = $${paramIndex}`);
            params.push(query.organizationId);
            paramIndex++;
        }

        if (query.stockStatus) {
            const statuses = Array.isArray(query.stockStatus) ? query.stockStatus : [query.stockStatus];
            const stockConditions: string[] = [];

            if (statuses.includes('out_of_stock')) {
                stockConditions.push('c.available_quantity = 0');
            }
            if (statuses.includes('low_stock')) {
                stockConditions.push('(c.available_quantity > 0 AND c.available_quantity <= c.min_quantity)');
            }
            if (statuses.includes('in_stock')) {
                stockConditions.push('c.available_quantity > c.min_quantity');
            }

            if (stockConditions.length > 0) {
                conditions.push(`(${stockConditions.join(' OR ')})`);
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = {
            name: 'c.name',
            componentCode: 'c.component_code',
            createdAt: 'c.created_at',
            availableQuantity: 'c.available_quantity',
            componentType: 'c.component_type'
        }[query.sortBy ?? 'createdAt'];

        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) as total
            FROM components c
            LEFT JOIN component_categories cat ON c.category_id = cat.id
            LEFT JOIN component_manufacturers m ON c.manufacturer_id = m.id
            ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        // Get paginated data
        const dataResult = await this.pool.query(
            `SELECT 
                c.*,
                cat.name as category_name,
                m.name as manufacturer_name,
                NULL as supplier_name
            FROM components c
            LEFT JOIN component_categories cat ON c.category_id = cat.id
            LEFT JOIN component_manufacturers m ON c.manufacturer_id = m.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToComponentWithDetails),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async update(id: string, dto: UpdateComponentDto): Promise<Component | null> {
        const fields: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            params.push(dto.name);
        }
        if (dto.modelNumber !== undefined) {
            fields.push(`model_number = $${paramIndex++}`);
            params.push(dto.modelNumber);
        }
        if (dto.categoryId !== undefined) {
            fields.push(`category_id = $${paramIndex++}`);
            params.push(dto.categoryId);
        }
        if (dto.manufacturerId !== undefined) {
            fields.push(`manufacturer_id = $${paramIndex++}`);
            params.push(dto.manufacturerId);
        }
        if (dto.componentType !== undefined) {
            fields.push(`component_type = $${paramIndex++}`);
            params.push(dto.componentType);
        }
        if (dto.specifications !== undefined) {
            fields.push(`specifications = $${paramIndex++}`);
            params.push(dto.specifications);
        }
        if (dto.imageUrl !== undefined) {
            fields.push(`image_url = $${paramIndex++}`);
            params.push(dto.imageUrl);
        }
        if (dto.minQuantity !== undefined) {
            fields.push(`min_quantity = $${paramIndex++}`);
            params.push(dto.minQuantity);
        }
        if (dto.unitPrice !== undefined) {
            fields.push(`unit_price = $${paramIndex++}`);
            params.push(dto.unitPrice);
        }
        if (dto.currency !== undefined) {
            fields.push(`currency = $${paramIndex++}`);
            params.push(dto.currency);
        }
        if (dto.supplierId !== undefined) {
            fields.push(`supplier_id = $${paramIndex++}`);
            params.push(dto.supplierId);
        }
        if (dto.purchaseOrder !== undefined) {
            fields.push(`purchase_order = $${paramIndex++}`);
            params.push(dto.purchaseOrder);
        }
        if (dto.purchaseDate !== undefined) {
            fields.push(`purchase_date = $${paramIndex++}`);
            params.push(dto.purchaseDate);
        }
        if (dto.locationId !== undefined) {
            fields.push(`location_id = $${paramIndex++}`);
            params.push(dto.locationId);
        }
        if (dto.locationName !== undefined) {
            fields.push(`location_name = $${paramIndex++}`);
            params.push(dto.locationName);
        }
        if (dto.notes !== undefined) {
            fields.push(`notes = $${paramIndex++}`);
            params.push(dto.notes);
        }
        if (dto.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            params.push(dto.status);
        }

        fields.push(`updated_by = $${paramIndex++}`);
        params.push(dto.updatedBy);

        if (fields.length === 1) {
            // Only updated_by, no actual changes
            return this.findById(id);
        }

        params.push(id);

        const result = await this.pool.query(
            `UPDATE components SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return null;
        return mapRowToComponent(result.rows[0]);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'DELETE FROM components WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount !== null && result.rowCount > 0;
    }

    async hasAssignments(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT 1 FROM component_assignments WHERE component_id = $1 LIMIT 1',
            [id]
        );
        return result.rows.length > 0;
    }

    // ==================== Install/Remove Operations ====================

    async install(dto: InstallComponentDto, client?: PoolClient): Promise<ComponentAssignment> {
        const executor = client ?? this.pool;

        // Create assignment record
        const assignmentResult = await executor.query(
            `INSERT INTO component_assignments (
                component_id, quantity, serial_numbers, asset_id,
                installed_by, installation_notes, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'installed')
            RETURNING *`,
            [
                dto.componentId,
                dto.quantity,
                dto.serialNumbers ?? null,
                dto.assetId,
                dto.installedBy,
                dto.installationNotes ?? null
            ]
        );

        // Update component available quantity
        await executor.query(
            `UPDATE components 
            SET available_quantity = available_quantity - $1,
                updated_by = $2
            WHERE id = $3`,
            [dto.quantity, dto.installedBy, dto.componentId]
        );

        return mapRowToAssignment(assignmentResult.rows[0]);
    }

    async remove(dto: RemoveComponentDto, client?: PoolClient): Promise<ComponentAssignment> {
        const executor = client ?? this.pool;

        // Get assignment details
        const assignmentResult = await executor.query(
            'SELECT * FROM component_assignments WHERE id = $1 AND status = $2',
            [dto.assignmentId, 'installed']
        );

        if (assignmentResult.rows.length === 0) {
            throw new Error('Assignment not found or already removed');
        }

        const assignment = mapRowToAssignment(assignmentResult.rows[0]);

        // Update assignment record
        const updateResult = await executor.query(
            `UPDATE component_assignments SET
                removed_at = NOW(),
                removed_by = $1,
                removal_reason = $2,
                post_removal_action = $3,
                removal_notes = $4,
                status = 'removed'
            WHERE id = $5
            RETURNING *`,
            [
                dto.removedBy,
                dto.removalReason,
                dto.postRemovalAction,
                dto.removalNotes ?? null,
                dto.assignmentId
            ]
        );

        // Update component quantities based on post-removal action
        if (dto.postRemovalAction === 'restock') {
            // Return to available inventory
            await executor.query(
                `UPDATE components 
                SET available_quantity = available_quantity + $1,
                    updated_by = $2
                WHERE id = $3`,
                [assignment.quantity, dto.removedBy, assignment.componentId]
            );
        } else if (dto.postRemovalAction === 'dispose') {
            // Reduce total quantity (already not in available)
            await executor.query(
                `UPDATE components 
                SET total_quantity = total_quantity - $1,
                    updated_by = $2
                WHERE id = $3`,
                [assignment.quantity, dto.removedBy, assignment.componentId]
            );
        }

        return mapRowToAssignment(updateResult.rows[0]);
    }

    async findAssignmentById(id: string): Promise<ComponentAssignment | null> {
        const result = await this.pool.query(
            'SELECT * FROM component_assignments WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToAssignment(result.rows[0]);
    }

    async listAssignments(query: AssignmentListQuery): Promise<PaginatedResponse<ComponentAssignmentWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.componentId) {
            conditions.push(`a.component_id = $${paramIndex++}`);
            params.push(query.componentId);
        }

        if (query.assetId) {
            conditions.push(`a.asset_id = $${paramIndex++}`);
            params.push(query.assetId);
        }

        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            conditions.push(`a.status = ANY($${paramIndex++})`);
            params.push(statuses);
        }

        if (query.installedBy) {
            conditions.push(`a.installed_by = $${paramIndex++}`);
            params.push(query.installedBy);
        }

        if (query.removalReason) {
            const reasons = Array.isArray(query.removalReason) ? query.removalReason : [query.removalReason];
            conditions.push(`a.removal_reason = ANY($${paramIndex++})`);
            params.push(reasons);
        }

        if (query.dateFrom) {
            conditions.push(`a.installed_at >= $${paramIndex++}`);
            params.push(query.dateFrom);
        }

        if (query.dateTo) {
            conditions.push(`a.installed_at <= $${paramIndex++}`);
            params.push(query.dateTo);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = {
            installedAt: 'a.installed_at',
            removedAt: 'a.removed_at',
            componentCode: 'c.component_code',
            assetTag: 'a.asset_id'
        }[query.sortBy ?? 'installedAt'];

        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) as total
            FROM component_assignments a
            JOIN components c ON a.component_id = c.id
            ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        // Get paginated data
        const dataResult = await this.pool.query(
            `SELECT 
                a.*,
                c.component_code,
                c.name as component_name,
                c.component_type,
                a.asset_id as asset_tag,
                'Asset' as asset_name,
                NULL as installed_by_name,
                NULL as removed_by_name
            FROM component_assignments a
            JOIN components c ON a.component_id = c.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToAssignmentWithDetails),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getAssetComponents(assetId: string): Promise<AssetComponents | null> {
        const assignmentsResult = await this.pool.query(
            `SELECT 
                a.*,
                c.component_code,
                c.name as component_name,
                c.component_type,
                $1 as asset_tag,
                'Asset' as asset_name,
                NULL as installed_by_name,
                NULL as removed_by_name
            FROM component_assignments a
            JOIN components c ON a.component_id = c.id
            WHERE a.asset_id = $1 AND a.status = 'installed'
            ORDER BY a.installed_at DESC`,
            [assetId]
        );

        return {
            assetId,
            assetTag: assetId,
            assetName: 'Asset',
            components: assignmentsResult.rows.map(mapRowToAssignmentWithDetails)
        };
    }

    // ==================== Receipt Operations ====================

    async receive(dto: ReceiveComponentDto, client?: PoolClient): Promise<ComponentReceipt> {
        const executor = client ?? this.pool;

        // Create receipt record
        const receiptResult = await executor.query(
            `INSERT INTO component_receipts (
                component_id, quantity, serial_numbers, receipt_type,
                supplier_id, purchase_order, unit_cost, reference_number,
                reference_type, reference_id, received_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                dto.componentId,
                dto.quantity,
                dto.serialNumbers ?? null,
                dto.receiptType,
                dto.supplierId ?? null,
                dto.purchaseOrder ?? null,
                dto.unitCost ?? null,
                dto.referenceNumber ?? null,
                dto.referenceType ?? null,
                dto.referenceId ?? null,
                dto.receivedBy,
                dto.notes ?? null
            ]
        );

        // Update component quantities
        await executor.query(
            `UPDATE components 
            SET total_quantity = total_quantity + $1,
                available_quantity = available_quantity + $1,
                updated_by = $2
            WHERE id = $3`,
            [dto.quantity, dto.receivedBy, dto.componentId]
        );

        return mapRowToReceipt(receiptResult.rows[0]);
    }

    async listReceipts(query: ReceiptListQuery): Promise<PaginatedResponse<ComponentReceiptWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.componentId) {
            conditions.push(`r.component_id = $${paramIndex++}`);
            params.push(query.componentId);
        }

        if (query.receiptType) {
            const types = Array.isArray(query.receiptType) ? query.receiptType : [query.receiptType];
            conditions.push(`r.receipt_type = ANY($${paramIndex++})`);
            params.push(types);
        }

        if (query.supplierId) {
            conditions.push(`r.supplier_id = $${paramIndex++}`);
            params.push(query.supplierId);
        }

        if (query.receivedBy) {
            conditions.push(`r.received_by = $${paramIndex++}`);
            params.push(query.receivedBy);
        }

        if (query.dateFrom) {
            conditions.push(`r.received_at >= $${paramIndex++}`);
            params.push(query.dateFrom);
        }

        if (query.dateTo) {
            conditions.push(`r.received_at <= $${paramIndex++}`);
            params.push(query.dateTo);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = {
            receivedAt: 'r.received_at',
            quantity: 'r.quantity',
            componentCode: 'c.component_code'
        }[query.sortBy ?? 'receivedAt'];

        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = await this.pool.query(
            `SELECT COUNT(*) as total
            FROM component_receipts r
            JOIN components c ON r.component_id = c.id
            ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        // Get paginated data
        const dataResult = await this.pool.query(
            `SELECT 
                r.*,
                c.component_code,
                c.name as component_name,
                NULL as received_by_name,
                NULL as supplier_name
            FROM component_receipts r
            JOIN components c ON r.component_id = c.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToReceiptWithDetails),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ==================== Stock Alerts ====================

    async getLowStockItems(): Promise<StockAlert[]> {
        const result = await this.pool.query(
            `SELECT 
                c.id, c.component_code, c.name, c.component_type,
                c.total_quantity, c.available_quantity, c.min_quantity,
                c.location_name,
                cat.name as category_name
            FROM components c
            LEFT JOIN component_categories cat ON c.category_id = cat.id
            WHERE c.status = 'active' 
            AND c.available_quantity > 0 
            AND c.available_quantity <= c.min_quantity
            ORDER BY c.available_quantity ASC`
        );

        return result.rows.map(row => ({
            id: row.id,
            componentCode: row.component_code,
            name: row.name,
            componentType: row.component_type,
            totalQuantity: Number(row.total_quantity),
            availableQuantity: Number(row.available_quantity),
            minQuantity: Number(row.min_quantity),
            stockStatus: 'low_stock' as StockStatus,
            categoryName: row.category_name,
            locationName: row.location_name
        }));
    }

    async getOutOfStockItems(): Promise<StockAlert[]> {
        const result = await this.pool.query(
            `SELECT 
                c.id, c.component_code, c.name, c.component_type,
                c.total_quantity, c.available_quantity, c.min_quantity,
                c.location_name,
                cat.name as category_name
            FROM components c
            LEFT JOIN component_categories cat ON c.category_id = cat.id
            WHERE c.status = 'active' AND c.available_quantity = 0
            ORDER BY c.name ASC`
        );

        return result.rows.map(row => ({
            id: row.id,
            componentCode: row.component_code,
            name: row.name,
            componentType: row.component_type,
            totalQuantity: Number(row.total_quantity),
            availableQuantity: 0,
            minQuantity: Number(row.min_quantity),
            stockStatus: 'out_of_stock' as StockStatus,
            categoryName: row.category_name,
            locationName: row.location_name
        }));
    }

    async getStockSummary(): Promise<StockSummary> {
        const result = await this.pool.query(
            `SELECT 
                COUNT(*) as total_components,
                COALESCE(SUM(total_quantity), 0) as total_quantity,
                COALESCE(SUM(available_quantity), 0) as total_available,
                COALESCE(SUM(total_quantity - available_quantity), 0) as total_installed,
                COALESCE(SUM(CASE WHEN available_quantity > min_quantity THEN 1 ELSE 0 END), 0) as in_stock_count,
                COALESCE(SUM(CASE WHEN available_quantity > 0 AND available_quantity <= min_quantity THEN 1 ELSE 0 END), 0) as low_stock_count,
                COALESCE(SUM(CASE WHEN available_quantity = 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count,
                COALESCE(SUM(total_quantity * unit_price), 0) as total_value
            FROM components
            WHERE status = 'active'`
        );

        const row = result.rows[0];
        return {
            totalComponents: parseInt(row.total_components, 10),
            totalQuantity: parseInt(row.total_quantity, 10),
            totalAvailable: parseInt(row.total_available, 10),
            totalInstalled: parseInt(row.total_installed, 10),
            inStockCount: parseInt(row.in_stock_count, 10),
            lowStockCount: parseInt(row.low_stock_count, 10),
            outOfStockCount: parseInt(row.out_of_stock_count, 10),
            totalValue: parseFloat(row.total_value)
        };
    }

    // ==================== Category CRUD ====================

    async createCategory(dto: CreateCategoryDto): Promise<ComponentCategory> {
        const result = await this.pool.query(
            `INSERT INTO component_categories (code, name, description, parent_id, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                dto.code,
                dto.name,
                dto.description ?? null,
                dto.parentId ?? null,
                dto.isActive ?? true,
                dto.createdBy
            ]
        );

        return mapRowToCategory(result.rows[0]);
    }

    async findCategoryById(id: string): Promise<ComponentCategory | null> {
        const result = await this.pool.query(
            'SELECT * FROM component_categories WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCategory(result.rows[0]);
    }

    async findCategoryByCode(code: string): Promise<ComponentCategory | null> {
        const result = await this.pool.query(
            'SELECT * FROM component_categories WHERE code = $1',
            [code]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCategory(result.rows[0]);
    }

    async listCategories(query: CategoryListQuery): Promise<PaginatedResponse<ComponentCategory>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.search) {
            conditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        if (query.parentId !== undefined) {
            if (query.parentId === null) {
                conditions.push('parent_id IS NULL');
            } else {
                conditions.push(`parent_id = $${paramIndex++}`);
                params.push(query.parentId);
            }
        }

        if (query.isActive !== undefined) {
            conditions.push(`is_active = $${paramIndex++}`);
            params.push(query.isActive);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.pool.query(
            `SELECT COUNT(*) as total FROM component_categories ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        const dataResult = await this.pool.query(
            `SELECT * FROM component_categories 
            ${whereClause}
            ORDER BY name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToCategory),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async updateCategory(id: string, dto: UpdateCategoryDto): Promise<ComponentCategory | null> {
        const fields: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            params.push(dto.name);
        }
        if (dto.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            params.push(dto.description);
        }
        if (dto.parentId !== undefined) {
            fields.push(`parent_id = $${paramIndex++}`);
            params.push(dto.parentId);
        }
        if (dto.isActive !== undefined) {
            fields.push(`is_active = $${paramIndex++}`);
            params.push(dto.isActive);
        }

        if (fields.length === 0) {
            return this.findCategoryById(id);
        }

        params.push(id);

        const result = await this.pool.query(
            `UPDATE component_categories SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return null;
        return mapRowToCategory(result.rows[0]);
    }

    async deleteCategory(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'DELETE FROM component_categories WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount !== null && result.rowCount > 0;
    }

    async categoryHasComponents(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT 1 FROM components WHERE category_id = $1 LIMIT 1',
            [id]
        );
        return result.rows.length > 0;
    }

    // ==================== Manufacturer CRUD ====================

    async createManufacturer(dto: CreateManufacturerDto): Promise<ComponentManufacturer> {
        const result = await this.pool.query(
            `INSERT INTO component_manufacturers (
                code, name, website, support_url, support_phone, support_email, notes, is_active, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                dto.code,
                dto.name,
                dto.website ?? null,
                dto.supportUrl ?? null,
                dto.supportPhone ?? null,
                dto.supportEmail ?? null,
                dto.notes ?? null,
                dto.isActive ?? true,
                dto.createdBy
            ]
        );

        return mapRowToManufacturer(result.rows[0]);
    }

    async findManufacturerById(id: string): Promise<ComponentManufacturer | null> {
        const result = await this.pool.query(
            'SELECT * FROM component_manufacturers WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToManufacturer(result.rows[0]);
    }

    async findManufacturerByCode(code: string): Promise<ComponentManufacturer | null> {
        const result = await this.pool.query(
            'SELECT * FROM component_manufacturers WHERE code = $1',
            [code]
        );

        if (result.rows.length === 0) return null;
        return mapRowToManufacturer(result.rows[0]);
    }

    async listManufacturers(query: ManufacturerListQuery): Promise<PaginatedResponse<ComponentManufacturer>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.search) {
            conditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        if (query.isActive !== undefined) {
            conditions.push(`is_active = $${paramIndex++}`);
            params.push(query.isActive);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.pool.query(
            `SELECT COUNT(*) as total FROM component_manufacturers ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        const dataResult = await this.pool.query(
            `SELECT * FROM component_manufacturers 
            ${whereClause}
            ORDER BY name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToManufacturer),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async updateManufacturer(id: string, dto: UpdateManufacturerDto): Promise<ComponentManufacturer | null> {
        const fields: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            params.push(dto.name);
        }
        if (dto.website !== undefined) {
            fields.push(`website = $${paramIndex++}`);
            params.push(dto.website);
        }
        if (dto.supportUrl !== undefined) {
            fields.push(`support_url = $${paramIndex++}`);
            params.push(dto.supportUrl);
        }
        if (dto.supportPhone !== undefined) {
            fields.push(`support_phone = $${paramIndex++}`);
            params.push(dto.supportPhone);
        }
        if (dto.supportEmail !== undefined) {
            fields.push(`support_email = $${paramIndex++}`);
            params.push(dto.supportEmail);
        }
        if (dto.notes !== undefined) {
            fields.push(`notes = $${paramIndex++}`);
            params.push(dto.notes);
        }
        if (dto.isActive !== undefined) {
            fields.push(`is_active = $${paramIndex++}`);
            params.push(dto.isActive);
        }

        if (fields.length === 0) {
            return this.findManufacturerById(id);
        }

        params.push(id);

        const result = await this.pool.query(
            `UPDATE component_manufacturers SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        if (result.rows.length === 0) return null;
        return mapRowToManufacturer(result.rows[0]);
    }

    async deleteManufacturer(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'DELETE FROM component_manufacturers WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount !== null && result.rowCount > 0;
    }

    async manufacturerHasComponents(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT 1 FROM components WHERE manufacturer_id = $1 LIMIT 1',
            [id]
        );
        return result.rows.length > 0;
    }

    // ==================== Audit Log ====================

    async createAuditLog(log: Omit<ComponentAuditLog, 'id' | 'performedAt'>): Promise<void> {
        await this.pool.query(
            `INSERT INTO component_audit_logs (
                component_id, assignment_id, receipt_id, action, action_type,
                old_values, new_values, performed_by, ip_address, user_agent, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                log.componentId,
                log.assignmentId,
                log.receiptId,
                log.action,
                log.actionType,
                log.oldValues ? JSON.stringify(log.oldValues) : null,
                log.newValues ? JSON.stringify(log.newValues) : null,
                log.performedBy,
                log.ipAddress,
                log.userAgent,
                log.notes
            ]
        );
    }

    // ==================== Transaction Helper ====================

    async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ==================== Serial Number Validation ====================

    async isSerialNumberInUse(serialNumber: string, excludeAssignmentId?: string): Promise<boolean> {
        let query = `
            SELECT 1 FROM component_assignments 
            WHERE $1 = ANY(serial_numbers) 
            AND status = 'installed'
        `;
        const params: unknown[] = [serialNumber];

        if (excludeAssignmentId) {
            query += ' AND id != $2';
            params.push(excludeAssignmentId);
        }

        query += ' LIMIT 1';

        const result = await this.pool.query(query, params);
        return result.rows.length > 0;
    }

    async validateSerialNumbers(serialNumbers: string[]): Promise<string[]> {
        const inUse: string[] = [];

        for (const serial of serialNumbers) {
            if (await this.isSerialNumberInUse(serial)) {
                inUse.push(serial);
            }
        }

        return inUse;
    }
}
