/**
 * Checkout Module - Repository Layer
 * Database operations for asset checkout/checkin management
 */

import type { PoolClient } from 'pg';
import type { PgClient } from '../PgClient.js';
import type {
    AssetCheckout,
    AssetCheckoutWithDetails,
    CheckoutExtension,
    CheckoutExtensionWithDetails,
    CheckoutTransfer,
    CheckoutTransferWithDetails,
    CheckoutAuditLog,
    CheckoutAssetDto,
    CheckinAssetDto,
    ExtendCheckoutDto,
    TransferAssetDto,
    CheckoutListQuery,
    CheckoutHistoryQuery,
    ExtensionListQuery,
    TransferListQuery,
    CheckoutPaginatedResponse,
    CheckoutSummary,
    OverdueCheckout,
    DueStatus
} from '@qltb/contracts/checkout';

// ==================== Helper Functions ====================

function mapRowToCheckout(row: Record<string, unknown>): AssetCheckout {
    return {
        id: row.id as string,
        checkoutCode: row.checkout_code as string,
        assetId: row.asset_id as string,
        checkoutType: row.checkout_type as AssetCheckout['checkoutType'],
        targetUserId: row.target_user_id as string | null,
        targetLocationId: row.target_location_id as string | null,
        targetAssetId: row.target_asset_id as string | null,
        checkoutDate: row.checkout_date as Date,
        expectedCheckinDate: row.expected_checkin_date as string | null,
        checkedOutBy: row.checked_out_by as string,
        checkoutNotes: row.checkout_notes as string | null,
        checkinDate: row.checkin_date as Date | null,
        checkedInBy: row.checked_in_by as string | null,
        checkinNotes: row.checkin_notes as string | null,
        checkinCondition: row.checkin_condition as AssetCheckout['checkinCondition'],
        nextAction: row.next_action as AssetCheckout['nextAction'],
        status: row.status as AssetCheckout['status'],
        isOverdue: row.is_overdue as boolean,
        overdueNotifiedAt: row.overdue_notified_at as Date | null,
        overdueNotificationCount: Number(row.overdue_notification_count ?? 0),
        organizationId: row.organization_id as string | null,
        createdAt: row.created_at as Date,
        updatedAt: row.updated_at as Date
    };
}

function calculateDueStatus(
    expectedCheckinDate: string | null,
    status: string,
    isOverdue: boolean
): DueStatus {
    if (status === 'checked_in') return 'on_track';
    if (!expectedCheckinDate) return 'indefinite';
    if (isOverdue) return 'overdue';

    const expected = new Date(expectedCheckinDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 3) return 'due_soon';
    return 'on_track';
}

function mapRowToCheckoutWithDetails(row: Record<string, unknown>): AssetCheckoutWithDetails {
    const base = mapRowToCheckout(row);
    const dueStatus = calculateDueStatus(
        base.expectedCheckinDate,
        base.status,
        base.isOverdue
    );

    let daysUntilDue: number | null = null;
    let daysOverdue: number | null = null;

    if (base.expectedCheckinDate && base.status === 'checked_out') {
        const expected = new Date(base.expectedCheckinDate);
        const now = new Date();
        const diff = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diff >= 0) {
            daysUntilDue = diff;
        } else {
            daysOverdue = Math.abs(diff);
        }
    }

    return {
        ...base,
        assetTag: row.asset_code as string,
        assetName: row.asset_name as string,
        assetCategory: row.asset_category as string | null,
        assetSerialNumber: row.asset_serial_number as string | null,
        targetUserName: row.target_user_name as string | null,
        targetUserEmail: row.target_user_email as string | null,
        targetLocationName: row.target_location_name as string | null,
        targetAssetTag: row.target_asset_tag as string | null,
        targetAssetName: row.target_asset_name as string | null,
        checkedOutByName: row.checked_out_by_name as string | null,
        checkedInByName: row.checked_in_by_name as string | null,
        dueStatus,
        daysUntilDue,
        daysOverdue
    };
}

function mapRowToExtension(row: Record<string, unknown>): CheckoutExtension {
    return {
        id: row.id as string,
        checkoutId: row.checkout_id as string,
        previousExpectedDate: row.previous_expected_date as string,
        newExpectedDate: row.new_expected_date as string,
        extensionReason: row.extension_reason as string | null,
        extendedBy: row.extended_by as string,
        extendedAt: row.extended_at as Date,
        notes: row.notes as string | null
    };
}

