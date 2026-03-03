/**
 * Depreciation Module - Repository Layer
 * Module: 09-DEPRECIATION (Asset Depreciation Management)
 */

import { Pool, PoolClient } from 'pg';
import {
    DepreciationSchedule,
    DepreciationScheduleWithDetails,
    DepreciationEntry,
    DepreciationEntryWithDetails,
    DepreciationRun,
    DepreciationSetting,
    CreateScheduleDto,
    UpdateScheduleDto,
    CreateEntryDto,
    ScheduleListQuery,
    EntryListQuery,
    RunListQuery,
    ScheduleStatus,
    RunStatus,
    RunType,
    MonthlySummary,
    DepreciationDashboard,
} from './depreciation.types.js';

// Helper to convert snake_case to camelCase
function toCamelCase<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = row[key];
    }
    return result as T;
}

export class DepreciationRepository {
    constructor(private pool: Pool) { }

    // ==================== Schedule CRUD ====================

    async createSchedule(dto: CreateScheduleDto, client?: PoolClient): Promise<DepreciationSchedule> {
        const conn = client || this.pool;

        // Calculate end date based on useful life
        const result = await conn.query(
            `INSERT INTO depreciation_schedules (
                asset_id, depreciation_method, original_cost, salvage_value,
                useful_life_years, start_date, end_date,
                notes, organization_id, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                calculate_depreciation_end_date($6, $5),
                $7, $8, $9
            )
            RETURNING *`,
            [
                dto.assetId,
                dto.depreciationMethod,
                dto.originalCost,
                dto.salvageValue || 0,
                dto.usefulLifeYears,
                dto.startDate,
                dto.notes || null,
                dto.organizationId || null,
                dto.createdBy,
            ]
        );
        return toCamelCase<DepreciationSchedule>(result.rows[0]);
    }

