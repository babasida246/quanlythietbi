/**
 * Audit Module - Repository Layer (Clean Architecture)
 * Module: 07-AUDIT (Asset Audit/Inventory Check)
 */

import type { PoolClient } from 'pg';
import type { PgClient } from '../PgClient.js';
import type {
    AuditSession,
    AuditSessionWithDetails,
    AuditLocation,
    AuditLocationWithDetails,
    AuditCategory,
    AuditCategoryWithDetails,
    AuditAuditor,
    AuditAuditorWithDetails,
    AuditItem,
    AuditItemWithDetails,
    UnregisteredAsset,
    UnregisteredAssetWithDetails,
    AuditHistory,
    AuditHistoryWithDetails,
    CreateAuditDto,
    UpdateAuditDto,
    AuditItemDto,
    CreateUnregisteredAssetDto,
    UpdateUnregisteredAssetDto,
    AuditListQuery,
    AuditItemListQuery,
    DiscrepancyQuery,
    UnregisteredAssetQuery,
    AuditStatus,
    AuditItemStatus,
    AuditStatistics,
    AuditProgress,
} from '@qltb/contracts';

// Helper to convert snake_case to camelCase
function toCamelCase<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = row[key];
    }
    return result as T;
}

export class AuditRepo {
    constructor(private db: PgClient) { }

    // ==================== Audit Session CRUD ====================