function mapRowToExtensionWithDetails(row: Record<string, unknown>): CheckoutExtensionWithDetails {
    const base = mapRowToExtension(row);
    return {
        ...base,
        extendedByName: row.extended_by_name as string | null,
        checkoutCode: row.checkout_code as string,
        assetTag: row.asset_code as string
    };
}

function mapRowToTransfer(row: Record<string, unknown>): CheckoutTransfer {
    return {
        id: row.id as string,
        originalCheckoutId: row.original_checkout_id as string,
        newCheckoutId: row.new_checkout_id as string,
        fromUserId: row.from_user_id as string,
        toUserId: row.to_user_id as string,
        transferReason: row.transfer_reason as string | null,
        transferredBy: row.transferred_by as string,
        transferredAt: row.transferred_at as Date,
        notes: row.notes as string | null
    };
}

function mapRowToTransferWithDetails(row: Record<string, unknown>): CheckoutTransferWithDetails {
    const base = mapRowToTransfer(row);
    return {
        ...base,
        fromUserName: row.from_user_name as string | null,
        toUserName: row.to_user_name as string | null,
        transferredByName: row.transferred_by_name as string | null,
        assetTag: row.asset_code as string,
        assetName: row.asset_name as string
    };
}

function mapRowToAuditLog(row: Record<string, unknown>): CheckoutAuditLog {
    return {
        id: row.id as string,
        checkoutId: row.checkout_id as string | null,
        assetId: row.asset_id as string | null,
        action: row.action as string,
        actionType: row.action_type as string,
        oldValues: row.old_values as Record<string, unknown> | null,
        newValues: row.new_values as Record<string, unknown> | null,
        performedBy: row.performed_by as string,
        performedAt: row.performed_at as Date,
        ipAddress: row.ip_address as string | null,
        userAgent: row.user_agent as string | null,
        notes: row.notes as string | null
    };
}

function mapRowToOverdueCheckout(row: Record<string, unknown>): OverdueCheckout {
    return {
        checkoutId: row.checkout_id as string,
        checkoutCode: row.checkout_code as string,
        assetId: row.asset_id as string,
        assetTag: row.asset_code as string,
        assetName: row.asset_name as string,
        targetUserId: row.target_user_id as string,
        targetUserName: row.target_user_name as string | null,
        targetUserEmail: row.target_user_email as string | null,
        expectedCheckinDate: row.expected_checkin_date as string,
        daysOverdue: Number(row.days_overdue),
        notificationCount: Number(row.overdue_notification_count ?? 0),
        lastNotifiedAt: row.overdue_notified_at as Date | null
    };
}

// ==================== Repository Class ====================

export class CheckoutRepo {
    constructor(private readonly db: PgClient) { }

    // ==================== Checkout CRUD ====================

    async checkout(dto: CheckoutAssetDto, client?: PoolClient): Promise<AssetCheckout> {
        const conn = (client ?? this.db) as PgClient;

        const result = await conn.query(
            `INSERT INTO asset_checkouts (
                asset_id, checkout_type, target_user_id, target_location_id, target_asset_id,
                checkout_date, expected_checkin_date, checked_out_by, checkout_notes,
                organization_id, status
            ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, 'checked_out')
            RETURNING *`,
            [
                dto.assetId,
                dto.checkoutType,
                dto.targetUserId ?? null,
                dto.targetLocationId ?? null,
                dto.targetAssetId ?? null,
                dto.expectedCheckinDate ?? null,
                dto.checkedOutBy,
                dto.checkoutNotes ?? null,
                dto.organizationId ?? null
            ]
        );

        return mapRowToCheckout(result.rows[0]);
    }

