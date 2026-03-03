// =============================================
// Module: Reports & Alerts (10-REPORTS)
// Repository Layer - Data Access
// =============================================

import { Pool, PoolClient } from 'pg';
import {
    ReportDefinition,
    ReportDefinitionWithStats,
    ReportExecution,
    AlertRule,
    AlertRuleWithStats,
    AlertHistory,
    AlertHistoryWithRule,
    UserAlertPreferences,
    DashboardWidget,
    UserDashboardLayout,
    CreateReportDefinitionDto,
    UpdateReportDefinitionDto,
    CreateReportExecutionDto,
    UpdateReportExecutionDto,
    CreateAlertRuleDto,
    UpdateAlertRuleDto,
    CreateAlertHistoryDto,
    AcknowledgeAlertDto,
    UpdateUserAlertPreferencesDto,
    CreateDashboardWidgetDto,
    UpdateDashboardWidgetDto,
    SaveDashboardLayoutDto,
    ReportDefinitionQuery,
    ReportExecutionQuery,
    AlertRuleQuery,
    AlertHistoryQuery,
    DashboardWidgetQuery,
    PaginatedResult,
} from './reports.types.js';

// ==================== HELPER FUNCTIONS ====================

function mapReportDefinitionRow(row: Record<string, unknown>): ReportDefinition {
    return {
        id: row.id as string,
        reportCode: row.report_code as string,
        name: row.name as string,
        description: row.description as string | null,
        reportType: row.report_type as ReportDefinition['reportType'],
        dataSource: row.data_source as string,
        fields: row.fields as string[],
        filters: row.filters as ReportDefinition['filters'],
        defaultFilters: row.default_filters as Record<string, unknown>,
        grouping: row.grouping as string[],
        sorting: row.sorting as ReportDefinition['sorting'],
        chartConfig: row.chart_config as Record<string, unknown>,
        accessLevel: row.access_level as ReportDefinition['accessLevel'],
        allowedRoles: row.allowed_roles as string[],
        isScheduled: row.is_scheduled as boolean,
        scheduleCron: row.schedule_cron as string | null,
        scheduleRecipients: row.schedule_recipients as string[],
        scheduleFormat: row.schedule_format as ReportDefinition['scheduleFormat'],
        lastRunAt: row.last_run_at ? new Date(row.last_run_at as string) : null,
        nextRunAt: row.next_run_at ? new Date(row.next_run_at as string) : null,
        isBuiltin: row.is_builtin as boolean,
        isActive: row.is_active as boolean,
        isFavorite: row.is_favorite as boolean,
        viewCount: row.view_count as number,
        organizationId: row.organization_id as string | null,
        createdBy: row.created_by as string | null,
        updatedBy: row.updated_by as string | null,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
    };
}

function mapReportDefinitionWithStatsRow(row: Record<string, unknown>): ReportDefinitionWithStats {
    return {
        ...mapReportDefinitionRow(row),
        executionCount: row.execution_count as number | undefined,
        successCount: row.success_count as number | undefined,
        lastSuccessAt: row.last_success_at ? new Date(row.last_success_at as string) : null,
        createdByName: row.created_by_name as string | undefined,
    };
}

function mapReportExecutionRow(row: Record<string, unknown>): ReportExecution {
    return {
        id: row.id as string,
        reportId: row.report_id as string,
        executionType: row.execution_type as ReportExecution['executionType'],
        status: row.status as ReportExecution['status'],
        filtersUsed: row.filters_used as Record<string, unknown>,
        rowCount: row.row_count as number | null,
        filePath: row.file_path as string | null,
        fileFormat: row.file_format as ReportExecution['fileFormat'],
        fileSizeBytes: row.file_size_bytes as number | null,
        startedAt: row.started_at ? new Date(row.started_at as string) : null,
        completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
        durationMs: row.duration_ms as number | null,
        errorMessage: row.error_message as string | null,
        recipients: row.recipients as string[],
        deliveryStatus: row.delivery_status as ReportExecution['deliveryStatus'],
        deliveryError: row.delivery_error as string | null,
        executedBy: row.executed_by as string | null,
        createdAt: new Date(row.created_at as string),
    };
}

function mapAlertRuleRow(row: Record<string, unknown>): AlertRule {
    return {
        id: row.id as string,
        ruleCode: row.rule_code as string,
        name: row.name as string,
        description: row.description as string | null,
        ruleType: row.rule_type as AlertRule['ruleType'],
        conditionField: row.condition_field as string,
        conditionOperator: row.condition_operator as AlertRule['conditionOperator'],
        conditionValue: row.condition_value as Record<string, unknown>,
        conditionQuery: row.condition_query as string | null,
        severity: row.severity as AlertRule['severity'],
        channel: row.channel as AlertRule['channel'],
        frequency: row.frequency as AlertRule['frequency'],
        cooldownHours: row.cooldown_hours as number,
        recipients: row.recipients as string[],
        recipientRoles: row.recipient_roles as string[],
        isBuiltin: row.is_builtin as boolean,
        isActive: row.is_active as boolean,
        lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at as string) : null,
        triggerCount: row.trigger_count as number,
        organizationId: row.organization_id as string | null,
        createdBy: row.created_by as string | null,
        updatedBy: row.updated_by as string | null,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
    };
}

function mapAlertRuleWithStatsRow(row: Record<string, unknown>): AlertRuleWithStats {
    return {
        ...mapAlertRuleRow(row),
        totalTriggers: row.total_triggers as number | undefined,
        triggersLast30Days: row.triggers_last_30_days as number | undefined,
        unacknowledgedCount: row.unacknowledged_count as number | undefined,
        createdByName: row.created_by_name as string | undefined,
    };
}