    async create(dto: CreateAuditDto, client?: PoolClient): Promise<AuditSession> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_sessions (
                name, audit_type, scope_description, start_date, end_date,
                notes, organization_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                dto.name,
                dto.auditType,
                dto.scopeDescription,
                dto.startDate,
                dto.endDate || null,
                dto.notes || null,
                dto.organizationId,
                dto.createdBy,
            ]
        );
        return toCamelCase<AuditSession>(result.rows[0]);
    }

    async findById(id: string): Promise<AuditSession | null> {
        const result = await this.db.query(
            'SELECT * FROM audit_sessions WHERE id = $1',
            [id]
        );
        return result.rows[0] ? toCamelCase<AuditSession>(result.rows[0]) : null;
    }

    async findByIdWithDetails(id: string): Promise<AuditSessionWithDetails | null> {
        const result = await this.db.query(
            `SELECT
                a.*,
                u.name as created_by_name,
                (
                    SELECT STRING_AGG(l.name, ', ')
                    FROM audit_locations al
                    JOIN locations l ON al.location_id = l.id
                    WHERE al.audit_id = a.id
                ) as locations,
                (
                    SELECT STRING_AGG(c.name, ', ')
                    FROM audit_categories ac
                    JOIN asset_categories c ON ac.category_id = c.id
                    WHERE ac.audit_id = a.id
                ) as categories,
                (SELECT COUNT(*) FROM audit_auditors WHERE audit_id = a.id) as auditor_count,
                CASE
                    WHEN a.total_items > 0
                    THEN ROUND((a.audited_items::DECIMAL / a.total_items) * 100, 2)
                    ELSE 0
                END as progress_percent,
                CASE
                    WHEN a.end_date IS NOT NULL
                    THEN (a.end_date - CURRENT_DATE)
                    ELSE NULL
                END as days_remaining,
                CASE
                    WHEN a.end_date IS NOT NULL AND a.end_date < CURRENT_DATE
                         AND a.status NOT IN ('completed', 'cancelled')
                    THEN TRUE
                    ELSE FALSE
                END as is_overdue
            FROM audit_sessions a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE a.id = $1`,
            [id]
        );
        return result.rows[0] ? toCamelCase<AuditSessionWithDetails>(result.rows[0]) : null;
    }

    async findByCode(code: string): Promise<AuditSession | null> {
        const result = await this.db.query(
            'SELECT * FROM audit_sessions WHERE audit_code = $1',
            [code]
        );
        return result.rows[0] ? toCamelCase<AuditSession>(result.rows[0]) : null;
    }

    async update(
        id: string,
        dto: UpdateAuditDto,
        client?: PoolClient
    ): Promise<AuditSession | null> {
        const conn = (client || this.db) as PgClient;
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(dto.name);
        }
        if (dto.scopeDescription !== undefined) {
            fields.push(`scope_description = $${paramIndex++}`);
            values.push(dto.scopeDescription);
        }
        if (dto.startDate !== undefined) {
            fields.push(`start_date = $${paramIndex++}`);
            values.push(dto.startDate);
        }
        if (dto.endDate !== undefined) {
            fields.push(`end_date = $${paramIndex++}`);
            values.push(dto.endDate);
        }
        if (dto.notes !== undefined) {
            fields.push(`notes = $${paramIndex++}`);
            values.push(dto.notes);
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        const result = await conn.query(
            `UPDATE audit_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0] ? toCamelCase<AuditSession>(result.rows[0]) : null;
    }

    async updateStatus(
        id: string,
        status: AuditStatus,
        additionalFields?: Partial<{
            completedAt: Date;
            completedBy: string;
            completionNotes: string;
            cancelledAt: Date;
            cancelledBy: string;
            cancelReason: string;
        }>,
        client?: PoolClient
    ): Promise<AuditSession | null> {
        const conn = (client || this.db) as PgClient;
        const fields: string[] = ['status = $1'];
        const values: unknown[] = [status];
        let paramIndex = 2;

        if (additionalFields) {
            if (additionalFields.completedAt !== undefined) {
                fields.push(`completed_at = $${paramIndex++}`);
                values.push(additionalFields.completedAt);
            }
            if (additionalFields.completedBy !== undefined) {
                fields.push(`completed_by = $${paramIndex++}`);
                values.push(additionalFields.completedBy);
            }
            if (additionalFields.completionNotes !== undefined) {
                fields.push(`completion_notes = $${paramIndex++}`);
                values.push(additionalFields.completionNotes);
            }
            if (additionalFields.cancelledAt !== undefined) {
                fields.push(`cancelled_at = $${paramIndex++}`);
                values.push(additionalFields.cancelledAt);
            }
            if (additionalFields.cancelledBy !== undefined) {
                fields.push(`cancelled_by = $${paramIndex++}`);
                values.push(additionalFields.cancelledBy);
            }
            if (additionalFields.cancelReason !== undefined) {
                fields.push(`cancel_reason = $${paramIndex++}`);
                values.push(additionalFields.cancelReason);
            }
        }

        values.push(id);
        const result = await conn.query(
            `UPDATE audit_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0] ? toCamelCase<AuditSession>(result.rows[0]) : null;
    }

    async updateTotalItems(
        id: string,
        totalItems: number,
        client?: PoolClient
    ): Promise<void> {
        const conn = (client || this.db) as PgClient;
        await conn.query(
            'UPDATE audit_sessions SET total_items = $1 WHERE id = $2',
            [totalItems, id]
        );
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db.query(
            'DELETE FROM audit_sessions WHERE id = $1',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async findAll(
        query: AuditListQuery
    ): Promise<{ data: AuditSessionWithDetails[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            status,
            auditType,
            locationId,
            startDateFrom,
            startDateTo,
            search,
            sortBy = 'created_at',
            sortOrder = 'desc',
            organizationId,
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (organizationId) {
            conditions.push(`a.organization_id = $${paramIndex++}`);
            values.push(organizationId);
        }

        if (status) {
            if (Array.isArray(status)) {
                conditions.push(`a.status = ANY($${paramIndex++})`);
                values.push(status);
            } else {
                conditions.push(`a.status = $${paramIndex++}`);
                values.push(status);
            }
        }

        if (auditType) {
            conditions.push(`a.audit_type = $${paramIndex++}`);
            values.push(auditType);
        }

        if (locationId) {
            conditions.push(`EXISTS (
                SELECT 1 FROM audit_locations al
                WHERE al.audit_id = a.id AND al.location_id = $${paramIndex++}
            )`);
            values.push(locationId);
        }

        if (startDateFrom) {
            conditions.push(`a.start_date >= $${paramIndex++}`);
            values.push(startDateFrom);
        }

        if (startDateTo) {
            conditions.push(`a.start_date <= $${paramIndex++}`);
            values.push(startDateTo);
        }

        if (search) {
            conditions.push(`(
                a.name ILIKE $${paramIndex} OR
                a.audit_code ILIKE $${paramIndex} OR
                a.scope_description ILIKE $${paramIndex}
            )`);
            values.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause =
            conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = ({
            name: 'a.name',
            start_date: 'a.start_date',
            status: 'a.status',
            progress: 'progress_percent',
            created_at: 'a.created_at',
        } as Record<string, string>)[sortBy] || 'a.created_at';

        // Count query
        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM audit_sessions a ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Data query
        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const dataResult = await this.db.query(
            `SELECT
                a.*,
                u.name as created_by_name,
                (
                    SELECT STRING_AGG(l.name, ', ')
                    FROM audit_locations al
                    JOIN locations l ON al.location_id = l.id
                    WHERE al.audit_id = a.id
                ) as locations,
                (
                    SELECT STRING_AGG(c.name, ', ')
                    FROM audit_categories ac
                    JOIN asset_categories c ON ac.category_id = c.id
                    WHERE ac.audit_id = a.id
                ) as categories,
                (SELECT COUNT(*) FROM audit_auditors WHERE audit_id = a.id) as auditor_count,
                CASE
                    WHEN a.total_items > 0
                    THEN ROUND((a.audited_items::DECIMAL / a.total_items) * 100, 2)
                    ELSE 0
                END as progress_percent,
                CASE
                    WHEN a.end_date IS NOT NULL
                    THEN (a.end_date - CURRENT_DATE)
                    ELSE NULL
                END as days_remaining,
                CASE
                    WHEN a.end_date IS NOT NULL AND a.end_date < CURRENT_DATE
                         AND a.status NOT IN ('completed', 'cancelled')
                    THEN TRUE
                    ELSE FALSE
                END as is_overdue
            FROM audit_sessions a
            LEFT JOIN users u ON a.created_by = u.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) =>
                toCamelCase<AuditSessionWithDetails>(row)
            ),
            total,
        };
    }

    async hasActiveAuditForLocation(
        locationId: string,
        excludeAuditId?: string
    ): Promise<boolean> {
        const result = await this.db.query(
            `SELECT 1 FROM audit_sessions a
            JOIN audit_locations al ON a.id = al.audit_id
            WHERE al.location_id = $1
            AND a.status IN ('draft', 'in_progress', 'reviewing')
            ${excludeAuditId ? 'AND a.id != $2' : ''}
            LIMIT 1`,
            excludeAuditId ? [locationId, excludeAuditId] : [locationId]
        );
        return result.rows.length > 0;
    }

    // ==================== Audit Locations ====================

    async addLocation(
        auditId: string,
        locationId: string,
        client?: PoolClient
    ): Promise<AuditLocation> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_locations (audit_id, location_id)
            VALUES ($1, $2)
            ON CONFLICT (audit_id, location_id) DO NOTHING
            RETURNING *`,
            [auditId, locationId]
        );
        return toCamelCase<AuditLocation>(result.rows[0]);
    }

    async addLocations(
        auditId: string,
        locationIds: string[],
        client?: PoolClient
    ): Promise<void> {
        const conn = (client || this.db) as PgClient;
        for (const locationId of locationIds) {
            await conn.query(
                `INSERT INTO audit_locations (audit_id, location_id)
                VALUES ($1, $2)
                ON CONFLICT (audit_id, location_id) DO NOTHING`,
                [auditId, locationId]
            );
        }
    }

    async findLocationsByAuditId(
        auditId: string
    ): Promise<AuditLocationWithDetails[]> {
        const result = await this.db.query(
            `SELECT al.*, l.name as location_name, l.path as location_path
            FROM audit_locations al
            JOIN locations l ON al.location_id = l.id
            WHERE al.audit_id = $1`,
            [auditId]
        );
        return result.rows.map((row) =>
            toCamelCase<AuditLocationWithDetails>(row)
        );
    }

    async removeLocation(
        auditId: string,
        locationId: string
    ): Promise<boolean> {
        const result = await this.db.query(
            'DELETE FROM audit_locations WHERE audit_id = $1 AND location_id = $2',
            [auditId, locationId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // ==================== Audit Categories ====================

    async addCategories(
        auditId: string,
        categoryIds: string[],
        client?: PoolClient
    ): Promise<void> {
        const conn = (client || this.db) as PgClient;
        for (const categoryId of categoryIds) {
            await conn.query(
                `INSERT INTO audit_categories (audit_id, category_id)
                VALUES ($1, $2)
                ON CONFLICT (audit_id, category_id) DO NOTHING`,
                [auditId, categoryId]
            );
        }
    }

    async findCategoriesByAuditId(
        auditId: string
    ): Promise<AuditCategoryWithDetails[]> {
        const result = await this.db.query(
            `SELECT ac.*, c.name as category_name
            FROM audit_categories ac
            JOIN asset_categories c ON ac.category_id = c.id
            WHERE ac.audit_id = $1`,
            [auditId]
        );
        return result.rows.map((row) =>
            toCamelCase<AuditCategoryWithDetails>(row)
        );
    }

    // ==================== Audit Auditors ====================

    async addAuditor(
        auditId: string,
        userId: string,
        locationId?: string,
        isLead?: boolean,
        client?: PoolClient
    ): Promise<AuditAuditor> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_auditors (audit_id, user_id, assigned_location_id, is_lead)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (audit_id, user_id) DO UPDATE SET
                assigned_location_id = EXCLUDED.assigned_location_id,
                is_lead = EXCLUDED.is_lead
            RETURNING *`,
            [auditId, userId, locationId || null, isLead || false]
        );
        return toCamelCase<AuditAuditor>(result.rows[0]);
    }

    async addAuditors(
        auditId: string,
        auditors: Array<{
            userId: string;
            locationId?: string;
            isLead?: boolean;
        }>,
        client?: PoolClient
    ): Promise<void> {
        for (const auditor of auditors) {
            await this.addAuditor(
                auditId,
                auditor.userId,
                auditor.locationId,
                auditor.isLead,
                client
            );
        }
    }

    async findAuditorsByAuditId(
        auditId: string
    ): Promise<AuditAuditorWithDetails[]> {
        const result = await this.db.query(
            `SELECT aa.*, u.name as user_name, u.email as user_email,
                    l.name as assigned_location_name
            FROM audit_auditors aa
            JOIN users u ON aa.user_id = u.id
            LEFT JOIN locations l ON aa.assigned_location_id = l.id
            WHERE aa.audit_id = $1`,
            [auditId]
        );
        return result.rows.map((row) =>
            toCamelCase<AuditAuditorWithDetails>(row)
        );
    }

    async removeAuditor(
        auditId: string,
        userId: string
    ): Promise<boolean> {
        const result = await this.db.query(
            'DELETE FROM audit_auditors WHERE audit_id = $1 AND user_id = $2',
            [auditId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async isAuditor(auditId: string, userId: string): Promise<boolean> {
        const result = await this.db.query(
            'SELECT 1 FROM audit_auditors WHERE audit_id = $1 AND user_id = $2',
            [auditId, userId]
        );
        return result.rows.length > 0;
    }

    async findAuditsByAuditor(
        userId: string
    ): Promise<AuditSessionWithDetails[]> {
        const result = await this.db.query(
            `SELECT
                a.*,
                u.name as created_by_name,
                (
                    SELECT STRING_AGG(l.name, ', ')
                    FROM audit_locations al
                    JOIN locations l ON al.location_id = l.id
                    WHERE al.audit_id = a.id
                ) as locations,
                (SELECT COUNT(*) FROM audit_auditors WHERE audit_id = a.id) as auditor_count,
                CASE
                    WHEN a.total_items > 0
                    THEN ROUND((a.audited_items::DECIMAL / a.total_items) * 100, 2)
                    ELSE 0
                END as progress_percent,
                aa.is_lead,
                aa.assigned_location_id
            FROM audit_sessions a
            JOIN audit_auditors aa ON a.id = aa.audit_id
            LEFT JOIN users u ON a.created_by = u.id
            WHERE aa.user_id = $1 AND a.status IN ('in_progress', 'reviewing')
            ORDER BY a.start_date`,
            [userId]
        );
        return result.rows.map((row) =>
            toCamelCase<AuditSessionWithDetails>(row)
        );
    }

    // ==================== Audit Items ====================

    async createAuditItem(
        dto: AuditItemDto,
        client?: PoolClient
    ): Promise<AuditItem> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_items (
                audit_id, asset_id, audit_status, actual_location_id,
                actual_user_id, actual_condition, notes, audited_by, audited_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (audit_id, asset_id) DO UPDATE SET
                audit_status = EXCLUDED.audit_status,
                actual_location_id = EXCLUDED.actual_location_id,
                actual_user_id = EXCLUDED.actual_user_id,
                actual_condition = EXCLUDED.actual_condition,
                notes = EXCLUDED.notes,
                audited_by = EXCLUDED.audited_by,
                audited_at = NOW()
            RETURNING *`,
            [
                dto.auditId,
                dto.assetId,
                dto.auditStatus,
                dto.actualLocationId || null,
                dto.actualUserId || null,
                dto.actualCondition || null,
                dto.notes || null,
                dto.auditedBy,
            ]
        );
        return toCamelCase<AuditItem>(result.rows[0]);
    }

    async createAuditItems(
        auditId: string,
        assetIds: string[],
        client?: PoolClient
    ): Promise<number> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_items (audit_id, asset_id, expected_location_id, expected_user_id, expected_condition)
            SELECT $1, a.id, a.location_id, a.assigned_to, a.condition
            FROM assets a
            WHERE a.id = ANY($2)
            ON CONFLICT (audit_id, asset_id) DO NOTHING`,
            [auditId, assetIds]
        );
        return result.rowCount ?? 0;
    }

    async populateAuditItemsFromScope(
        auditId: string,
        locationIds: string[],
        categoryIds?: string[],
        client?: PoolClient
    ): Promise<number> {
        const conn = (client || this.db) as PgClient;

        let query = `
            INSERT INTO audit_items (audit_id, asset_id, expected_location_id, expected_user_id, expected_condition)
            SELECT $1, a.id, a.location_id, a.assigned_to, a.condition
            FROM assets a
            WHERE a.location_id = ANY($2)
            AND a.status != 'disposed'
        `;
        const params: unknown[] = [auditId, locationIds];

        if (categoryIds && categoryIds.length > 0) {
            query += ` AND a.category_id = ANY($3)`;
            params.push(categoryIds);
        }

        query += ` ON CONFLICT (audit_id, asset_id) DO NOTHING`;

        const result = await conn.query(query, params);
        return result.rowCount ?? 0;
    }

    async findAuditItemById(id: string): Promise<AuditItem | null> {
        const result = await this.db.query(
            'SELECT * FROM audit_items WHERE id = $1',
            [id]
        );
        return result.rows[0] ? toCamelCase<AuditItem>(result.rows[0]) : null;
    }

    async findAuditItemByAsset(
        auditId: string,
        assetId: string
    ): Promise<AuditItem | null> {
        const result = await this.db.query(
            'SELECT * FROM audit_items WHERE audit_id = $1 AND asset_id = $2',
            [auditId, assetId]
        );
        return result.rows[0] ? toCamelCase<AuditItem>(result.rows[0]) : null;
    }

    async findAuditItemsByAuditId(
        auditId: string,
        query: AuditItemListQuery
    ): Promise<{ data: AuditItemWithDetails[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            auditStatus,
            resolutionStatus,
            locationId,
            auditorId,
            search,
            sortBy = 'asset_tag',
            sortOrder = 'asc',
        } = query;

        const conditions: string[] = ['ai.audit_id = $1'];
        const values: unknown[] = [auditId];
        let paramIndex = 2;

        if (auditStatus) {
            if (Array.isArray(auditStatus)) {
                conditions.push(`ai.audit_status = ANY($${paramIndex++})`);
                values.push(auditStatus);
            } else {
                conditions.push(`ai.audit_status = $${paramIndex++}`);
                values.push(auditStatus);
            }
        }

        if (resolutionStatus) {
            conditions.push(`ai.resolution_status = $${paramIndex++}`);
            values.push(resolutionStatus);
        }

        if (locationId) {
            conditions.push(`ai.expected_location_id = $${paramIndex++}`);
            values.push(locationId);
        }

        if (auditorId) {
            conditions.push(`ai.audited_by = $${paramIndex++}`);
            values.push(auditorId);
        }

        if (search) {
            conditions.push(`(
                ast.asset_tag ILIKE $${paramIndex} OR
                ast.name ILIKE $${paramIndex} OR
                ast.serial_number ILIKE $${paramIndex}
            )`);
            values.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const sortColumn = ({
            asset_tag: 'ast.asset_tag',
            audit_status: 'ai.audit_status',
            audited_at: 'ai.audited_at',
            resolution_status: 'ai.resolution_status',
        } as Record<string, string>)[sortBy] || 'ast.asset_tag';

        // Count
        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM audit_items ai
            JOIN assets ast ON ai.asset_id = ast.id
            ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Data
        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const dataResult = await this.db.query(
            `SELECT
                ai.*,
                ast.asset_tag,
                ast.name as asset_name,
                ast.serial_number as asset_serial_number,
                m.name as asset_model_name,
                el.name as expected_location_name,
                al.name as actual_location_name,
                eu.name as expected_user_name,
                au.name as actual_user_name,
                aud.name as audited_by_name,
                res.name as resolved_by_name
            FROM audit_items ai
            JOIN assets ast ON ai.asset_id = ast.id
            LEFT JOIN asset_models m ON ast.model_id = m.id
            LEFT JOIN locations el ON ai.expected_location_id = el.id
            LEFT JOIN locations al ON ai.actual_location_id = al.id
            LEFT JOIN users eu ON ai.expected_user_id = eu.id
            LEFT JOIN users au ON ai.actual_user_id = au.id
            LEFT JOIN users aud ON ai.audited_by = aud.id
            LEFT JOIN users res ON ai.resolved_by = res.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) =>
                toCamelCase<AuditItemWithDetails>(row)
            ),
            total,
        };
    }

    async updateAuditItem(
        id: string,
        status: AuditItemStatus,
        data: Partial<{
            actualLocationId: string;
            actualUserId: string;
            actualCondition: string;
            notes: string;
            auditedBy: string;
        }>,
        client?: PoolClient
    ): Promise<AuditItem | null> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `UPDATE audit_items SET
                audit_status = $1,
                actual_location_id = COALESCE($2, actual_location_id),
                actual_user_id = COALESCE($3, actual_user_id),
                actual_condition = COALESCE($4, actual_condition),
                notes = COALESCE($5, notes),
                audited_by = COALESCE($6, audited_by),
                audited_at = NOW()
            WHERE id = $7
            RETURNING *`,
            [
                status,
                data.actualLocationId || null,
                data.actualUserId || null,
                data.actualCondition || null,
                data.notes || null,
                data.auditedBy || null,
                id,
            ]
        );
        return result.rows[0] ? toCamelCase<AuditItem>(result.rows[0]) : null;
    }

    async resolveDiscrepancy(
        id: string,
        resolutionAction: string,
        resolvedBy: string,
        client?: PoolClient
    ): Promise<AuditItem | null> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `UPDATE audit_items SET
                resolution_status = 'resolved',
                resolution_action = $1,
                resolved_by = $2,
                resolved_at = NOW()
            WHERE id = $3
            RETURNING *`,
            [resolutionAction, resolvedBy, id]
        );
        return result.rows[0] ? toCamelCase<AuditItem>(result.rows[0]) : null;
    }

    async findDiscrepancies(
        auditId: string,
        query: DiscrepancyQuery
    ): Promise<{ data: AuditItemWithDetails[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            auditStatus,
            resolutionStatus,
            sortBy = 'asset_tag',
            sortOrder = 'asc',
        } = query;

        const conditions: string[] = [
            'ai.audit_id = $1',
            "ai.audit_status IN ('missing', 'misplaced', 'condition_issue')",
        ];
        const values: unknown[] = [auditId];
        let paramIndex = 2;

        if (auditStatus && auditStatus.length > 0) {
            conditions.push(`ai.audit_status = ANY($${paramIndex++})`);
            values.push(auditStatus);
        }

        if (resolutionStatus) {
            conditions.push(`ai.resolution_status = $${paramIndex++}`);
            values.push(resolutionStatus);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const sortColumn = ({
            asset_tag: 'ast.asset_tag',
            audit_status: 'ai.audit_status',
            audited_at: 'ai.audited_at',
        } as Record<string, string>)[sortBy] || 'ast.asset_tag';

        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM audit_items ai
            JOIN assets ast ON ai.asset_id = ast.id
            ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const dataResult = await this.db.query(
            `SELECT
                ai.*,
                ast.asset_tag,
                ast.name as asset_name,
                ast.serial_number as asset_serial_number,
                el.name as expected_location_name,
                al.name as actual_location_name,
                eu.name as expected_user_name,
                au.name as actual_user_name,
                aud.name as audited_by_name
            FROM audit_items ai
            JOIN assets ast ON ai.asset_id = ast.id
            LEFT JOIN locations el ON ai.expected_location_id = el.id
            LEFT JOIN locations al ON ai.actual_location_id = al.id
            LEFT JOIN users eu ON ai.expected_user_id = eu.id
            LEFT JOIN users au ON ai.actual_user_id = au.id
            LEFT JOIN users aud ON ai.audited_by = aud.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) =>
                toCamelCase<AuditItemWithDetails>(row)
            ),
            total,
        };
    }

    async getAuditProgress(auditId: string): Promise<AuditProgress> {
        const itemStats = await this.db.query(
            `SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE audit_status != 'pending') as audited,
                COUNT(*) FILTER (WHERE audit_status = 'pending') as pending,
                COUNT(*) FILTER (WHERE audit_status = 'found') as found,
                COUNT(*) FILTER (WHERE audit_status = 'missing') as missing,
                COUNT(*) FILTER (WHERE audit_status = 'misplaced') as misplaced,
                COUNT(*) FILTER (WHERE audit_status = 'condition_issue') as condition_issues
            FROM audit_items
            WHERE audit_id = $1`,
            [auditId]
        );

        const stats = itemStats.rows[0];
        const total = parseInt(stats.total, 10);
        const audited = parseInt(stats.audited, 10);

        const byLocation = await this.db.query(
            `SELECT
                ai.expected_location_id as location_id,
                l.name as location_name,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ai.audit_status != 'pending') as audited
            FROM audit_items ai
            LEFT JOIN locations l ON ai.expected_location_id = l.id
            WHERE ai.audit_id = $1
            GROUP BY ai.expected_location_id, l.name`,
            [auditId]
        );

        const byAuditor = await this.db.query(
            `SELECT
                ai.audited_by as auditor_id,
                u.name as auditor_name,
                COUNT(*) as audited
            FROM audit_items ai
            LEFT JOIN users u ON ai.audited_by = u.id
            WHERE ai.audit_id = $1 AND ai.audited_by IS NOT NULL
            GROUP BY ai.audited_by, u.name`,
            [auditId]
        );

        return {
            auditId,
            totalItems: total,
            auditedItems: audited,
            pendingItems: parseInt(stats.pending, 10),
            foundItems: parseInt(stats.found, 10),
            missingItems: parseInt(stats.missing, 10),
            misplacedItems: parseInt(stats.misplaced, 10),
            conditionIssues: parseInt(stats.condition_issues, 10),
            progressPercent: total > 0 ? Math.round((audited / total) * 100 * 100) / 100 : 0,
            byLocation: byLocation.rows.map((row) => ({
                locationId: row.location_id,
                locationName: row.location_name || 'Unknown',
                total: parseInt(row.total, 10),
                audited: parseInt(row.audited, 10),
                percent:
                    parseInt(row.total, 10) > 0
                        ? Math.round(
                            (parseInt(row.audited, 10) / parseInt(row.total, 10)) * 100
                        )
                        : 0,
            })),
            byAuditor: byAuditor.rows.map((row) => ({
                auditorId: row.auditor_id,
                auditorName: row.auditor_name || 'Unknown',
                audited: parseInt(row.audited, 10),
            })),
        };
    }

    // ==================== Unregistered Assets ====================

    async createUnregisteredAsset(
        dto: CreateUnregisteredAssetDto,
        client?: PoolClient
    ): Promise<UnregisteredAsset> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_unregistered_assets (
                audit_id, temporary_id, description, serial_number,
                location_found_id, location_found_text, condition,
                photo_path, action, action_notes, found_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                dto.auditId,
                dto.temporaryId,
                dto.description,
                dto.serialNumber || null,
                dto.locationFoundId || null,
                dto.locationFoundText || null,
                dto.condition || null,
                dto.photoPath || null,
                dto.action || 'investigate',
                dto.actionNotes || null,
                dto.foundBy,
            ]
        );
        return toCamelCase<UnregisteredAsset>(result.rows[0]);
    }

    async findUnregisteredAssetById(
        id: string
    ): Promise<UnregisteredAsset | null> {
        const result = await this.db.query(
            'SELECT * FROM audit_unregistered_assets WHERE id = $1',
            [id]
        );
        return result.rows[0]
            ? toCamelCase<UnregisteredAsset>(result.rows[0])
            : null;
    }

    async findUnregisteredAssetsByAuditId(
        auditId: string,
        query: UnregisteredAssetQuery
    ): Promise<{ data: UnregisteredAssetWithDetails[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            action,
            sortBy = 'found_at',
            sortOrder = 'desc',
        } = query;

        const conditions: string[] = ['ua.audit_id = $1'];
        const values: unknown[] = [auditId];
        let paramIndex = 2;

        if (action) {
            conditions.push(`ua.action = $${paramIndex++}`);
            values.push(action);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const sortColumn = ({
            found_at: 'ua.found_at',
            temporary_id: 'ua.temporary_id',
            action: 'ua.action',
        } as Record<string, string>)[sortBy] || 'ua.found_at';

        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM audit_unregistered_assets ua ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const dataResult = await this.db.query(
            `SELECT
                ua.*,
                l.name as location_found_name,
                fb.name as found_by_name,
                rb.name as registered_by_name,
                ra.asset_tag as registered_asset_tag
            FROM audit_unregistered_assets ua
            LEFT JOIN locations l ON ua.location_found_id = l.id
            LEFT JOIN users fb ON ua.found_by = fb.id
            LEFT JOIN users rb ON ua.registered_by = rb.id
            LEFT JOIN assets ra ON ua.registered_asset_id = ra.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) =>
                toCamelCase<UnregisteredAssetWithDetails>(row)
            ),
            total,
        };
    }

    async updateUnregisteredAsset(
        id: string,
        dto: UpdateUnregisteredAssetDto,
        client?: PoolClient
    ): Promise<UnregisteredAsset | null> {
        const conn = (client || this.db) as PgClient;
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (dto.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(dto.description);
        }
        if (dto.serialNumber !== undefined) {
            fields.push(`serial_number = $${paramIndex++}`);
            values.push(dto.serialNumber);
        }
        if (dto.condition !== undefined) {
            fields.push(`condition = $${paramIndex++}`);
            values.push(dto.condition);
        }
        if (dto.action !== undefined) {
            fields.push(`action = $${paramIndex++}`);
            values.push(dto.action);
        }
        if (dto.actionNotes !== undefined) {
            fields.push(`action_notes = $${paramIndex++}`);
            values.push(dto.actionNotes);
        }

        if (fields.length === 0) {
            return this.findUnregisteredAssetById(id);
        }

        values.push(id);
        const result = await conn.query(
            `UPDATE audit_unregistered_assets SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0]
            ? toCamelCase<UnregisteredAsset>(result.rows[0])
            : null;
    }

    async markUnregisteredAssetRegistered(
        id: string,
        assetId: string,
        registeredBy: string,
        client?: PoolClient
    ): Promise<UnregisteredAsset | null> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `UPDATE audit_unregistered_assets SET
                action = 'register',
                registered_asset_id = $1,
                registered_by = $2,
                registered_at = NOW()
            WHERE id = $3
            RETURNING *`,
            [assetId, registeredBy, id]
        );
        return result.rows[0]
            ? toCamelCase<UnregisteredAsset>(result.rows[0])
            : null;
    }

    // ==================== Audit History ====================

    async createHistory(
        auditId: string,
        action: string,
        actorId: string,
        oldStatus?: AuditStatus,
        newStatus?: AuditStatus,
        details?: Record<string, unknown>,
        client?: PoolClient
    ): Promise<AuditHistory> {
        const conn = (client || this.db) as PgClient;
        const result = await conn.query(
            `INSERT INTO audit_history (audit_id, action, actor_id, old_status, new_status, details)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                auditId,
                action,
                actorId,
                oldStatus || null,
                newStatus || null,
                details ? JSON.stringify(details) : null,
            ]
        );
        return toCamelCase<AuditHistory>(result.rows[0]);
    }

    async findHistoryByAuditId(
        auditId: string
    ): Promise<AuditHistoryWithDetails[]> {
        const result = await this.db.query(
            `SELECT ah.*, u.name as actor_name
            FROM audit_history ah
            LEFT JOIN users u ON ah.actor_id = u.id
            WHERE ah.audit_id = $1
            ORDER BY ah.created_at DESC`,
            [auditId]
        );
        return result.rows.map((row) =>
            toCamelCase<AuditHistoryWithDetails>(row)
        );
    }

    // ==================== Statistics ====================

    async getStatistics(organizationId?: string): Promise<AuditStatistics> {
        const conditions = organizationId
            ? 'WHERE organization_id = $1'
            : '';
        const values = organizationId ? [organizationId] : [];

        const result = await this.db.query(
            `SELECT
                COUNT(*) as total_audits,
                COUNT(*) FILTER (WHERE status IN ('in_progress', 'reviewing')) as active_audits,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_audits,
                COUNT(*) FILTER (
                    WHERE status IN ('in_progress', 'reviewing')
                    AND end_date < CURRENT_DATE
                ) as overdue_audits,
                AVG(
                    CASE WHEN status = 'completed' AND total_items > 0
                    THEN (found_items::DECIMAL / total_items) * 100
                    END
                ) as avg_found_rate,
                AVG(
                    CASE WHEN status = 'completed' AND total_items > 0
                    THEN (missing_items::DECIMAL / total_items) * 100
                    END
                ) as avg_missing_rate,
                AVG(
                    CASE WHEN status = 'completed' AND completed_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400
                    END
                ) as avg_completion_time,
                COUNT(*) FILTER (WHERE audit_type = 'full') as type_full,
                COUNT(*) FILTER (WHERE audit_type = 'partial') as type_partial,
                COUNT(*) FILTER (WHERE audit_type = 'spot_check') as type_spot_check,
                COUNT(*) FILTER (WHERE status = 'draft') as status_draft,
                COUNT(*) FILTER (WHERE status = 'in_progress') as status_in_progress,
                COUNT(*) FILTER (WHERE status = 'reviewing') as status_reviewing,
                COUNT(*) FILTER (WHERE status = 'completed') as status_completed,
                COUNT(*) FILTER (WHERE status = 'cancelled') as status_cancelled
            FROM audit_sessions
            ${conditions}`,
            values
        );

        const stats = result.rows[0];

        // Get recent discrepancies
        const discrepancyResult = await this.db.query(
            `SELECT COUNT(*) FROM audit_items ai
            JOIN audit_sessions a ON ai.audit_id = a.id
            WHERE ai.audit_status IN ('missing', 'misplaced', 'condition_issue')
            AND ai.resolution_status = 'unresolved'
            AND a.status IN ('in_progress', 'reviewing', 'completed')
            ${organizationId ? 'AND a.organization_id = $1' : ''}`,
            values
        );

        return {
            totalAudits: parseInt(stats.total_audits, 10),
            activeAudits: parseInt(stats.active_audits, 10),
            completedAudits: parseInt(stats.completed_audits, 10),
            overdueAudits: parseInt(stats.overdue_audits, 10),
            avgFoundRate: parseFloat(stats.avg_found_rate) || 0,
            avgMissingRate: parseFloat(stats.avg_missing_rate) || 0,
            avgCompletionTime: parseFloat(stats.avg_completion_time) || 0,
            byType: {
                full: parseInt(stats.type_full, 10),
                partial: parseInt(stats.type_partial, 10),
                spot_check: parseInt(stats.type_spot_check, 10),
            },
            byStatus: {
                draft: parseInt(stats.status_draft, 10),
                in_progress: parseInt(stats.status_in_progress, 10),
                reviewing: parseInt(stats.status_reviewing, 10),
                completed: parseInt(stats.status_completed, 10),
                cancelled: parseInt(stats.status_cancelled, 10),
            },
            recentDiscrepancies: parseInt(discrepancyResult.rows[0].count, 10),
        };
    }

    // ==================== Transaction Helper ====================

    async withTransaction<T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        return this.db.transaction(callback);
    }
}