    async checkin(dto: CheckinAssetDto, client?: PoolClient): Promise<AssetCheckout | null> {
        const conn = (client ?? this.db) as PgClient;

        const result = await conn.query(
            `UPDATE asset_checkouts SET
                checkin_date = NOW(),
                checked_in_by = $2,
                checkin_notes = $3,
                checkin_condition = $4,
                next_action = $5,
                status = 'checked_in',
                is_overdue = FALSE
            WHERE id = $1 AND status = 'checked_out'
            RETURNING *`,
            [
                dto.checkoutId,
                dto.checkedInBy,
                dto.checkinNotes ?? null,
                dto.checkinCondition,
                dto.nextAction
            ]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCheckout(result.rows[0]);
    }

    async findById(id: string): Promise<AssetCheckout | null> {
        const result = await this.db.query(
            'SELECT * FROM asset_checkouts WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCheckout(result.rows[0]);
    }

    async findByIdWithDetails(id: string): Promise<AssetCheckoutWithDetails | null> {
        const result = await this.db.query(
            `SELECT
                c.*,
                a.asset_code,
                COALESCE(a.asset_code, a.serial_no) as asset_name,
                NULL::text as asset_category,
                a.serial_no as asset_serial_number,
                u.name as target_user_name,
                u.email as target_user_email,
                l.name as target_location_name,
                ta.asset_code as target_asset_tag,
                COALESCE(ta.asset_code, ta.serial_no) as target_asset_name,
                cby.name as checked_out_by_name,
                iby.name as checked_in_by_name
            FROM asset_checkouts c
            LEFT JOIN assets a ON c.asset_id = a.id
            LEFT JOIN users u ON c.target_user_id = u.id
            LEFT JOIN locations l ON c.target_location_id = l.id
            LEFT JOIN assets ta ON c.target_asset_id = ta.id
            LEFT JOIN users cby ON c.checked_out_by = cby.id
            LEFT JOIN users iby ON c.checked_in_by = iby.id
            WHERE c.id = $1`,
            [id]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCheckoutWithDetails(result.rows[0]);
    }

    async findByCode(code: string): Promise<AssetCheckout | null> {
        const result = await this.db.query(
            'SELECT * FROM asset_checkouts WHERE checkout_code = $1',
            [code]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCheckout(result.rows[0]);
    }

    async findActiveByAssetId(assetId: string): Promise<AssetCheckout | null> {
        const result = await this.db.query(
            `SELECT * FROM asset_checkouts
            WHERE asset_id = $1 AND status = 'checked_out'
            ORDER BY checkout_date DESC LIMIT 1`,
            [assetId]
        );

        if (result.rows.length === 0) return null;
        return mapRowToCheckout(result.rows[0]);
    }

    async list(query: CheckoutListQuery): Promise<CheckoutPaginatedResponse<AssetCheckoutWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.search) {
            conditions.push(`(c.checkout_code ILIKE $${paramIndex} OR a.asset_code ILIKE $${paramIndex} OR a.serial_no ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            conditions.push(`c.status = ANY($${paramIndex})`);
            params.push(statuses);
            paramIndex++;
        }

        if (query.checkoutType) {
            const types = Array.isArray(query.checkoutType) ? query.checkoutType : [query.checkoutType];
            conditions.push(`c.checkout_type = ANY($${paramIndex})`);
            params.push(types);
            paramIndex++;
        }

        if (query.dueStatus) {
            const dueStatuses = Array.isArray(query.dueStatus) ? query.dueStatus : [query.dueStatus];
            const dueConditions: string[] = [];

            for (const ds of dueStatuses) {
                switch (ds) {
                    case 'overdue':
                        dueConditions.push(`(c.is_overdue = TRUE AND c.status = 'checked_out')`);
                        break;
                    case 'due_soon':
                        dueConditions.push(`(c.expected_checkin_date IS NOT NULL AND c.expected_checkin_date <= CURRENT_DATE + INTERVAL '3 days' AND c.expected_checkin_date > CURRENT_DATE AND c.status = 'checked_out')`);
                        break;
                    case 'on_track':
                        dueConditions.push(`(c.expected_checkin_date > CURRENT_DATE + INTERVAL '3 days' AND c.status = 'checked_out')`);
                        break;
                    case 'indefinite':
                        dueConditions.push(`(c.expected_checkin_date IS NULL AND c.status = 'checked_out')`);
                        break;
                }
            }

            if (dueConditions.length > 0) {
                conditions.push(`(${dueConditions.join(' OR ')})`);
            }
        }

        if (query.assetId) {
            conditions.push(`c.asset_id = $${paramIndex}`);
            params.push(query.assetId);
            paramIndex++;
        }

        if (query.targetUserId) {
            conditions.push(`c.target_user_id = $${paramIndex}`);
            params.push(query.targetUserId);
            paramIndex++;
        }

        if (query.targetLocationId) {
            conditions.push(`c.target_location_id = $${paramIndex}`);
            params.push(query.targetLocationId);
            paramIndex++;
        }

        if (query.checkedOutBy) {
            conditions.push(`c.checked_out_by = $${paramIndex}`);
            params.push(query.checkedOutBy);
            paramIndex++;
        }

        if (query.organizationId) {
            conditions.push(`c.organization_id = $${paramIndex}`);
            params.push(query.organizationId);
            paramIndex++;
        }

        if (query.dateFrom) {
            conditions.push(`c.checkout_date >= $${paramIndex}`);
            params.push(query.dateFrom);
            paramIndex++;
        }

        if (query.dateTo) {
            conditions.push(`c.checkout_date <= $${paramIndex}`);
            params.push(query.dateTo);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = {
            checkoutDate: 'c.checkout_date',
            expectedCheckinDate: 'c.expected_checkin_date',
            checkoutCode: 'c.checkout_code',
            assetTag: 'a.asset_code'
        }[query.sortBy ?? 'checkoutDate'];

        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        const countResult = await this.db.query(
            `SELECT COUNT(*) as total
            FROM asset_checkouts c
            LEFT JOIN assets a ON c.asset_id = a.id
            LEFT JOIN users u ON c.target_user_id = u.id
            ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        const dataResult = await this.db.query(
            `SELECT
                c.*,
                a.asset_code,
                COALESCE(a.asset_code, a.serial_no) as asset_name,
                NULL::text as asset_category,
                a.serial_no as asset_serial_number,
                u.name as target_user_name,
                u.email as target_user_email,
                l.name as target_location_name,
                ta.asset_code as target_asset_tag,
                COALESCE(ta.asset_code, ta.serial_no) as target_asset_name,
                cby.name as checked_out_by_name,
                iby.name as checked_in_by_name
            FROM asset_checkouts c
            LEFT JOIN assets a ON c.asset_id = a.id
            LEFT JOIN users u ON c.target_user_id = u.id
            LEFT JOIN locations l ON c.target_location_id = l.id
            LEFT JOIN assets ta ON c.target_asset_id = ta.id
            LEFT JOIN users cby ON c.checked_out_by = cby.id
            LEFT JOIN users iby ON c.checked_in_by = iby.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToCheckoutWithDetails),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // ==================== Extension Operations ====================

    async createExtension(dto: ExtendCheckoutDto, client?: PoolClient): Promise<CheckoutExtension> {
        const conn = (client ?? this.db) as PgClient;

        const checkout = await this.findById(dto.checkoutId);
        if (!checkout) {
            throw new Error('Checkout not found');
        }

        const previousDate = checkout.expectedCheckinDate ?? new Date().toISOString().split('T')[0];

        const result = await conn.query(
            `INSERT INTO checkout_extensions (
                checkout_id, previous_expected_date, new_expected_date,
                extension_reason, extended_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                dto.checkoutId,
                previousDate,
                dto.newExpectedDate,
                dto.extensionReason ?? null,
                dto.extendedBy,
                dto.notes ?? null
            ]
        );

        await conn.query(
            `UPDATE asset_checkouts SET
                expected_checkin_date = $1,
                is_overdue = FALSE
            WHERE id = $2`,
            [dto.newExpectedDate, dto.checkoutId]
        );

        return mapRowToExtension(result.rows[0]);
    }

    async listExtensions(query: ExtensionListQuery): Promise<CheckoutPaginatedResponse<CheckoutExtensionWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.checkoutId) {
            conditions.push(`e.checkout_id = $${paramIndex}`);
            params.push(query.checkoutId);
            paramIndex++;
        }

        if (query.extendedBy) {
            conditions.push(`e.extended_by = $${paramIndex}`);
            params.push(query.extendedBy);
            paramIndex++;
        }

        if (query.dateFrom) {
            conditions.push(`e.extended_at >= $${paramIndex}`);
            params.push(query.dateFrom);
            paramIndex++;
        }

        if (query.dateTo) {
            conditions.push(`e.extended_at <= $${paramIndex}`);
            params.push(query.dateTo);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.db.query(
            `SELECT COUNT(*) as total FROM checkout_extensions e ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        const dataResult = await this.db.query(
            `SELECT
                e.*,
                u.name as extended_by_name,
                c.checkout_code,
                a.asset_code
            FROM checkout_extensions e
            LEFT JOIN asset_checkouts c ON e.checkout_id = c.id
            LEFT JOIN assets a ON c.asset_id = a.id
            LEFT JOIN users u ON e.extended_by = u.id
            ${whereClause}
            ORDER BY e.extended_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToExtensionWithDetails),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
    }

    // ==================== Transfer Operations ====================

    async createTransfer(
        dto: TransferAssetDto,
        client?: PoolClient
    ): Promise<{ transfer: CheckoutTransfer; newCheckout: AssetCheckout }> {
        const conn = (client ?? this.db) as PgClient;

        const originalCheckout = await this.findById(dto.checkoutId);
        if (!originalCheckout) {
            throw new Error('Checkout not found');
        }

        const newCheckoutResult = await conn.query(
            `INSERT INTO asset_checkouts (
                asset_id, checkout_type, target_user_id,
                checkout_date, expected_checkin_date, checked_out_by, checkout_notes,
                organization_id, status
            ) VALUES ($1, 'user', $2, NOW(), $3, $4, $5, $6, 'checked_out')
            RETURNING *`,
            [
                originalCheckout.assetId,
                dto.toUserId,
                dto.newExpectedCheckinDate ?? originalCheckout.expectedCheckinDate,
                dto.transferredBy,
                dto.notes ?? null,
                originalCheckout.organizationId
            ]
        );

        const newCheckout = mapRowToCheckout(newCheckoutResult.rows[0]);

        await conn.query(
            `UPDATE asset_checkouts SET
                checkin_date = NOW(),
                checked_in_by = $2,
                checkin_notes = $3,
                status = 'checked_in'
            WHERE id = $1`,
            [
                dto.checkoutId,
                dto.transferredBy,
                `Transferred to another user: ${dto.transferReason ?? 'No reason provided'}`
            ]
        );

        const transferResult = await conn.query(
            `INSERT INTO checkout_transfers (
                original_checkout_id, new_checkout_id, from_user_id, to_user_id,
                transfer_reason, transferred_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                dto.checkoutId,
                newCheckout.id,
                originalCheckout.targetUserId,
                dto.toUserId,
                dto.transferReason ?? null,
                dto.transferredBy,
                dto.notes ?? null
            ]
        );

        return {
            transfer: mapRowToTransfer(transferResult.rows[0]),
            newCheckout
        };
    }

    async listTransfers(query: TransferListQuery): Promise<CheckoutPaginatedResponse<CheckoutTransferWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.fromUserId) {
            conditions.push(`t.from_user_id = $${paramIndex}`);
            params.push(query.fromUserId);
            paramIndex++;
        }

        if (query.toUserId) {
            conditions.push(`t.to_user_id = $${paramIndex}`);
            params.push(query.toUserId);
            paramIndex++;
        }

        if (query.transferredBy) {
            conditions.push(`t.transferred_by = $${paramIndex}`);
            params.push(query.transferredBy);
            paramIndex++;
        }

        if (query.dateFrom) {
            conditions.push(`t.transferred_at >= $${paramIndex}`);
            params.push(query.dateFrom);
            paramIndex++;
        }

        if (query.dateTo) {
            conditions.push(`t.transferred_at <= $${paramIndex}`);
            params.push(query.dateTo);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.db.query(
            `SELECT COUNT(*) as total FROM checkout_transfers t ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        const dataResult = await this.db.query(
            `SELECT
                t.*,
                fu.name as from_user_name,
                tu.name as to_user_name,
                tby.name as transferred_by_name,
                a.asset_code,
                COALESCE(a.asset_code, a.serial_no) as asset_name
            FROM checkout_transfers t
            LEFT JOIN asset_checkouts oc ON t.original_checkout_id = oc.id
            LEFT JOIN assets a ON oc.asset_id = a.id
            LEFT JOIN users fu ON t.from_user_id = fu.id
            LEFT JOIN users tu ON t.to_user_id = tu.id
            LEFT JOIN users tby ON t.transferred_by = tby.id
            ${whereClause}
            ORDER BY t.transferred_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToTransferWithDetails),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
    }

    // ==================== Overdue Operations ====================

    async getOverdueCheckouts(): Promise<OverdueCheckout[]> {
        const result = await this.db.query(
            `SELECT
                c.id as checkout_id,
                c.checkout_code,
                c.asset_id,
                a.asset_code,
                COALESCE(a.asset_code, a.serial_no) as asset_name,
                c.target_user_id,
                u.name as target_user_name,
                u.email as target_user_email,
                c.expected_checkin_date,
                CURRENT_DATE - c.expected_checkin_date::date as days_overdue,
                c.overdue_notification_count,
                c.overdue_notified_at
            FROM asset_checkouts c
            LEFT JOIN assets a ON c.asset_id = a.id
            LEFT JOIN users u ON c.target_user_id = u.id
            WHERE c.status = 'checked_out'
                AND c.expected_checkin_date IS NOT NULL
                AND c.expected_checkin_date < CURRENT_DATE
            ORDER BY days_overdue DESC`
        );

        return result.rows.map(mapRowToOverdueCheckout);
    }

    async markAsOverdue(checkoutIds: string[]): Promise<number> {
        if (checkoutIds.length === 0) return 0;

        const result = await this.db.query(
            `UPDATE asset_checkouts SET
                is_overdue = TRUE,
                overdue_notified_at = NOW(),
                overdue_notification_count = overdue_notification_count + 1
            WHERE id = ANY($1)
            RETURNING id`,
            [checkoutIds]
        );

        return result.rowCount ?? 0;
    }

    async updateOverdueStatus(): Promise<number> {
        const result = await this.db.query(
            `UPDATE asset_checkouts SET
                is_overdue = TRUE
            WHERE status = 'checked_out'
                AND expected_checkin_date IS NOT NULL
                AND expected_checkin_date < CURRENT_DATE
                AND is_overdue = FALSE
            RETURNING id`
        );

        return result.rowCount ?? 0;
    }

    // ==================== History & Stats ====================

    async getHistory(query: CheckoutHistoryQuery): Promise<CheckoutPaginatedResponse<AssetCheckoutWithDetails>> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.assetId) {
            conditions.push(`c.asset_id = $${paramIndex}`);
            params.push(query.assetId);
            paramIndex++;
        }

        if (query.userId) {
            conditions.push(`c.target_user_id = $${paramIndex}`);
            params.push(query.userId);
            paramIndex++;
        }

        if (query.dateFrom) {
            conditions.push(`c.checkout_date >= $${paramIndex}`);
            params.push(query.dateFrom);
            paramIndex++;
        }

        if (query.dateTo) {
            conditions.push(`c.checkout_date <= $${paramIndex}`);
            params.push(query.dateTo);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sortColumn = query.sortBy === 'checkinDate' ? 'c.checkin_date' : 'c.checkout_date';
        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        const countResult = await this.db.query(
            `SELECT COUNT(*) as total FROM asset_checkouts c ${whereClause}`,
            params
        );

        const total = parseInt(countResult.rows[0].total, 10);

        const dataResult = await this.db.query(
            `SELECT
                c.*,
                a.asset_code,
                COALESCE(a.asset_code, a.serial_no) as asset_name,
                NULL::text as asset_category,
                a.serial_no as asset_serial_number,
                u.name as target_user_name,
                u.email as target_user_email,
                l.name as target_location_name,
                ta.asset_code as target_asset_tag,
                COALESCE(ta.asset_code, ta.serial_no) as target_asset_name,
                cby.name as checked_out_by_name,
                iby.name as checked_in_by_name
            FROM asset_checkouts c
            LEFT JOIN assets a ON c.asset_id = a.id
            LEFT JOIN users u ON c.target_user_id = u.id
            LEFT JOIN locations l ON c.target_location_id = l.id
            LEFT JOIN assets ta ON c.target_asset_id = ta.id
            LEFT JOIN users cby ON c.checked_out_by = cby.id
            LEFT JOIN users iby ON c.checked_in_by = iby.id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit, offset]
        );

        return {
            data: dataResult.rows.map(mapRowToCheckoutWithDetails),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
    }

    async getSummary(organizationId?: string): Promise<CheckoutSummary> {
        const condition = organizationId ? 'AND c.organization_id = $1' : '';
        const params = organizationId ? [organizationId] : [];

        const result = await this.db.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'checked_out') as total_active,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND checkout_type = 'user') as by_user,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND checkout_type = 'location') as by_location,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND checkout_type = 'asset') as by_asset,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND is_overdue = TRUE) as total_overdue,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND expected_checkin_date IS NULL) as indefinite_count,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND expected_checkin_date IS NOT NULL
                    AND expected_checkin_date <= CURRENT_DATE + INTERVAL '3 days'
                    AND expected_checkin_date > CURRENT_DATE) as due_soon_count,
                COUNT(*) FILTER (WHERE status = 'checked_out' AND expected_checkin_date IS NOT NULL
                    AND expected_checkin_date > CURRENT_DATE + INTERVAL '3 days') as on_track_count,
                COALESCE(AVG(EXTRACT(DAY FROM checkin_date - checkout_date))
                    FILTER (WHERE status = 'checked_in' AND checkin_date IS NOT NULL), 0) as avg_days
            FROM asset_checkouts c
            WHERE 1=1 ${condition}`,
            params
        );

        const row = result.rows[0];
        return {
            totalActive: parseInt(row.total_active, 10),
            byType: {
                user: parseInt(row.by_user, 10),
                location: parseInt(row.by_location, 10),
                asset: parseInt(row.by_asset, 10)
            },
            byStatus: {
                onTrack: parseInt(row.on_track_count, 10),
                dueSoon: parseInt(row.due_soon_count, 10),
                overdue: parseInt(row.total_overdue, 10),
                indefinite: parseInt(row.indefinite_count, 10)
            },
            avgCheckoutDays: Math.round(parseFloat(row.avg_days) || 0),
            totalOverdue: parseInt(row.total_overdue, 10)
        };
    }

    // ==================== Audit Log Operations ====================

    async createAuditLog(
        log: Omit<CheckoutAuditLog, 'id' | 'performedAt'>,
        client?: PoolClient
    ): Promise<CheckoutAuditLog> {
        const conn = (client ?? this.db) as PgClient;

        const result = await conn.query(
            `INSERT INTO checkout_audit_logs (
                checkout_id, asset_id, action, action_type,
                old_values, new_values, performed_by,
                ip_address, user_agent, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                log.checkoutId ?? null,
                log.assetId ?? null,
                log.action,
                log.actionType,
                log.oldValues ? JSON.stringify(log.oldValues) : null,
                log.newValues ? JSON.stringify(log.newValues) : null,
                log.performedBy,
                log.ipAddress ?? null,
                log.userAgent ?? null,
                log.notes ?? null
            ]
        );

        return mapRowToAuditLog(result.rows[0]);
    }

    async getAuditLogs(
        checkoutId?: string,
        assetId?: string,
        limit = 50
    ): Promise<CheckoutAuditLog[]> {
        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (checkoutId) {
            conditions.push(`checkout_id = $${paramIndex}`);
            params.push(checkoutId);
            paramIndex++;
        }

        if (assetId) {
            conditions.push(`asset_id = $${paramIndex}`);
            params.push(assetId);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';

        const result = await this.db.query(
            `SELECT * FROM checkout_audit_logs
            ${whereClause}
            ORDER BY performed_at DESC
            LIMIT $${paramIndex}`,
            [...params, limit]
        );

        return result.rows.map(mapRowToAuditLog);
    }

    // ==================== Transaction Support ====================

    async getClient(): Promise<PoolClient> {
        return this.db.getClient();
    }

    async beginTransaction(client: PoolClient): Promise<void> {
        await client.query('BEGIN');
    }

    async commitTransaction(client: PoolClient): Promise<void> {
        await client.query('COMMIT');
    }

    async rollbackTransaction(client: PoolClient): Promise<void> {
        await client.query('ROLLBACK');
    }

    releaseClient(client: PoolClient): void {
        client.release();
    }
}