function mapAlertHistoryRow(row: Record<string, unknown>): AlertHistory {
    return {
        id: row.id as string,
        ruleId: row.rule_id as string,
        triggeredAt: new Date(row.triggered_at as string),
        triggerData: row.trigger_data as Record<string, unknown>,
        affectedCount: row.affected_count as number,
        title: row.title as string,
        message: row.message as string,
        severity: row.severity as AlertHistory['severity'],
        recipientsNotified: row.recipients_notified as string[],
        channelUsed: row.channel_used as AlertHistory['channelUsed'],
        deliveryStatus: row.delivery_status as AlertHistory['deliveryStatus'],
        deliveryError: row.delivery_error as string | null,
        isAcknowledged: row.is_acknowledged as boolean,
        acknowledgedBy: row.acknowledged_by as string | null,
        acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : null,
        acknowledgmentNote: row.acknowledgment_note as string | null,
        organizationId: row.organization_id as string | null,
        createdAt: new Date(row.created_at as string),
    };
}

function mapAlertHistoryWithRuleRow(row: Record<string, unknown>): AlertHistoryWithRule {
    return {
        ...mapAlertHistoryRow(row),
        ruleName: row.rule_name as string | undefined,
        ruleType: row.rule_type as AlertHistoryWithRule['ruleType'],
        ruleSeverity: row.rule_severity as AlertHistoryWithRule['ruleSeverity'],
    };
}

function mapUserAlertPreferencesRow(row: Record<string, unknown>): UserAlertPreferences {
    return {
        id: row.id as string,
        userId: row.user_id as string,
        emailEnabled: row.email_enabled as boolean,
        inAppEnabled: row.in_app_enabled as boolean,
        digestFrequency: row.digest_frequency as UserAlertPreferences['digestFrequency'],
        digestTime: row.digest_time as string,
        digestDay: row.digest_day as number,
        emailMinSeverity: row.email_min_severity as UserAlertPreferences['emailMinSeverity'],
        mutedRules: row.muted_rules as string[],
        updatedAt: new Date(row.updated_at as string),
    };
}

function mapDashboardWidgetRow(row: Record<string, unknown>): DashboardWidget {
    return {
        id: row.id as string,
        widgetCode: row.widget_code as string,
        name: row.name as string,
        description: row.description as string | null,
        widgetType: row.widget_type as DashboardWidget['widgetType'],
        dataSource: row.data_source as string,
        dataQuery: row.data_query as string | null,
        dataConfig: row.data_config as Record<string, unknown>,
        defaultSize: row.default_size as DashboardWidget['defaultSize'],
        minWidth: row.min_width as number,
        minHeight: row.min_height as number,
        refreshInterval: row.refresh_interval as number,
        isBuiltin: row.is_builtin as boolean,
        isActive: row.is_active as boolean,
        organizationId: row.organization_id as string | null,
        createdBy: row.created_by as string | null,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
    };
}

function mapUserDashboardLayoutRow(row: Record<string, unknown>): UserDashboardLayout {
    return {
        id: row.id as string,
        userId: row.user_id as string,
        dashboardType: row.dashboard_type as string,
        layout: row.layout as UserDashboardLayout['layout'],
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
    };
}

// ==================== REPOSITORY CLASS ====================

export class ReportsRepository {
    constructor(private pool: Pool) { }

    // ==================== REPORT DEFINITIONS ====================

