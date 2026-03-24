/**
 * License Module - Repository Layer
 * @package @qltb/infra-postgres
 */

import type { PgClient } from '../PgClient.js';
import type {
    License,
    LicenseWithUsage,
    LicenseSeat,
    LicenseSeatWithDetails,
    LicenseAuditLog,
    LicenseWithAssetSeat,
    LicenseSupplier,
    LicenseCategory,
    CreateLicenseDto,
    UpdateLicenseDto,
    AssignSeatDto,
    LicenseListQuery,
    LicensePaginatedResult,
} from '@qltb/contracts';

export class LicenseRepo {
    constructor(private readonly db: PgClient) { }

    // ==================== License CRUD ====================

    async create(data: CreateLicenseDto, createdBy: string): Promise<License> {
        const licenseCode = data.licenseCode || await this.generateLicenseCode();

        const query = `
            INSERT INTO licenses (
                license_code, software_name, supplier_id, category_id,
                license_type, product_key, seat_count, unit_price, currency,
                purchase_date, expiry_date, warranty_date, invoice_number,
                notes, organization_id, created_by, updated_by, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, 'draft')
            RETURNING *
        `;

        const values = [
            licenseCode,
            data.softwareName,
            data.supplierId || null,
            data.categoryId || null,
            data.licenseType || 'per_seat',
            data.productKey || null,
            data.seatCount,
            data.unitPrice || 0,
            data.currency || 'VND',
            data.purchaseDate || null,
            data.expiryDate || null,
            data.warrantyDate || null,
            data.invoiceNumber || null,
            data.notes || null,
            data.organizationId || null,
            createdBy,
        ];

        const result = await this.db.query(query, values);
        return this.mapToLicense(result.rows[0]);
    }

    async findById(id: string): Promise<License | null> {
        const result = await this.db.query('SELECT * FROM licenses WHERE id = $1', [id]);
        return result.rows[0] ? this.mapToLicense(result.rows[0]) : null;
    }

    async findByIdWithUsage(id: string): Promise<LicenseWithUsage | null> {
        const query = `
            SELECT
                l.*,
                s.name as supplier_name,
                c.name as category_name,
                COALESCE(seat_count.used, 0) as seats_used
            FROM licenses l
            LEFT JOIN suppliers s ON l.supplier_id = s.id
            LEFT JOIN license_categories c ON l.category_id = c.id
            LEFT JOIN (
                SELECT license_id, COUNT(*) as used
                FROM license_seats
                GROUP BY license_id
            ) seat_count ON l.id = seat_count.license_id
            WHERE l.id = $1
        `;
        const result = await this.db.query(query, [id]);
        if (!result.rows[0]) return null;

        const row = result.rows[0];
        const license = this.mapToLicense(row);
        const seatsUsed = parseInt(row.seats_used) || 0;

        return {
            ...license,
            seatsUsed,
            seatsAvailable: license.seatCount - seatsUsed,
            usagePercentage: license.seatCount > 0
                ? Math.round((seatsUsed / license.seatCount) * 100 * 100) / 100
                : 0,
            supplierName: row.supplier_name,
            categoryName: row.category_name,
        };
    }

    async findByCode(code: string): Promise<License | null> {
        const result = await this.db.query('SELECT * FROM licenses WHERE license_code = $1', [code]);
        return result.rows[0] ? this.mapToLicense(result.rows[0]) : null;
    }

    async list(query: LicenseListQuery): Promise<LicensePaginatedResult<LicenseWithUsage>> {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const offset = (page - 1) * limit;

        const whereConditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.status) {
            const statuses = Array.isArray(query.status) ? query.status : [query.status];
            whereConditions.push(`l.status = ANY($${paramIndex})`);
            params.push(statuses);
            paramIndex++;
        }

        if (query.licenseType) {
            whereConditions.push(`l.license_type = $${paramIndex}`);
            params.push(query.licenseType);
            paramIndex++;
        }

        if (query.supplierId) {
            whereConditions.push(`l.supplier_id = $${paramIndex}`);
            params.push(query.supplierId);
            paramIndex++;
        }

        if (query.categoryId) {
            whereConditions.push(`l.category_id = $${paramIndex}`);
            params.push(query.categoryId);
            paramIndex++;
        }