    async findScheduleById(id: string): Promise<DepreciationSchedule | null> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_schedules WHERE id = $1',
            [id]
        );
        return result.rows[0] ? toCamelCase<DepreciationSchedule>(result.rows[0]) : null;
    }

    async findScheduleByIdWithDetails(id: string): Promise<DepreciationScheduleWithDetails | null> {
        const result = await this.pool.query(
            `SELECT * FROM v_depreciation_schedules WHERE id = $1`,
            [id]
        );
        return result.rows[0] ? toCamelCase<DepreciationScheduleWithDetails>(result.rows[0]) : null;
    }

    async findScheduleByAssetId(assetId: string): Promise<DepreciationSchedule | null> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_schedules WHERE asset_id = $1',
            [assetId]
        );
        return result.rows[0] ? toCamelCase<DepreciationSchedule>(result.rows[0]) : null;
    }

    async updateSchedule(
        id: string,
        dto: UpdateScheduleDto,
        client?: PoolClient
    ): Promise<DepreciationSchedule | null> {
        const conn = client || this.pool;
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (dto.notes !== undefined) {
            fields.push(`notes = $${paramIndex++}`);
            values.push(dto.notes);
        }

        if (fields.length === 0) {
            return this.findScheduleById(id);
        }

        values.push(id);
        const result = await conn.query(
            `UPDATE depreciation_schedules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0] ? toCamelCase<DepreciationSchedule>(result.rows[0]) : null;
    }

    async stopSchedule(
        id: string,
        stoppedAt: string,
        stoppedReason: string | undefined,
        updatedBy: string,
        client?: PoolClient
    ): Promise<DepreciationSchedule | null> {
        const conn = client || this.pool;
        const result = await conn.query(
            `UPDATE depreciation_schedules 
            SET status = 'stopped', stopped_at = $1, stopped_reason = $2, updated_by = $3
            WHERE id = $4 
            RETURNING *`,
            [stoppedAt, stoppedReason || null, updatedBy, id]
        );
        return result.rows[0] ? toCamelCase<DepreciationSchedule>(result.rows[0]) : null;
    }

    async updateScheduleStatus(
        id: string,
        status: ScheduleStatus,
        client?: PoolClient
    ): Promise<DepreciationSchedule | null> {
        const conn = client || this.pool;
        const result = await conn.query(
            `UPDATE depreciation_schedules SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );
        return result.rows[0] ? toCamelCase<DepreciationSchedule>(result.rows[0]) : null;
    }

    async deleteSchedule(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'DELETE FROM depreciation_schedules WHERE id = $1',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async findAllSchedules(
        query: ScheduleListQuery
    ): Promise<{ data: DepreciationScheduleWithDetails[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            status,
            method,
            categoryId,
            endingSoon,
            search,
            sortBy = 'created_at',
            sortOrder = 'desc',
            organizationId,
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (organizationId) {
            conditions.push(`organization_id = $${paramIndex++}`);
            values.push(organizationId);
        }

        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(status);
        }

        if (method) {
            conditions.push(`depreciation_method = $${paramIndex++}`);
            values.push(method);
        }

        if (categoryId) {
            conditions.push(`category_id = $${paramIndex++}`);
            values.push(categoryId);
        }

        if (endingSoon) {
            conditions.push(`end_date <= CURRENT_DATE + INTERVAL '90 days' AND status = 'active'`);
        }

        if (search) {
            conditions.push(`(
                asset_tag ILIKE $${paramIndex} OR
                asset_name ILIKE $${paramIndex}
            )`);
            values.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn: Record<string, string> = {
            asset_name: 'asset_name',
            original_cost: 'original_cost',
            start_date: 'start_date',
            end_date: 'end_date',
            current_book_value: 'current_book_value',
            status: 'status',
            created_at: 'created_at',
        };

        // Count query
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM v_depreciation_schedules ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Data query
        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const dataResult = await this.pool.query(
            `SELECT * FROM v_depreciation_schedules
            ${whereClause}
            ORDER BY ${sortColumn[sortBy] || 'created_at'} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) => toCamelCase<DepreciationScheduleWithDetails>(row)),
            total,
        };
    }

    async countSchedulesByStatus(organizationId?: string): Promise<Record<ScheduleStatus, number>> {
        const result = await this.pool.query(
            `SELECT status, COUNT(*) as count 
            FROM depreciation_schedules 
            ${organizationId ? 'WHERE organization_id = $1' : ''}
            GROUP BY status`,
            organizationId ? [organizationId] : []
        );

        const counts: Record<ScheduleStatus, number> = {
            active: 0,
            fully_depreciated: 0,
            stopped: 0,
        };

        for (const row of result.rows) {
            counts[row.status as ScheduleStatus] = parseInt(row.count, 10);
        }

        return counts;
    }

    // ==================== Entry Operations ====================

    async createEntry(dto: CreateEntryDto, client?: PoolClient): Promise<DepreciationEntry> {
        const conn = client || this.pool;
        const result = await conn.query(
            `INSERT INTO depreciation_entries (
                schedule_id, run_id, period_year, period_month,
                depreciation_amount, beginning_book_value, ending_book_value,
                is_adjustment, adjustment_reason, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                dto.scheduleId,
                dto.runId || null,
                dto.periodYear,
                dto.periodMonth,
                dto.depreciationAmount,
                dto.beginningBookValue,
                dto.endingBookValue,
                dto.isAdjustment || false,
                dto.adjustmentReason || null,
                dto.createdBy,
            ]
        );
        return toCamelCase<DepreciationEntry>(result.rows[0]);
    }

    async createEntries(entries: CreateEntryDto[], client?: PoolClient): Promise<DepreciationEntry[]> {
        const conn = client || this.pool;
        const results: DepreciationEntry[] = [];

        for (const dto of entries) {
            const entry = await this.createEntry(dto, conn as PoolClient);
            results.push(entry);
        }

        return results;
    }

    async findEntryById(id: string): Promise<DepreciationEntry | null> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_entries WHERE id = $1',
            [id]
        );
        return result.rows[0] ? toCamelCase<DepreciationEntry>(result.rows[0]) : null;
    }

    async findEntryByIdWithDetails(id: string): Promise<DepreciationEntryWithDetails | null> {
        const result = await this.pool.query(
            `SELECT 
                e.*,
                s.asset_id,
                a.asset_tag,
                a.name as asset_name,
                r.run_code,
                u.name as posted_by_name
            FROM depreciation_entries e
            JOIN depreciation_schedules s ON e.schedule_id = s.id
            JOIN assets a ON s.asset_id = a.id
            LEFT JOIN depreciation_runs r ON e.run_id = r.id
            LEFT JOIN users u ON e.posted_by = u.id
            WHERE e.id = $1`,
            [id]
        );
        return result.rows[0] ? toCamelCase<DepreciationEntryWithDetails>(result.rows[0]) : null;
    }

    async findEntriesByScheduleId(scheduleId: string): Promise<DepreciationEntry[]> {
        const result = await this.pool.query(
            `SELECT * FROM depreciation_entries 
            WHERE schedule_id = $1 
            ORDER BY period_year DESC, period_month DESC`,
            [scheduleId]
        );
        return result.rows.map((row) => toCamelCase<DepreciationEntry>(row));
    }

    async findEntriesByRunId(runId: string): Promise<DepreciationEntry[]> {
        const result = await this.pool.query(
            `SELECT * FROM depreciation_entries WHERE run_id = $1`,
            [runId]
        );
        return result.rows.map((row) => toCamelCase<DepreciationEntry>(row));
    }

    async findPendingEntries(
        periodYear?: number,
        periodMonth?: number,
        organizationId?: string
    ): Promise<DepreciationEntryWithDetails[]> {
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (periodYear) {
            conditions.push(`period_year = $${paramIndex++}`);
            values.push(periodYear);
        }

        if (periodMonth) {
            conditions.push(`period_month = $${paramIndex++}`);
            values.push(periodMonth);
        }

        if (organizationId) {
            conditions.push(`organization_id = $${paramIndex++}`);
            values.push(organizationId);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const result = await this.pool.query(
            `SELECT * FROM v_pending_depreciation_entries ${whereClause}
            ORDER BY asset_tag, period_year, period_month`,
            values
        );
        return result.rows.map((row) => toCamelCase<DepreciationEntryWithDetails>(row));
    }

    async findLastPostedEntry(scheduleId: string): Promise<DepreciationEntry | null> {
        const result = await this.pool.query(
            `SELECT * FROM depreciation_entries 
            WHERE schedule_id = $1 AND is_posted = TRUE
            ORDER BY period_year DESC, period_month DESC
            LIMIT 1`,
            [scheduleId]
        );
        return result.rows[0] ? toCamelCase<DepreciationEntry>(result.rows[0]) : null;
    }

    async hasUnpostedEntriesBefore(
        scheduleId: string,
        periodYear: number,
        periodMonth: number
    ): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT 1 FROM depreciation_entries 
            WHERE schedule_id = $1 
            AND is_posted = FALSE
            AND (period_year < $2 OR (period_year = $2 AND period_month < $3))
            LIMIT 1`,
            [scheduleId, periodYear, periodMonth]
        );
        return result.rows.length > 0;
    }

    async postEntries(
        entryIds: string[],
        postedBy: string,
        client?: PoolClient
    ): Promise<number> {
        const conn = client || this.pool;
        const result = await conn.query(
            `UPDATE depreciation_entries 
            SET is_posted = TRUE, posted_at = NOW(), posted_by = $1
            WHERE id = ANY($2) AND is_posted = FALSE`,
            [postedBy, entryIds]
        );
        return result.rowCount ?? 0;
    }

    async findAllEntries(
        query: EntryListQuery
    ): Promise<{ data: DepreciationEntryWithDetails[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            scheduleId,
            assetId,
            periodYear,
            periodMonth,
            isPosted,
            sortBy = 'period_year',
            sortOrder = 'desc',
            organizationId,
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (scheduleId) {
            conditions.push(`e.schedule_id = $${paramIndex++}`);
            values.push(scheduleId);
        }

        if (assetId) {
            conditions.push(`s.asset_id = $${paramIndex++}`);
            values.push(assetId);
        }

        if (periodYear) {
            conditions.push(`e.period_year = $${paramIndex++}`);
            values.push(periodYear);
        }

        if (periodMonth) {
            conditions.push(`e.period_month = $${paramIndex++}`);
            values.push(periodMonth);
        }

        if (isPosted !== undefined) {
            conditions.push(`e.is_posted = $${paramIndex++}`);
            values.push(isPosted);
        }

        if (organizationId) {
            conditions.push(`s.organization_id = $${paramIndex++}`);
            values.push(organizationId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count query
        const countResult = await this.pool.query(
            `SELECT COUNT(*) 
            FROM depreciation_entries e
            JOIN depreciation_schedules s ON e.schedule_id = s.id
            ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Data query
        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const sortColumn: Record<string, string> = {
            period_year: 'e.period_year',
            period_month: 'e.period_month',
            depreciation_amount: 'e.depreciation_amount',
            posted_at: 'e.posted_at',
            created_at: 'e.created_at',
        };

        const dataResult = await this.pool.query(
            `SELECT 
                e.*,
                s.asset_id,
                a.asset_tag,
                a.name as asset_name,
                r.run_code,
                u.name as posted_by_name
            FROM depreciation_entries e
            JOIN depreciation_schedules s ON e.schedule_id = s.id
            JOIN assets a ON s.asset_id = a.id
            LEFT JOIN depreciation_runs r ON e.run_id = r.id
            LEFT JOIN users u ON e.posted_by = u.id
            ${whereClause}
            ORDER BY ${sortColumn[sortBy] || 'e.period_year'} ${sortOrder.toUpperCase()}, 
                     e.period_month ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) => toCamelCase<DepreciationEntryWithDetails>(row)),
            total,
        };
    }

    async deleteEntry(id: string): Promise<boolean> {
        const result = await this.pool.query(
            'DELETE FROM depreciation_entries WHERE id = $1 AND is_posted = FALSE',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // ==================== Run Operations ====================

    async createRun(
        runType: RunType,
        periodYear: number,
        periodMonth: number,
        organizationId: string | undefined,
        createdBy: string,
        client?: PoolClient
    ): Promise<DepreciationRun> {
        const conn = client || this.pool;
        const result = await conn.query(
            `INSERT INTO depreciation_runs (
                run_type, period_year, period_month, organization_id, created_by
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [runType, periodYear, periodMonth, organizationId || null, createdBy]
        );
        return toCamelCase<DepreciationRun>(result.rows[0]);
    }

    async findRunById(id: string): Promise<DepreciationRun | null> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_runs WHERE id = $1',
            [id]
        );
        return result.rows[0] ? toCamelCase<DepreciationRun>(result.rows[0]) : null;
    }

    async findRunByCode(code: string): Promise<DepreciationRun | null> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_runs WHERE run_code = $1',
            [code]
        );
        return result.rows[0] ? toCamelCase<DepreciationRun>(result.rows[0]) : null;
    }

    async updateRunStatus(
        id: string,
        status: RunStatus,
        additionalFields?: Partial<{
            totalAssets: number;
            totalAmount: number;
            errorMessage: string;
            completedAt: Date;
        }>,
        client?: PoolClient
    ): Promise<DepreciationRun | null> {
        const conn = client || this.pool;
        const fields: string[] = ['status = $1'];
        const values: unknown[] = [status];
        let paramIndex = 2;

        if (additionalFields) {
            if (additionalFields.totalAssets !== undefined) {
                fields.push(`total_assets = $${paramIndex++}`);
                values.push(additionalFields.totalAssets);
            }
            if (additionalFields.totalAmount !== undefined) {
                fields.push(`total_amount = $${paramIndex++}`);
                values.push(additionalFields.totalAmount);
            }
            if (additionalFields.errorMessage !== undefined) {
                fields.push(`error_message = $${paramIndex++}`);
                values.push(additionalFields.errorMessage);
            }
            if (additionalFields.completedAt !== undefined) {
                fields.push(`completed_at = $${paramIndex++}`);
                values.push(additionalFields.completedAt);
            }
        }

        values.push(id);
        const result = await conn.query(
            `UPDATE depreciation_runs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0] ? toCamelCase<DepreciationRun>(result.rows[0]) : null;
    }

    async findAllRuns(
        query: RunListQuery
    ): Promise<{ data: DepreciationRun[]; total: number }> {
        const {
            page = 1,
            limit = 20,
            periodYear,
            status,
            sortBy = 'created_at',
            sortOrder = 'desc',
            organizationId,
        } = query;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (organizationId) {
            conditions.push(`organization_id = $${paramIndex++}`);
            values.push(organizationId);
        }

        if (periodYear) {
            conditions.push(`period_year = $${paramIndex++}`);
            values.push(periodYear);
        }

        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count query
        const countResult = await this.pool.query(
            `SELECT COUNT(*) FROM depreciation_runs ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Data query
        const offset = (page - 1) * limit;
        values.push(limit, offset);

        const sortColumn: Record<string, string> = {
            run_code: 'run_code',
            period_year: 'period_year',
            status: 'status',
            total_amount: 'total_amount',
            created_at: 'created_at',
        };

        const dataResult = await this.pool.query(
            `SELECT * FROM depreciation_runs
            ${whereClause}
            ORDER BY ${sortColumn[sortBy] || 'created_at'} ${sortOrder.toUpperCase()}
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: dataResult.rows.map((row) => toCamelCase<DepreciationRun>(row)),
            total,
        };
    }

    async hasRunForPeriod(
        periodYear: number,
        periodMonth: number,
        organizationId?: string
    ): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT 1 FROM depreciation_runs 
            WHERE period_year = $1 AND period_month = $2 
            AND status IN ('completed', 'processing')
            ${organizationId ? 'AND organization_id = $3' : ''}
            LIMIT 1`,
            organizationId ? [periodYear, periodMonth, organizationId] : [periodYear, periodMonth]
        );
        return result.rows.length > 0;
    }

    // ==================== Settings Operations ====================

    async findSettingByKey(key: string): Promise<DepreciationSetting | null> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_settings WHERE setting_key = $1',
            [key]
        );
        return result.rows[0] ? toCamelCase<DepreciationSetting>(result.rows[0]) : null;
    }

    async findAllSettings(): Promise<DepreciationSetting[]> {
        const result = await this.pool.query(
            'SELECT * FROM depreciation_settings ORDER BY setting_key'
        );
        return result.rows.map((row) => toCamelCase<DepreciationSetting>(row));
    }

    async updateSetting(
        key: string,
        value: string,
        updatedBy: string
    ): Promise<DepreciationSetting | null> {
        const result = await this.pool.query(
            `UPDATE depreciation_settings 
            SET setting_value = $1, updated_by = $2, updated_at = NOW()
            WHERE setting_key = $3
            RETURNING *`,
            [value, updatedBy, key]
        );
        return result.rows[0] ? toCamelCase<DepreciationSetting>(result.rows[0]) : null;
    }

    // ==================== Statistics / Dashboard ====================

    async getActiveSchedulesForPeriod(
        periodYear: number,
        periodMonth: number,
        organizationId?: string
    ): Promise<DepreciationScheduleWithDetails[]> {
        const periodDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;

        const result = await this.pool.query(
            `SELECT * FROM v_depreciation_schedules
            WHERE status = 'active'
            AND start_date <= $1
            AND end_date >= $1
            ${organizationId ? 'AND organization_id = $2' : ''}`,
            organizationId ? [periodDate, organizationId] : [periodDate]
        );
        return result.rows.map((row) => toCamelCase<DepreciationScheduleWithDetails>(row));
    }

    async getMonthlySummary(
        year: number,
        organizationId?: string
    ): Promise<MonthlySummary[]> {
        const result = await this.pool.query(
            `SELECT * FROM v_monthly_depreciation_summary
            WHERE period_year = $1
            ${organizationId ? 'AND organization_id = $2' : ''}
            ORDER BY period_month`,
            organizationId ? [year, organizationId] : [year]
        );
        return result.rows.map((row) => toCamelCase<MonthlySummary>(row));
    }

    async getDepreciationByCategory(organizationId?: string): Promise<Array<{
        categoryId: string;
        categoryName: string;
        assetCount: number;
        totalOriginalCost: number;
        totalCurrentBookValue: number;
        totalDepreciatedAmount: number;
    }>> {
        const result = await this.pool.query(
            `SELECT * FROM v_depreciation_by_category
            ${organizationId ? 'WHERE organization_id = $1' : ''}
            ORDER BY total_current_book_value DESC`,
            organizationId ? [organizationId] : []
        );
        return result.rows.map((row) => toCamelCase(row));
    }

    async getDashboard(organizationId?: string): Promise<DepreciationDashboard> {
        // Get schedule counts by status
        const scheduleCounts = await this.countSchedulesByStatus(organizationId);

        // Get total values
        const totalsResult = await this.pool.query(
            `SELECT 
                COALESCE(SUM(original_cost), 0) as total_original_cost,
                COALESCE(SUM(accumulated_depreciation), 0) as total_accumulated,
                COALESCE(SUM(original_cost - accumulated_depreciation - salvage_value), 0) as total_book_value
            FROM depreciation_schedules
            WHERE status = 'active'
            ${organizationId ? 'AND organization_id = $1' : ''}`,
            organizationId ? [organizationId] : []
        );

        const totals = totalsResult.rows[0];

        // Get pending entries count
        const pendingResult = await this.pool.query(
            `SELECT COUNT(*) as count 
            FROM depreciation_entries e
            JOIN depreciation_schedules s ON e.schedule_id = s.id
            WHERE e.is_posted = FALSE
            ${organizationId ? 'AND s.organization_id = $1' : ''}`,
            organizationId ? [organizationId] : []
        );

        // Get this month's depreciation
        const now = new Date();
        const thisMonthResult = await this.pool.query(
            `SELECT COALESCE(SUM(depreciation_amount), 0) as amount
            FROM depreciation_entries e
            JOIN depreciation_schedules s ON e.schedule_id = s.id
            WHERE e.period_year = $1 AND e.period_month = $2
            ${organizationId ? 'AND s.organization_id = $3' : ''}`,
            organizationId
                ? [now.getFullYear(), now.getMonth() + 1, organizationId]
                : [now.getFullYear(), now.getMonth() + 1]
        );

        // Get schedules ending soon (next 90 days)
        const endingSoonResult = await this.pool.query(
            `SELECT COUNT(*) as count
            FROM depreciation_schedules
            WHERE status = 'active'
            AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
            ${organizationId ? 'AND organization_id = $1' : ''}`,
            organizationId ? [organizationId] : []
        );

        return {
            activeSchedules: scheduleCounts.active,
            fullyDepreciated: scheduleCounts.fully_depreciated,
            stoppedSchedules: scheduleCounts.stopped,
            totalOriginalCost: parseFloat(totals.total_original_cost),
            totalAccumulatedDepreciation: parseFloat(totals.total_accumulated),
            totalBookValue: parseFloat(totals.total_book_value),
            pendingEntriesCount: parseInt(pendingResult.rows[0].count, 10),
            thisMonthDepreciation: parseFloat(thisMonthResult.rows[0].amount),
            endingSoonCount: parseInt(endingSoonResult.rows[0].count, 10),
        };
    }

    // ==================== Transaction Helper ====================

    async withTransaction<T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> {
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
}