    async findAllReportDefinitions(query: ReportDefinitionQuery): Promise<PaginatedResult<ReportDefinitionWithStats>> {
        const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.reportType) {
            conditions.push(`r.report_type = $${paramIndex++}`);
            params.push(query.reportType);
        }
        if (query.dataSource) {
            conditions.push(`r.data_source = $${paramIndex++}`);
            params.push(query.dataSource);
        }
        if (query.accessLevel) {
            conditions.push(`r.access_level = $${paramIndex++}`);
            params.push(query.accessLevel);
        }
        if (query.isScheduled !== undefined) {
            conditions.push(`r.is_scheduled = $${paramIndex++}`);
            params.push(query.isScheduled);
        }
        if (query.isBuiltin !== undefined) {
            conditions.push(`r.is_builtin = $${paramIndex++}`);
            params.push(query.isBuiltin);
        }
        if (query.isActive !== undefined) {
            conditions.push(`r.is_active = $${paramIndex++}`);
            params.push(query.isActive);
        }
        if (query.isFavorite !== undefined) {
            conditions.push(`r.is_favorite = $${paramIndex++}`);
            params.push(query.isFavorite);
        }
        if (query.organizationId) {
            conditions.push(`r.organization_id = $${paramIndex++}`);
            params.push(query.organizationId);
        }
        if (query.createdBy) {
            conditions.push(`r.created_by = $${paramIndex++}`);
            params.push(query.createdBy);
        }
        if (query.search) {
            conditions.push(`(r.name ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex} OR r.report_code ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSorts = ['name', 'report_code', 'report_type', 'created_at', 'updated_at', 'view_count'];
        const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'name';
        const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

        const countQuery = `SELECT COUNT(*) FROM report_definitions r ${whereClause}`;
        const countResult = await this.pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const dataQuery = `
      SELECT r.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id) as execution_count,
             (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id AND status = 'completed') as success_count,
             (SELECT MAX(completed_at) FROM report_executions WHERE report_id = r.id AND status = 'completed') as last_success_at
      FROM report_definitions r
      LEFT JOIN users u ON r.created_by = u.id
      ${whereClause}
      ORDER BY r.${safeSort} ${safeOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
        params.push(limit, offset);

        const result = await this.pool.query(dataQuery, params);

        return {
            data: result.rows.map(mapReportDefinitionWithStatsRow),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findReportDefinitionById(id: string): Promise<ReportDefinitionWithStats | null> {
        const query = `
      SELECT r.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id) as execution_count,
             (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id AND status = 'completed') as success_count,
             (SELECT MAX(completed_at) FROM report_executions WHERE report_id = r.id AND status = 'completed') as last_success_at
      FROM report_definitions r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1
    `;
        const result = await this.pool.query(query, [id]);
        return result.rows.length > 0 ? mapReportDefinitionWithStatsRow(result.rows[0]) : null;
    }

    async findReportDefinitionByCode(code: string): Promise<ReportDefinitionWithStats | null> {
        const query = `
      SELECT r.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id) as execution_count,
             (SELECT COUNT(*) FROM report_executions WHERE report_id = r.id AND status = 'completed') as success_count,
             (SELECT MAX(completed_at) FROM report_executions WHERE report_id = r.id AND status = 'completed') as last_success_at
      FROM report_definitions r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.report_code = $1
    `;
        const result = await this.pool.query(query, [code]);
        return result.rows.length > 0 ? mapReportDefinitionWithStatsRow(result.rows[0]) : null;
    }

    async createReportDefinition(dto: CreateReportDefinitionDto, client?: PoolClient): Promise<ReportDefinition> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO report_definitions (
        report_code, name, description, report_type, data_source, fields, filters,
        default_filters, grouping, sorting, chart_config, access_level, allowed_roles,
        is_scheduled, schedule_cron, schedule_recipients, schedule_format,
        organization_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;
        const params = [
            dto.reportCode || null,
            dto.name,
            dto.description || null,
            dto.reportType,
            dto.dataSource,
            JSON.stringify(dto.fields),
            JSON.stringify(dto.filters || []),
            JSON.stringify(dto.defaultFilters || {}),
            JSON.stringify(dto.grouping || []),
            JSON.stringify(dto.sorting || []),
            JSON.stringify(dto.chartConfig || {}),
            dto.accessLevel || 'all',
            JSON.stringify(dto.allowedRoles || []),
            dto.isScheduled || false,
            dto.scheduleCron || null,
            JSON.stringify(dto.scheduleRecipients || []),
            dto.scheduleFormat || 'excel',
            dto.organizationId || null,
            dto.createdBy || null,
        ];
        const result = await executor.query(query, params);
        return mapReportDefinitionRow(result.rows[0]);
    }

    async updateReportDefinition(id: string, dto: UpdateReportDefinitionDto, client?: PoolClient): Promise<ReportDefinition | null> {
        const executor = client || this.pool;
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(dto.name);
        }
        if (dto.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(dto.description);
        }
        if (dto.fields !== undefined) {
            updates.push(`fields = $${paramIndex++}`);
            params.push(JSON.stringify(dto.fields));
        }
        if (dto.filters !== undefined) {
            updates.push(`filters = $${paramIndex++}`);
            params.push(JSON.stringify(dto.filters));
        }
        if (dto.defaultFilters !== undefined) {
            updates.push(`default_filters = $${paramIndex++}`);
            params.push(JSON.stringify(dto.defaultFilters));
        }
        if (dto.grouping !== undefined) {
            updates.push(`grouping = $${paramIndex++}`);
            params.push(JSON.stringify(dto.grouping));
        }
        if (dto.sorting !== undefined) {
            updates.push(`sorting = $${paramIndex++}`);
            params.push(JSON.stringify(dto.sorting));
        }
        if (dto.chartConfig !== undefined) {
            updates.push(`chart_config = $${paramIndex++}`);
            params.push(JSON.stringify(dto.chartConfig));
        }
        if (dto.accessLevel !== undefined) {
            updates.push(`access_level = $${paramIndex++}`);
            params.push(dto.accessLevel);
        }
        if (dto.allowedRoles !== undefined) {
            updates.push(`allowed_roles = $${paramIndex++}`);
            params.push(JSON.stringify(dto.allowedRoles));
        }
        if (dto.isScheduled !== undefined) {
            updates.push(`is_scheduled = $${paramIndex++}`);
            params.push(dto.isScheduled);
        }
        if (dto.scheduleCron !== undefined) {
            updates.push(`schedule_cron = $${paramIndex++}`);
            params.push(dto.scheduleCron);
        }
        if (dto.scheduleRecipients !== undefined) {
            updates.push(`schedule_recipients = $${paramIndex++}`);
            params.push(JSON.stringify(dto.scheduleRecipients));
        }
        if (dto.scheduleFormat !== undefined) {
            updates.push(`schedule_format = $${paramIndex++}`);
            params.push(dto.scheduleFormat);
        }
        if (dto.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(dto.isActive);
        }
        if (dto.isFavorite !== undefined) {
            updates.push(`is_favorite = $${paramIndex++}`);
            params.push(dto.isFavorite);
        }
        if (dto.updatedBy !== undefined) {
            updates.push(`updated_by = $${paramIndex++}`);
            params.push(dto.updatedBy);
        }

        if (updates.length === 0) {
            return this.findReportDefinitionById(id);
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `UPDATE report_definitions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await executor.query(query, params);
        return result.rows.length > 0 ? mapReportDefinitionRow(result.rows[0]) : null;
    }

    async deleteReportDefinition(id: string, client?: PoolClient): Promise<boolean> {
        const executor = client || this.pool;
        const result = await executor.query('DELETE FROM report_definitions WHERE id = $1 AND is_builtin = FALSE', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    async incrementViewCount(id: string): Promise<void> {
        await this.pool.query('UPDATE report_definitions SET view_count = view_count + 1 WHERE id = $1', [id]);
    }

    // ==================== REPORT EXECUTIONS ====================

    async findAllReportExecutions(query: ReportExecutionQuery): Promise<PaginatedResult<ReportExecution>> {
        const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.reportId) {
            conditions.push(`report_id = $${paramIndex++}`);
            params.push(query.reportId);
        }
        if (query.executionType) {
            conditions.push(`execution_type = $${paramIndex++}`);
            params.push(query.executionType);
        }
        if (query.status) {
            conditions.push(`status = $${paramIndex++}`);
            params.push(query.status);
        }
        if (query.executedBy) {
            conditions.push(`executed_by = $${paramIndex++}`);
            params.push(query.executedBy);
        }
        if (query.startDate) {
            conditions.push(`started_at >= $${paramIndex++}`);
            params.push(query.startDate);
        }
        if (query.endDate) {
            conditions.push(`started_at <= $${paramIndex++}`);
            params.push(query.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSorts = ['created_at', 'started_at', 'completed_at', 'status', 'row_count'];
        const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
        const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

        const countQuery = `SELECT COUNT(*) FROM report_executions ${whereClause}`;
        const countResult = await this.pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const dataQuery = `
      SELECT * FROM report_executions
      ${whereClause}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
        params.push(limit, offset);

        const result = await this.pool.query(dataQuery, params);

        return {
            data: result.rows.map(mapReportExecutionRow),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findReportExecutionById(id: string): Promise<ReportExecution | null> {
        const result = await this.pool.query('SELECT * FROM report_executions WHERE id = $1', [id]);
        return result.rows.length > 0 ? mapReportExecutionRow(result.rows[0]) : null;
    }

    async createReportExecution(dto: CreateReportExecutionDto, client?: PoolClient): Promise<ReportExecution> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO report_executions (report_id, execution_type, filters_used, executed_by, started_at, status)
      VALUES ($1, $2, $3, $4, NOW(), 'running')
      RETURNING *
    `;
        const params = [
            dto.reportId,
            dto.executionType || 'manual',
            JSON.stringify(dto.filtersUsed || {}),
            dto.executedBy || null,
        ];
        const result = await executor.query(query, params);
        return mapReportExecutionRow(result.rows[0]);
    }

    async updateReportExecution(id: string, dto: UpdateReportExecutionDto, client?: PoolClient): Promise<ReportExecution | null> {
        const executor = client || this.pool;
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(dto.status);
        }
        if (dto.rowCount !== undefined) {
            updates.push(`row_count = $${paramIndex++}`);
            params.push(dto.rowCount);
        }
        if (dto.filePath !== undefined) {
            updates.push(`file_path = $${paramIndex++}`);
            params.push(dto.filePath);
        }
        if (dto.fileFormat !== undefined) {
            updates.push(`file_format = $${paramIndex++}`);
            params.push(dto.fileFormat);
        }
        if (dto.fileSizeBytes !== undefined) {
            updates.push(`file_size_bytes = $${paramIndex++}`);
            params.push(dto.fileSizeBytes);
        }
        if (dto.completedAt !== undefined) {
            updates.push(`completed_at = $${paramIndex++}`);
            params.push(dto.completedAt);
        }
        if (dto.durationMs !== undefined) {
            updates.push(`duration_ms = $${paramIndex++}`);
            params.push(dto.durationMs);
        }
        if (dto.errorMessage !== undefined) {
            updates.push(`error_message = $${paramIndex++}`);
            params.push(dto.errorMessage);
        }
        if (dto.deliveryStatus !== undefined) {
            updates.push(`delivery_status = $${paramIndex++}`);
            params.push(dto.deliveryStatus);
        }
        if (dto.deliveryError !== undefined) {
            updates.push(`delivery_error = $${paramIndex++}`);
            params.push(dto.deliveryError);
        }

        if (updates.length === 0) {
            return this.findReportExecutionById(id);
        }

        params.push(id);
        const query = `UPDATE report_executions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await executor.query(query, params);
        return result.rows.length > 0 ? mapReportExecutionRow(result.rows[0]) : null;
    }

    // ==================== ALERT RULES ====================

    async findAllAlertRules(query: AlertRuleQuery): Promise<PaginatedResult<AlertRuleWithStats>> {
        const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.ruleType) {
            conditions.push(`a.rule_type = $${paramIndex++}`);
            params.push(query.ruleType);
        }
        if (query.severity) {
            conditions.push(`a.severity = $${paramIndex++}`);
            params.push(query.severity);
        }
        if (query.channel) {
            conditions.push(`a.channel = $${paramIndex++}`);
            params.push(query.channel);
        }
        if (query.isBuiltin !== undefined) {
            conditions.push(`a.is_builtin = $${paramIndex++}`);
            params.push(query.isBuiltin);
        }
        if (query.isActive !== undefined) {
            conditions.push(`a.is_active = $${paramIndex++}`);
            params.push(query.isActive);
        }
        if (query.organizationId) {
            conditions.push(`a.organization_id = $${paramIndex++}`);
            params.push(query.organizationId);
        }
        if (query.search) {
            conditions.push(`(a.name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex} OR a.rule_code ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSorts = ['name', 'rule_code', 'rule_type', 'severity', 'created_at', 'trigger_count'];
        const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'name';
        const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

        const countQuery = `SELECT COUNT(*) FROM alert_rules a ${whereClause}`;
        const countResult = await this.pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const dataQuery = `
      SELECT a.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id) as total_triggers,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND triggered_at > NOW() - INTERVAL '30 days') as triggers_last_30_days,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND is_acknowledged = FALSE) as unacknowledged_count
      FROM alert_rules a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
      ORDER BY a.${safeSort} ${safeOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
        params.push(limit, offset);

        const result = await this.pool.query(dataQuery, params);

        return {
            data: result.rows.map(mapAlertRuleWithStatsRow),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findAlertRuleById(id: string): Promise<AlertRuleWithStats | null> {
        const query = `
      SELECT a.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id) as total_triggers,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND triggered_at > NOW() - INTERVAL '30 days') as triggers_last_30_days,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND is_acknowledged = FALSE) as unacknowledged_count
      FROM alert_rules a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1
    `;
        const result = await this.pool.query(query, [id]);
        return result.rows.length > 0 ? mapAlertRuleWithStatsRow(result.rows[0]) : null;
    }

    async findAlertRuleByCode(code: string): Promise<AlertRuleWithStats | null> {
        const query = `
      SELECT a.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id) as total_triggers,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND triggered_at > NOW() - INTERVAL '30 days') as triggers_last_30_days,
             (SELECT COUNT(*) FROM alert_history WHERE rule_id = a.id AND is_acknowledged = FALSE) as unacknowledged_count
      FROM alert_rules a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.rule_code = $1
    `;
        const result = await this.pool.query(query, [code]);
        return result.rows.length > 0 ? mapAlertRuleWithStatsRow(result.rows[0]) : null;
    }

    async findActiveAlertRules(): Promise<AlertRule[]> {
        const result = await this.pool.query('SELECT * FROM alert_rules WHERE is_active = TRUE ORDER BY rule_type, name');
        return result.rows.map(mapAlertRuleRow);
    }

    async findAlertRulesByType(ruleType: string): Promise<AlertRule[]> {
        const result = await this.pool.query('SELECT * FROM alert_rules WHERE rule_type = $1 AND is_active = TRUE', [ruleType]);
        return result.rows.map(mapAlertRuleRow);
    }

    async createAlertRule(dto: CreateAlertRuleDto, client?: PoolClient): Promise<AlertRule> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO alert_rules (
        rule_code, name, description, rule_type, condition_field, condition_operator,
        condition_value, condition_query, severity, channel, frequency, cooldown_hours,
        recipients, recipient_roles, organization_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
        const params = [
            dto.ruleCode || null,
            dto.name,
            dto.description || null,
            dto.ruleType,
            dto.conditionField,
            dto.conditionOperator,
            JSON.stringify(dto.conditionValue),
            dto.conditionQuery || null,
            dto.severity || 'warning',
            dto.channel || 'both',
            dto.frequency || 'once',
            dto.cooldownHours || 24,
            JSON.stringify(dto.recipients || []),
            JSON.stringify(dto.recipientRoles || []),
            dto.organizationId || null,
            dto.createdBy || null,
        ];
        const result = await executor.query(query, params);
        return mapAlertRuleRow(result.rows[0]);
    }

    async updateAlertRule(id: string, dto: UpdateAlertRuleDto, client?: PoolClient): Promise<AlertRule | null> {
        const executor = client || this.pool;
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(dto.name);
        }
        if (dto.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(dto.description);
        }
        if (dto.conditionField !== undefined) {
            updates.push(`condition_field = $${paramIndex++}`);
            params.push(dto.conditionField);
        }
        if (dto.conditionOperator !== undefined) {
            updates.push(`condition_operator = $${paramIndex++}`);
            params.push(dto.conditionOperator);
        }
        if (dto.conditionValue !== undefined) {
            updates.push(`condition_value = $${paramIndex++}`);
            params.push(JSON.stringify(dto.conditionValue));
        }
        if (dto.conditionQuery !== undefined) {
            updates.push(`condition_query = $${paramIndex++}`);
            params.push(dto.conditionQuery);
        }
        if (dto.severity !== undefined) {
            updates.push(`severity = $${paramIndex++}`);
            params.push(dto.severity);
        }
        if (dto.channel !== undefined) {
            updates.push(`channel = $${paramIndex++}`);
            params.push(dto.channel);
        }
        if (dto.frequency !== undefined) {
            updates.push(`frequency = $${paramIndex++}`);
            params.push(dto.frequency);
        }
        if (dto.cooldownHours !== undefined) {
            updates.push(`cooldown_hours = $${paramIndex++}`);
            params.push(dto.cooldownHours);
        }
        if (dto.recipients !== undefined) {
            updates.push(`recipients = $${paramIndex++}`);
            params.push(JSON.stringify(dto.recipients));
        }
        if (dto.recipientRoles !== undefined) {
            updates.push(`recipient_roles = $${paramIndex++}`);
            params.push(JSON.stringify(dto.recipientRoles));
        }
        if (dto.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(dto.isActive);
        }
        if (dto.updatedBy !== undefined) {
            updates.push(`updated_by = $${paramIndex++}`);
            params.push(dto.updatedBy);
        }

        if (updates.length === 0) {
            const existing = await this.findAlertRuleById(id);
            return existing;
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `UPDATE alert_rules SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await executor.query(query, params);
        return result.rows.length > 0 ? mapAlertRuleRow(result.rows[0]) : null;
    }

    async deleteAlertRule(id: string, client?: PoolClient): Promise<boolean> {
        const executor = client || this.pool;
        const result = await executor.query('DELETE FROM alert_rules WHERE id = $1 AND is_builtin = FALSE', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    async updateAlertRuleLastTriggered(id: string, client?: PoolClient): Promise<void> {
        const executor = client || this.pool;
        await executor.query(
            'UPDATE alert_rules SET last_triggered_at = NOW(), trigger_count = trigger_count + 1 WHERE id = $1',
            [id]
        );
    }

    async checkCooldown(ruleId: string, cooldownHours: number): Promise<boolean> {
        const query = `
      SELECT MAX(triggered_at) as last_triggered
      FROM alert_history
      WHERE rule_id = $1 AND delivery_status = 'sent'
    `;
        const result = await this.pool.query(query, [ruleId]);
        const lastTriggered = result.rows[0]?.last_triggered;

        if (!lastTriggered) {
            return true; // No previous trigger, ok to send
        }

        const cooldownEnd = new Date(lastTriggered);
        cooldownEnd.setHours(cooldownEnd.getHours() + cooldownHours);
        return new Date() > cooldownEnd;
    }

    // ==================== ALERT HISTORY ====================

    async findAllAlertHistory(query: AlertHistoryQuery): Promise<PaginatedResult<AlertHistoryWithRule>> {
        const { page = 1, limit = 20, sortBy = 'triggered_at', sortOrder = 'desc' } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.ruleId) {
            conditions.push(`h.rule_id = $${paramIndex++}`);
            params.push(query.ruleId);
        }
        if (query.ruleType) {
            conditions.push(`r.rule_type = $${paramIndex++}`);
            params.push(query.ruleType);
        }
        if (query.severity) {
            conditions.push(`h.severity = $${paramIndex++}`);
            params.push(query.severity);
        }
        if (query.deliveryStatus) {
            conditions.push(`h.delivery_status = $${paramIndex++}`);
            params.push(query.deliveryStatus);
        }
        if (query.isAcknowledged !== undefined) {
            conditions.push(`h.is_acknowledged = $${paramIndex++}`);
            params.push(query.isAcknowledged);
        }
        if (query.organizationId) {
            conditions.push(`h.organization_id = $${paramIndex++}`);
            params.push(query.organizationId);
        }
        if (query.startDate) {
            conditions.push(`h.triggered_at >= $${paramIndex++}`);
            params.push(query.startDate);
        }
        if (query.endDate) {
            conditions.push(`h.triggered_at <= $${paramIndex++}`);
            params.push(query.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSorts = ['triggered_at', 'severity', 'is_acknowledged', 'affected_count'];
        const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'triggered_at';
        const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

        const countQuery = `
      SELECT COUNT(*) FROM alert_history h
      JOIN alert_rules r ON h.rule_id = r.id
      ${whereClause}
    `;
        const countResult = await this.pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const dataQuery = `
      SELECT h.*, r.name as rule_name, r.rule_type, r.severity as rule_severity
      FROM alert_history h
      JOIN alert_rules r ON h.rule_id = r.id
      ${whereClause}
      ORDER BY h.${safeSort} ${safeOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
        params.push(limit, offset);

        const result = await this.pool.query(dataQuery, params);

        return {
            data: result.rows.map(mapAlertHistoryWithRuleRow),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findAlertHistoryById(id: string): Promise<AlertHistoryWithRule | null> {
        const query = `
      SELECT h.*, r.name as rule_name, r.rule_type, r.severity as rule_severity
      FROM alert_history h
      JOIN alert_rules r ON h.rule_id = r.id
      WHERE h.id = $1
    `;
        const result = await this.pool.query(query, [id]);
        return result.rows.length > 0 ? mapAlertHistoryWithRuleRow(result.rows[0]) : null;
    }

    async findUnacknowledgedAlerts(organizationId?: string): Promise<AlertHistoryWithRule[]> {
        let query = `
      SELECT h.*, r.name as rule_name, r.rule_type, r.severity as rule_severity
      FROM alert_history h
      JOIN alert_rules r ON h.rule_id = r.id
      WHERE h.is_acknowledged = FALSE
    `;
        const params: unknown[] = [];

        if (organizationId) {
            query += ` AND h.organization_id = $1`;
            params.push(organizationId);
        }

        query += ` ORDER BY h.triggered_at DESC`;

        const result = await this.pool.query(query, params);
        return result.rows.map(mapAlertHistoryWithRuleRow);
    }

    async createAlertHistory(dto: CreateAlertHistoryDto, client?: PoolClient): Promise<AlertHistory> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO alert_history (
        rule_id, trigger_data, affected_count, title, message, severity,
        channel_used, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
        const params = [
            dto.ruleId,
            JSON.stringify(dto.triggerData),
            dto.affectedCount || 1,
            dto.title,
            dto.message,
            dto.severity,
            dto.channelUsed || null,
            dto.organizationId || null,
        ];
        const result = await executor.query(query, params);
        return mapAlertHistoryRow(result.rows[0]);
    }

    async acknowledgeAlert(id: string, dto: AcknowledgeAlertDto, client?: PoolClient): Promise<AlertHistory | null> {
        const executor = client || this.pool;
        const query = `
      UPDATE alert_history
      SET is_acknowledged = TRUE,
          acknowledged_by = $1,
          acknowledged_at = NOW(),
          acknowledgment_note = $2
      WHERE id = $3
      RETURNING *
    `;
        const result = await executor.query(query, [dto.acknowledgedBy, dto.acknowledgmentNote || null, id]);
        return result.rows.length > 0 ? mapAlertHistoryRow(result.rows[0]) : null;
    }

    async updateAlertDeliveryStatus(id: string, status: string, error?: string, client?: PoolClient): Promise<void> {
        const executor = client || this.pool;
        await executor.query(
            'UPDATE alert_history SET delivery_status = $1, delivery_error = $2 WHERE id = $3',
            [status, error || null, id]
        );
    }

    async bulkAcknowledgeAlerts(ids: string[], dto: AcknowledgeAlertDto, client?: PoolClient): Promise<number> {
        const executor = client || this.pool;
        const query = `
      UPDATE alert_history
      SET is_acknowledged = TRUE,
          acknowledged_by = $1,
          acknowledged_at = NOW(),
          acknowledgment_note = $2
      WHERE id = ANY($3) AND is_acknowledged = FALSE
    `;
        const result = await executor.query(query, [dto.acknowledgedBy, dto.acknowledgmentNote || null, ids]);
        return result.rowCount || 0;
    }

    // ==================== USER ALERT PREFERENCES ====================

    async findUserAlertPreferences(userId: string): Promise<UserAlertPreferences | null> {
        const result = await this.pool.query('SELECT * FROM user_alert_preferences WHERE user_id = $1', [userId]);
        return result.rows.length > 0 ? mapUserAlertPreferencesRow(result.rows[0]) : null;
    }

    async upsertUserAlertPreferences(userId: string, dto: UpdateUserAlertPreferencesDto, client?: PoolClient): Promise<UserAlertPreferences> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO user_alert_preferences (user_id, email_enabled, in_app_enabled, digest_frequency, digest_time, digest_day, email_min_severity, muted_rules)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        email_enabled = COALESCE($2, user_alert_preferences.email_enabled),
        in_app_enabled = COALESCE($3, user_alert_preferences.in_app_enabled),
        digest_frequency = COALESCE($4, user_alert_preferences.digest_frequency),
        digest_time = COALESCE($5, user_alert_preferences.digest_time),
        digest_day = COALESCE($6, user_alert_preferences.digest_day),
        email_min_severity = COALESCE($7, user_alert_preferences.email_min_severity),
        muted_rules = COALESCE($8, user_alert_preferences.muted_rules),
        updated_at = NOW()
      RETURNING *
    `;
        const params = [
            userId,
            dto.emailEnabled ?? true,
            dto.inAppEnabled ?? true,
            dto.digestFrequency ?? 'immediate',
            dto.digestTime ?? '09:00:00',
            dto.digestDay ?? 1,
            dto.emailMinSeverity ?? 'warning',
            JSON.stringify(dto.mutedRules || []),
        ];
        const result = await executor.query(query, params);
        return mapUserAlertPreferencesRow(result.rows[0]);
    }

    // ==================== DASHBOARD WIDGETS ====================

    async findAllDashboardWidgets(query: DashboardWidgetQuery): Promise<PaginatedResult<DashboardWidget>> {
        const { page = 1, limit = 20 } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (query.widgetType) {
            conditions.push(`widget_type = $${paramIndex++}`);
            params.push(query.widgetType);
        }
        if (query.dataSource) {
            conditions.push(`data_source = $${paramIndex++}`);
            params.push(query.dataSource);
        }
        if (query.isBuiltin !== undefined) {
            conditions.push(`is_builtin = $${paramIndex++}`);
            params.push(query.isBuiltin);
        }
        if (query.isActive !== undefined) {
            conditions.push(`is_active = $${paramIndex++}`);
            params.push(query.isActive);
        }
        if (query.organizationId) {
            conditions.push(`organization_id = $${paramIndex++}`);
            params.push(query.organizationId);
        }
        if (query.search) {
            conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
            params.push(`%${query.search}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) FROM dashboard_widgets ${whereClause}`;
        const countResult = await this.pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);

        const dataQuery = `
      SELECT * FROM dashboard_widgets
      ${whereClause}
      ORDER BY name
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
        params.push(limit, offset);

        const result = await this.pool.query(dataQuery, params);

        return {
            data: result.rows.map(mapDashboardWidgetRow),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findDashboardWidgetById(id: string): Promise<DashboardWidget | null> {
        const result = await this.pool.query('SELECT * FROM dashboard_widgets WHERE id = $1', [id]);
        return result.rows.length > 0 ? mapDashboardWidgetRow(result.rows[0]) : null;
    }

    async findDashboardWidgetByCode(code: string): Promise<DashboardWidget | null> {
        const result = await this.pool.query('SELECT * FROM dashboard_widgets WHERE widget_code = $1', [code]);
        return result.rows.length > 0 ? mapDashboardWidgetRow(result.rows[0]) : null;
    }

    async createDashboardWidget(dto: CreateDashboardWidgetDto, client?: PoolClient): Promise<DashboardWidget> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO dashboard_widgets (
        widget_code, name, description, widget_type, data_source, data_query,
        data_config, default_size, min_width, min_height, refresh_interval,
        organization_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
        const params = [
            dto.widgetCode || null,
            dto.name,
            dto.description || null,
            dto.widgetType,
            dto.dataSource,
            dto.dataQuery || null,
            JSON.stringify(dto.dataConfig || {}),
            dto.defaultSize || 'medium',
            dto.minWidth || 1,
            dto.minHeight || 1,
            dto.refreshInterval || 300,
            dto.organizationId || null,
            dto.createdBy || null,
        ];
        const result = await executor.query(query, params);
        return mapDashboardWidgetRow(result.rows[0]);
    }

    async updateDashboardWidget(id: string, dto: UpdateDashboardWidgetDto, client?: PoolClient): Promise<DashboardWidget | null> {
        const executor = client || this.pool;
        const updates: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(dto.name);
        }
        if (dto.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(dto.description);
        }
        if (dto.dataQuery !== undefined) {
            updates.push(`data_query = $${paramIndex++}`);
            params.push(dto.dataQuery);
        }
        if (dto.dataConfig !== undefined) {
            updates.push(`data_config = $${paramIndex++}`);
            params.push(JSON.stringify(dto.dataConfig));
        }
        if (dto.defaultSize !== undefined) {
            updates.push(`default_size = $${paramIndex++}`);
            params.push(dto.defaultSize);
        }
        if (dto.minWidth !== undefined) {
            updates.push(`min_width = $${paramIndex++}`);
            params.push(dto.minWidth);
        }
        if (dto.minHeight !== undefined) {
            updates.push(`min_height = $${paramIndex++}`);
            params.push(dto.minHeight);
        }
        if (dto.refreshInterval !== undefined) {
            updates.push(`refresh_interval = $${paramIndex++}`);
            params.push(dto.refreshInterval);
        }
        if (dto.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(dto.isActive);
        }

        if (updates.length === 0) {
            return this.findDashboardWidgetById(id);
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `UPDATE dashboard_widgets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await executor.query(query, params);
        return result.rows.length > 0 ? mapDashboardWidgetRow(result.rows[0]) : null;
    }

    async deleteDashboardWidget(id: string, client?: PoolClient): Promise<boolean> {
        const executor = client || this.pool;
        const result = await executor.query('DELETE FROM dashboard_widgets WHERE id = $1 AND is_builtin = FALSE', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    // ==================== USER DASHBOARD LAYOUTS ====================

    async findUserDashboardLayout(userId: string, dashboardType: string = 'main'): Promise<UserDashboardLayout | null> {
        const result = await this.pool.query(
            'SELECT * FROM user_dashboard_layouts WHERE user_id = $1 AND dashboard_type = $2',
            [userId, dashboardType]
        );
        return result.rows.length > 0 ? mapUserDashboardLayoutRow(result.rows[0]) : null;
    }

    async saveUserDashboardLayout(dto: SaveDashboardLayoutDto, client?: PoolClient): Promise<UserDashboardLayout> {
        const executor = client || this.pool;
        const query = `
      INSERT INTO user_dashboard_layouts (user_id, dashboard_type, layout)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, dashboard_type) DO UPDATE SET
        layout = $3,
        updated_at = NOW()
      RETURNING *
    `;
        const result = await executor.query(query, [
            dto.userId,
            dto.dashboardType || 'main',
            JSON.stringify(dto.layout),
        ]);
        return mapUserDashboardLayoutRow(result.rows[0]);
    }

    // ==================== SCHEDULED REPORTS ====================

    async findScheduledReportsDue(): Promise<ReportDefinition[]> {
        const query = `
      SELECT * FROM report_definitions
      WHERE is_scheduled = TRUE
        AND is_active = TRUE
        AND (next_run_at IS NULL OR next_run_at <= NOW())
      ORDER BY next_run_at
    `;
        const result = await this.pool.query(query);
        return result.rows.map(mapReportDefinitionRow);
    }

    async updateReportSchedule(id: string, lastRunAt: Date, nextRunAt: Date, client?: PoolClient): Promise<void> {
        const executor = client || this.pool;
        await executor.query(
            'UPDATE report_definitions SET last_run_at = $1, next_run_at = $2, updated_at = NOW() WHERE id = $3',
            [lastRunAt, nextRunAt, id]
        );
    }

    // ==================== STATISTICS ====================

    async getReportStats(organizationId?: string): Promise<{
        totalReports: number;
        builtinReports: number;
        customReports: number;
        scheduledReports: number;
        executionsToday: number;
    }> {
        const orgFilter = organizationId ? 'AND organization_id = $1' : '';
        const params = organizationId ? [organizationId] : [];

        const query = `
      SELECT
        (SELECT COUNT(*) FROM report_definitions WHERE 1=1 ${orgFilter}) as total_reports,
        (SELECT COUNT(*) FROM report_definitions WHERE is_builtin = TRUE ${orgFilter}) as builtin_reports,
        (SELECT COUNT(*) FROM report_definitions WHERE is_builtin = FALSE ${orgFilter}) as custom_reports,
        (SELECT COUNT(*) FROM report_definitions WHERE is_scheduled = TRUE ${orgFilter}) as scheduled_reports,
        (SELECT COUNT(*) FROM report_executions WHERE started_at >= CURRENT_DATE) as executions_today
    `;

        const result = await this.pool.query(query, params);
        const row = result.rows[0];

        return {
            totalReports: parseInt(row.total_reports, 10),
            builtinReports: parseInt(row.builtin_reports, 10),
            customReports: parseInt(row.custom_reports, 10),
            scheduledReports: parseInt(row.scheduled_reports, 10),
            executionsToday: parseInt(row.executions_today, 10),
        };
    }

    async getAlertStats(organizationId?: string): Promise<{
        totalRules: number;
        activeRules: number;
        alertsToday: number;
        unacknowledgedAlerts: number;
        criticalAlerts: number;
    }> {
        const orgFilter = organizationId ? 'AND organization_id = $1' : '';
        const params = organizationId ? [organizationId] : [];

        const query = `
      SELECT
        (SELECT COUNT(*) FROM alert_rules WHERE 1=1 ${orgFilter}) as total_rules,
        (SELECT COUNT(*) FROM alert_rules WHERE is_active = TRUE ${orgFilter}) as active_rules,
        (SELECT COUNT(*) FROM alert_history WHERE triggered_at >= CURRENT_DATE ${orgFilter}) as alerts_today,
        (SELECT COUNT(*) FROM alert_history WHERE is_acknowledged = FALSE ${orgFilter}) as unacknowledged_alerts,
        (SELECT COUNT(*) FROM alert_history WHERE severity = 'critical' AND is_acknowledged = FALSE ${orgFilter}) as critical_alerts
    `;

        const result = await this.pool.query(query, params);
        const row = result.rows[0];

        return {
            totalRules: parseInt(row.total_rules, 10),
            activeRules: parseInt(row.active_rules, 10),
            alertsToday: parseInt(row.alerts_today, 10),
            unacknowledgedAlerts: parseInt(row.unacknowledged_alerts, 10),
            criticalAlerts: parseInt(row.critical_alerts, 10),
        };
    }
}

export function createReportsRepository(pool: Pool): ReportsRepository {
    return new ReportsRepository(pool);
}