        if (query.search) {
            whereConditions.push(`(l.software_name ILIKE $${paramIndex} OR l.license_code ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        if (query.expiringInDays) {
            whereConditions.push(`l.expiry_date <= CURRENT_DATE + INTERVAL '${query.expiringInDays} days' AND l.expiry_date >= CURRENT_DATE`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const sortColumn = this.getSortColumn(query.sortBy || 'createdAt');
        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM licenses l ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...params, limit, offset];
        const dataQuery = `
            SELECT
                l.*,
                s.name as supplier_name,
                c.name as category_name,
                COALESCE(seat_count.used, 0) as seats_used
            FROM licenses l
            LEFT JOIN suppliers s ON l.supplier_id = s.id
            LEFT JOIN license_categories c ON l.category_id = c.id
            LEFT JOIN (
                SELECT license_id, COUNT(*) as used
                FROM license_seats
                GROUP BY license_id
            ) seat_count ON l.id = seat_count.license_id
            ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const dataResult = await this.db.query(dataQuery, dataParams);

        let data = dataResult.rows.map(row => {
            const license = this.mapToLicense(row);
            const seatsUsed = parseInt(row.seats_used) || 0;
            return {
                ...license,
                seatsUsed,
                seatsAvailable: license.seatCount - seatsUsed,
                usagePercentage: license.seatCount > 0
                    ? Math.round((seatsUsed / license.seatCount) * 100 * 100) / 100
                    : 0,
                supplierName: row.supplier_name,
                categoryName: row.category_name,
            };
        });

        if (query.overSeats) {
            data = data.filter(l => l.seatsUsed > l.seatCount);
        }

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async update(id: string, data: UpdateLicenseDto, updatedBy: string): Promise<License | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        const fieldMap: Record<string, string> = {
            softwareName: 'software_name',
            supplierId: 'supplier_id',
            categoryId: 'category_id',
            licenseType: 'license_type',
            productKey: 'product_key',
            seatCount: 'seat_count',
            unitPrice: 'unit_price',
            currency: 'currency',
            purchaseDate: 'purchase_date',
            expiryDate: 'expiry_date',
            warrantyDate: 'warranty_date',
            invoiceNumber: 'invoice_number',
            notes: 'notes',
            status: 'status',
        };

        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (key in data && data[key as keyof UpdateLicenseDto] !== undefined) {
                fields.push(`${dbField} = $${paramIndex}`);
                values.push(data[key as keyof UpdateLicenseDto]);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        fields.push(`updated_by = $${paramIndex}`, `updated_at = NOW()`);
        values.push(updatedBy, id);

        const query = `
            UPDATE licenses
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex + 1}
            RETURNING *
        `;

        const result = await this.db.query(query, values);
        return result.rows[0] ? this.mapToLicense(result.rows[0]) : null;
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db.query('DELETE FROM licenses WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }

    async activate(id: string, updatedBy: string): Promise<License | null> {
        return this.update(id, { status: 'active' }, updatedBy);
    }

    async retire(id: string, updatedBy: string): Promise<License | null> {
        const seatsCount = await this.countSeats(id);
        if (seatsCount > 0) {
            throw new Error('Cannot retire license with assigned seats. Revoke all seats first.');
        }
        return this.update(id, { status: 'retired' }, updatedBy);
    }

    // ==================== License Seats ====================

    async countSeats(licenseId: string): Promise<number> {
        const result = await this.db.query(
            'SELECT COUNT(*) FROM license_seats WHERE license_id = $1',
            [licenseId]
        );
        return parseInt(result.rows[0].count);
    }

    async assignSeat(licenseId: string, data: AssignSeatDto, assignedBy: string): Promise<LicenseSeat> {
        const query = `
            INSERT INTO license_seats (
                license_id, assignment_type, assigned_user_id, assigned_asset_id,
                assigned_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const values = [
            licenseId,
            data.assignmentType,
            data.assignedUserId || null,
            data.assignedAssetId || null,
            assignedBy,
            data.notes || null,
        ];

        const result = await this.db.query(query, values);
        return this.mapToSeat(result.rows[0]);
    }

    async revokeSeat(seatId: string): Promise<boolean> {
        const result = await this.db.query('DELETE FROM license_seats WHERE id = $1', [seatId]);
        return (result.rowCount ?? 0) > 0;
    }

    async getSeat(seatId: string): Promise<LicenseSeat | null> {
        const result = await this.db.query('SELECT * FROM license_seats WHERE id = $1', [seatId]);
        return result.rows[0] ? this.mapToSeat(result.rows[0]) : null;
    }

    async getSeats(licenseId: string): Promise<LicenseSeatWithDetails[]> {
        const query = `
            SELECT
                ls.*,
                u.full_name as user_name,
                u.email as user_email,
                a.asset_code,
                CONCAT(am.brand, ' ', am.model) as asset_name
            FROM license_seats ls
            LEFT JOIN users u ON ls.assigned_user_id = u.id
            LEFT JOIN assets a ON ls.assigned_asset_id = a.id
            LEFT JOIN asset_models am ON a.model_id = am.id
            WHERE ls.license_id = $1
            ORDER BY ls.assigned_at DESC
        `;
        const result = await this.db.query(query, [licenseId]);
        return result.rows.map(row => ({
            ...this.mapToSeat(row),
            userName: row.user_name,
            userEmail: row.user_email,
            assetCode: row.asset_code,
            assetName: row.asset_name,
        }));
    }

    async checkUserSeatExists(licenseId: string, userId: string): Promise<boolean> {
        const result = await this.db.query(
            'SELECT 1 FROM license_seats WHERE license_id = $1 AND assigned_user_id = $2',
            [licenseId, userId]
        );
        return result.rows.length > 0;
    }

    async checkAssetSeatExists(licenseId: string, assetId: string): Promise<boolean> {
        const result = await this.db.query(
            'SELECT 1 FROM license_seats WHERE license_id = $1 AND assigned_asset_id = $2',
            [licenseId, assetId]
        );
        return result.rows.length > 0;
    }

    async findByAssetId(assetId: string): Promise<LicenseWithAssetSeat[]> {
        const query = `
            SELECT
                l.id AS license_id,
                l.license_code,
                l.software_name,
                l.license_type,
                l.status,
                l.expiry_date,
                ls.id AS seat_id,
                ls.assigned_at,
                ls.assigned_by,
                ls.notes
            FROM license_seats ls
            JOIN licenses l ON ls.license_id = l.id
            WHERE ls.assigned_asset_id = $1
            ORDER BY ls.assigned_at DESC
        `;
        const result = await this.db.query(query, [assetId]);
        return result.rows.map(row => ({
            licenseId: row.license_id,
            licenseCode: row.license_code,
            softwareName: row.software_name,
            licenseType: row.license_type,
            status: row.status,
            expiryDate: row.expiry_date ?? undefined,
            seatId: row.seat_id,
            assignedAt: row.assigned_at,
            assignedBy: row.assigned_by,
            notes: row.notes ?? undefined,
        }));
    }

    // ==================== Audit Log ====================

    async logAudit(
        licenseId: string,
        action: string,
        actorUserId: string,
        oldValues?: Record<string, unknown>,
        newValues?: Record<string, unknown>,
        notes?: string
    ): Promise<void> {
        await this.db.query(
            `INSERT INTO license_audit_logs (
                license_id, action, actor_user_id, old_values, new_values, notes
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                licenseId,
                action,
                actorUserId,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                notes || null,
            ]
        );
    }

    async getAuditLogs(licenseId: string): Promise<LicenseAuditLog[]> {
        const result = await this.db.query(
            `SELECT * FROM license_audit_logs
            WHERE license_id = $1
            ORDER BY created_at DESC`,
            [licenseId]
        );
        return result.rows.map(row => ({
            id: row.id,
            licenseId: row.license_id,
            action: row.action,
            actorUserId: row.actor_user_id,
            oldValues: row.old_values,
            newValues: row.new_values,
            notes: row.notes,
            createdAt: row.created_at,
        }));
    }

    // ==================== Suppliers ====================

    async createSupplier(data: Partial<LicenseSupplier>): Promise<LicenseSupplier> {
        const query = `
            INSERT INTO suppliers (code, name, contact_name, contact_email, contact_phone, address, website, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const values = [
            data.code,
            data.name,
            data.contactName || null,
            data.contactEmail || null,
            data.contactPhone || null,
            data.address || null,
            data.website || null,
            data.notes || null,
        ];
        const result = await this.db.query(query, values);
        return this.mapToSupplier(result.rows[0]);
    }

    async getSuppliers(): Promise<LicenseSupplier[]> {
        const result = await this.db.query('SELECT * FROM suppliers WHERE is_active = true ORDER BY name');
        return result.rows.map(row => this.mapToSupplier(row));
    }

    async getSupplierById(id: string): Promise<LicenseSupplier | null> {
        const result = await this.db.query('SELECT * FROM suppliers WHERE id = $1', [id]);
        return result.rows[0] ? this.mapToSupplier(result.rows[0]) : null;
    }

    // ==================== Categories ====================

    async getCategories(): Promise<LicenseCategory[]> {
        const result = await this.db.query('SELECT * FROM license_categories ORDER BY name');
        return result.rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.created_at,
        }));
    }

    // ==================== Helpers ====================

    private async generateLicenseCode(): Promise<string> {
        const date = new Date();
        const prefix = `LIC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

        const result = await this.db.query(
            `SELECT license_code FROM licenses
            WHERE license_code LIKE $1
            ORDER BY license_code DESC
            LIMIT 1`,
            [`${prefix}%`]
        );

        let sequence = 1;
        if (result.rows[0]) {
            const lastCode = result.rows[0].license_code;
            const lastSeq = parseInt(lastCode.split('-').pop() || '0');
            sequence = lastSeq + 1;
        }

        return `${prefix}-${String(sequence).padStart(4, '0')}`;
    }

    private getSortColumn(sortBy: string): string {
        const map: Record<string, string> = {
            softwareName: 'l.software_name',
            licenseCode: 'l.license_code',
            expiryDate: 'l.expiry_date',
            seatCount: 'l.seat_count',
            createdAt: 'l.created_at',
        };
        return map[sortBy] || 'l.created_at';
    }

    private mapToLicense(row: Record<string, unknown>): License {
        return {
            id: row.id as string,
            licenseCode: row.license_code as string,
            softwareName: row.software_name as string,
            supplierId: row.supplier_id as string | undefined,
            categoryId: row.category_id as string | undefined,
            licenseType: row.license_type as License['licenseType'],
            productKey: row.product_key as string | undefined,
            seatCount: parseInt(row.seat_count as string),
            unitPrice: parseFloat((row.unit_price as string) || '0'),
            currency: row.currency as string,
            purchaseDate: row.purchase_date as Date | undefined,
            expiryDate: row.expiry_date as Date | undefined,
            warrantyDate: row.warranty_date as Date | undefined,
            invoiceNumber: row.invoice_number as string | undefined,
            notes: row.notes as string | undefined,
            status: row.status as License['status'],
            organizationId: row.organization_id as string | undefined,
            createdBy: row.created_by as string | undefined,
            updatedBy: row.updated_by as string | undefined,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        };
    }

    private mapToSeat(row: Record<string, unknown>): LicenseSeat {
        return {
            id: row.id as string,
            licenseId: row.license_id as string,
            assignmentType: row.assignment_type as LicenseSeat['assignmentType'],
            assignedUserId: row.assigned_user_id as string | undefined,
            assignedAssetId: row.assigned_asset_id as string | undefined,
            assignedAt: row.assigned_at as Date,
            assignedBy: row.assigned_by as string,
            notes: row.notes as string | undefined,
            createdAt: row.created_at as Date,
        };
    }

    private mapToSupplier(row: Record<string, unknown>): LicenseSupplier {
        return {
            id: row.id as string,
            code: row.code as string,
            name: row.name as string,
            contactName: row.contact_name as string | undefined,
            contactEmail: row.contact_email as string | undefined,
            contactPhone: row.contact_phone as string | undefined,
            address: row.address as string | undefined,
            website: row.website as string | undefined,
            notes: row.notes as string | undefined,
            isActive: row.is_active as boolean,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        };
    }
}
