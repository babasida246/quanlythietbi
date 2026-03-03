// =============================================
// Module: Reports & Alerts (10-REPORTS)
// Repository Unit Tests
// =============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { ReportsRepository } from '../reports.repository';

// ==================== MOCK SETUP ====================

const mockQuery = vi.fn();
const mockPool = {
    query: mockQuery,
} as unknown as Pool;

// ==================== HELPER FUNCTIONS ====================

function createMockReportDefinitionRow(overrides = {}) {
    return {
        id: '123e4567-e89b-12d3-a456-426614174000',
        report_code: 'RPT-TAB-001',
        name: 'Asset List Report',
        description: 'Complete list of all assets',
        report_type: 'tabular',
        data_source: 'assets',
        fields: ['asset_tag', 'name', 'category'],
        filters: [],
        default_filters: {},
        grouping: [],
        sorting: [],
        chart_config: {},
        access_level: 'all',
        allowed_roles: [],
        is_scheduled: false,
        schedule_cron: null,
        schedule_recipients: [],
        schedule_format: 'excel',
        last_run_at: null,
        next_run_at: null,
        is_builtin: true,
        is_active: true,
        is_favorite: false,
        view_count: 10,
        organization_id: null,
        created_by: null,
        updated_by: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

function createMockReportExecutionRow(overrides = {}) {
    return {
        id: '223e4567-e89b-12d3-a456-426614174000',
        report_id: '123e4567-e89b-12d3-a456-426614174000',
        execution_type: 'manual',
        status: 'completed',
        filters_used: {},
        row_count: 100,
        file_path: '/exports/report.xlsx',
        file_format: 'excel',
        file_size_bytes: 50000,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:00:05Z',
        duration_ms: 5000,
        error_message: null,
        recipients: [],
        delivery_status: null,
        delivery_error: null,
        executed_by: null,
        created_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

function createMockAlertRuleRow(overrides = {}) {
    return {
        id: '323e4567-e89b-12d3-a456-426614174000',
        rule_code: 'ALR-LIC-001',
        name: 'License Expiring Soon',
        description: 'Alert when license expires within 30 days',
        rule_type: 'license',
        condition_field: 'expiry_date',
        condition_operator: 'lte',
        condition_value: { days: 30 },
        condition_query: null,
        severity: 'warning',
        channel: 'both',
        frequency: 'once',
        cooldown_hours: 168,
        recipients: ['user1@example.com'],
        recipient_roles: ['admin'],
        is_builtin: true,
        is_active: true,
        last_triggered_at: null,
        trigger_count: 0,
        organization_id: null,
        created_by: null,
        updated_by: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

function createMockAlertHistoryRow(overrides = {}) {
    return {
        id: '423e4567-e89b-12d3-a456-426614174000',
        rule_id: '323e4567-e89b-12d3-a456-426614174000',
        triggered_at: '2024-01-15T10:00:00Z',
        trigger_data: { items: [] },
        affected_count: 5,
        title: 'License Expiring Soon',
        message: '5 licenses expiring within 30 days',
        severity: 'warning',
        recipients_notified: ['user1@example.com'],
        channel_used: 'email',
        delivery_status: 'sent',
        delivery_error: null,
        is_acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
        acknowledgment_note: null,
        organization_id: null,
        created_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

function createMockDashboardWidgetRow(overrides = {}) {
    return {
        id: '523e4567-e89b-12d3-a456-426614174000',
        widget_code: 'WDG-ASSET-STATUS',
        name: 'Assets by Status',
        description: 'Pie chart showing assets by status',
        widget_type: 'pie_chart',
        data_source: 'assets',
        data_query: null,
        data_config: { group_by: 'status' },
        default_size: 'medium',
        min_width: 1,
        min_height: 1,
        refresh_interval: 300,
        is_builtin: true,
        is_active: true,
        organization_id: null,
        created_by: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

function createMockUserAlertPreferencesRow(overrides = {}) {
    return {
        id: '623e4567-e89b-12d3-a456-426614174000',
        user_id: '723e4567-e89b-12d3-a456-426614174000',
        email_enabled: true,
        in_app_enabled: true,
        digest_frequency: 'immediate',
        digest_time: '09:00:00',
        digest_day: 1,
        email_min_severity: 'warning',
        muted_rules: [],
        updated_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

function createMockUserDashboardLayoutRow(overrides = {}) {
    return {
        id: '823e4567-e89b-12d3-a456-426614174000',
        user_id: '723e4567-e89b-12d3-a456-426614174000',
        dashboard_type: 'main',
        layout: [{ widgetId: '523e4567-e89b-12d3-a456-426614174000', x: 0, y: 0, w: 2, h: 2 }],
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        ...overrides,
    };
}

// ==================== TESTS ====================

describe('ReportsRepository', () => {
    let repository: ReportsRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new ReportsRepository(mockPool);
    });

    // ==================== REPORT DEFINITIONS ====================

    describe('Report Definitions', () => {
        describe('findAllReportDefinitions', () => {
            it('should return paginated report definitions', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                    .mockResolvedValueOnce({
                        rows: [
                            createMockReportDefinitionRow(),
                            createMockReportDefinitionRow({ id: '223e4567-e89b-12d3-a456-426614174001', report_code: 'RPT-TAB-002' }),
                        ],
                    });

                const result = await repository.findAllReportDefinitions({ page: 1, limit: 20 });

                expect(result.data).toHaveLength(2);
                expect(result.total).toBe(5);
                expect(result.page).toBe(1);
                expect(result.limit).toBe(20);
                expect(result.totalPages).toBe(1);
            });

            it('should filter by report type', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                await repository.findAllReportDefinitions({ reportType: 'tabular' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('report_type = $1'),
                    expect.arrayContaining(['tabular'])
                );
            });

            it('should filter by data source', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '2' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                await repository.findAllReportDefinitions({ dataSource: 'assets' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('data_source = $'),
                    expect.arrayContaining(['assets'])
                );
            });

            it('should filter by access level', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                await repository.findAllReportDefinitions({ accessLevel: 'admin' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('access_level = $'),
                    expect.arrayContaining(['admin'])
                );
            });

            it('should filter by isScheduled', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '2' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportDefinitionRow({ is_scheduled: true })] });

                await repository.findAllReportDefinitions({ isScheduled: true });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('is_scheduled = $'),
                    expect.arrayContaining([true])
                );
            });

            it('should filter by isBuiltin', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                await repository.findAllReportDefinitions({ isBuiltin: true });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('is_builtin = $'),
                    expect.arrayContaining([true])
                );
            });

            it('should filter by search term', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                await repository.findAllReportDefinitions({ search: 'asset' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('ILIKE'),
                    expect.arrayContaining(['%asset%'])
                );
            });
        });

        describe('findReportDefinitionById', () => {
            it('should return report definition when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                const result = await repository.findReportDefinitionById('123e4567-e89b-12d3-a456-426614174000');

                expect(result).not.toBeNull();
                expect(result?.id).toBe('123e4567-e89b-12d3-a456-426614174000');
                expect(result?.reportCode).toBe('RPT-TAB-001');
            });

            it('should return null when not found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [] });

                const result = await repository.findReportDefinitionById('nonexistent-id');

                expect(result).toBeNull();
            });
        });

        describe('findReportDefinitionByCode', () => {
            it('should return report definition when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                const result = await repository.findReportDefinitionByCode('RPT-TAB-001');

                expect(result).not.toBeNull();
                expect(result?.reportCode).toBe('RPT-TAB-001');
            });

            it('should return null when not found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [] });

                const result = await repository.findReportDefinitionByCode('NONEXISTENT');

                expect(result).toBeNull();
            });
        });

        describe('createReportDefinition', () => {
            it('should create a new report definition', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockReportDefinitionRow()] });

                const result = await repository.createReportDefinition({
                    name: 'Asset List Report',
                    reportType: 'tabular',
                    dataSource: 'assets',
                    fields: ['asset_tag', 'name', 'category'],
                });

                expect(result).not.toBeNull();
                expect(result.name).toBe('Asset List Report');
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO report_definitions'),
                    expect.any(Array)
                );
            });
        });

        describe('updateReportDefinition', () => {
            it('should update report definition', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockReportDefinitionRow({ name: 'Updated Report' })],
                });

                const result = await repository.updateReportDefinition('123e4567-e89b-12d3-a456-426614174000', {
                    name: 'Updated Report',
                });

                expect(result).not.toBeNull();
                expect(result?.name).toBe('Updated Report');
            });

            it('should return null when not found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [] });

                const result = await repository.updateReportDefinition('nonexistent-id', {
                    name: 'Updated Report',
                });

                expect(result).toBeNull();
            });
        });

        describe('deleteReportDefinition', () => {
            it('should delete report definition and return true', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });

                const result = await repository.deleteReportDefinition('123e4567-e89b-12d3-a456-426614174000');

                expect(result).toBe(true);
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('DELETE FROM report_definitions'),
                    expect.arrayContaining(['123e4567-e89b-12d3-a456-426614174000'])
                );
            });

            it('should return false when not found or builtin', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 0 });

                const result = await repository.deleteReportDefinition('nonexistent-id');

                expect(result).toBe(false);
            });
        });

        describe('incrementViewCount', () => {
            it('should increment view count', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });

                await repository.incrementViewCount('123e4567-e89b-12d3-a456-426614174000');

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('view_count = view_count + 1'),
                    expect.arrayContaining(['123e4567-e89b-12d3-a456-426614174000'])
                );
            });
        });
    });

    // ==================== REPORT EXECUTIONS ====================

    describe('Report Executions', () => {
        describe('findAllReportExecutions', () => {
            it('should return paginated executions', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '10' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportExecutionRow()] });

                const result = await repository.findAllReportExecutions({ page: 1, limit: 20 });

                expect(result.data).toHaveLength(1);
                expect(result.total).toBe(10);
            });

            it('should filter by reportId', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportExecutionRow()] });

                await repository.findAllReportExecutions({ reportId: '123e4567-e89b-12d3-a456-426614174000' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('report_id = $'),
                    expect.arrayContaining(['123e4567-e89b-12d3-a456-426614174000'])
                );
            });

            it('should filter by status', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                    .mockResolvedValueOnce({ rows: [createMockReportExecutionRow()] });

                await repository.findAllReportExecutions({ status: 'completed' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('status = $'),
                    expect.arrayContaining(['completed'])
                );
            });
        });

        describe('findReportExecutionById', () => {
            it('should return execution when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockReportExecutionRow()] });

                const result = await repository.findReportExecutionById('223e4567-e89b-12d3-a456-426614174000');

                expect(result).not.toBeNull();
                expect(result?.status).toBe('completed');
            });
        });

        describe('createReportExecution', () => {
            it('should create execution with running status', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockReportExecutionRow({ status: 'running' })],
                });

                const result = await repository.createReportExecution({
                    reportId: '123e4567-e89b-12d3-a456-426614174000',
                });

                expect(result).not.toBeNull();
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO report_executions'),
                    expect.any(Array)
                );
            });
        });

        describe('updateReportExecution', () => {
            it('should update execution status', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockReportExecutionRow({ status: 'completed' })],
                });

                const result = await repository.updateReportExecution('223e4567-e89b-12d3-a456-426614174000', {
                    status: 'completed',
                    rowCount: 100,
                });

                expect(result).not.toBeNull();
                expect(result?.status).toBe('completed');
            });
        });
    });

    // ==================== ALERT RULES ====================

    describe('Alert Rules', () => {
        describe('findAllAlertRules', () => {
            it('should return paginated alert rules', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '10' }] })
                    .mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                const result = await repository.findAllAlertRules({ page: 1, limit: 20 });

                expect(result.data).toHaveLength(1);
                expect(result.total).toBe(10);
            });

            it('should filter by ruleType', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                    .mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                await repository.findAllAlertRules({ ruleType: 'license' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('rule_type = $'),
                    expect.arrayContaining(['license'])
                );
            });

            it('should filter by severity', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '2' }] })
                    .mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                await repository.findAllAlertRules({ severity: 'warning' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('severity = $'),
                    expect.arrayContaining(['warning'])
                );
            });

            it('should filter by channel', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                    .mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                await repository.findAllAlertRules({ channel: 'email' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('channel = $'),
                    expect.arrayContaining(['email'])
                );
            });
        });

        describe('findAlertRuleById', () => {
            it('should return alert rule when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                const result = await repository.findAlertRuleById('323e4567-e89b-12d3-a456-426614174000');

                expect(result).not.toBeNull();
                expect(result?.ruleCode).toBe('ALR-LIC-001');
            });
        });

        describe('findAlertRuleByCode', () => {
            it('should return alert rule by code', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                const result = await repository.findAlertRuleByCode('ALR-LIC-001');

                expect(result).not.toBeNull();
                expect(result?.name).toBe('License Expiring Soon');
            });
        });

        describe('findActiveAlertRules', () => {
            it('should return only active rules', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [
                        createMockAlertRuleRow(),
                        createMockAlertRuleRow({ id: '423e4567-e89b-12d3-a456-426614174001', rule_code: 'ALR-LIC-002' }),
                    ],
                });

                const result = await repository.findActiveAlertRules();

                expect(result).toHaveLength(2);
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('is_active = TRUE')
                );
            });
        });

        describe('findAlertRulesByType', () => {
            it('should return rules by type', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                const result = await repository.findAlertRulesByType('license');

                expect(result).toHaveLength(1);
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('rule_type = $1'),
                    ['license']
                );
            });
        });

        describe('createAlertRule', () => {
            it('should create a new alert rule', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockAlertRuleRow()] });

                const result = await repository.createAlertRule({
                    name: 'License Expiring Soon',
                    ruleType: 'license',
                    conditionField: 'expiry_date',
                    conditionOperator: 'lte',
                    conditionValue: { days: 30 },
                });

                expect(result).not.toBeNull();
                expect(result.name).toBe('License Expiring Soon');
            });
        });

        describe('updateAlertRule', () => {
            it('should update alert rule', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockAlertRuleRow({ name: 'Updated Rule' })],
                });

                const result = await repository.updateAlertRule('323e4567-e89b-12d3-a456-426614174000', {
                    name: 'Updated Rule',
                });

                expect(result).not.toBeNull();
                expect(result?.name).toBe('Updated Rule');
            });
        });

        describe('deleteAlertRule', () => {
            it('should delete alert rule', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });

                const result = await repository.deleteAlertRule('323e4567-e89b-12d3-a456-426614174000');

                expect(result).toBe(true);
            });
        });

        describe('updateAlertRuleLastTriggered', () => {
            it('should update last triggered timestamp', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });

                await repository.updateAlertRuleLastTriggered('323e4567-e89b-12d3-a456-426614174000');

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('last_triggered_at = NOW()'),
                    expect.any(Array)
                );
            });
        });

        describe('checkCooldown', () => {
            it('should return true when no previous triggers', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [{ last_triggered: null }] });

                const result = await repository.checkCooldown('323e4567-e89b-12d3-a456-426614174000', 24);

                expect(result).toBe(true);
            });

            it('should return true when cooldown has passed', async () => {
                const oldDate = new Date();
                oldDate.setHours(oldDate.getHours() - 25);
                mockQuery.mockResolvedValueOnce({ rows: [{ last_triggered: oldDate.toISOString() }] });

                const result = await repository.checkCooldown('323e4567-e89b-12d3-a456-426614174000', 24);

                expect(result).toBe(true);
            });

            it('should return false when cooldown is active', async () => {
                const recentDate = new Date();
                recentDate.setHours(recentDate.getHours() - 1);
                mockQuery.mockResolvedValueOnce({ rows: [{ last_triggered: recentDate.toISOString() }] });

                const result = await repository.checkCooldown('323e4567-e89b-12d3-a456-426614174000', 24);

                expect(result).toBe(false);
            });
        });
    });

    // ==================== ALERT HISTORY ====================

    describe('Alert History', () => {
        describe('findAllAlertHistory', () => {
            it('should return paginated alert history', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '20' }] })
                    .mockResolvedValueOnce({
                        rows: [
                            { ...createMockAlertHistoryRow(), rule_name: 'Test Rule', rule_type: 'license', rule_severity: 'warning' },
                        ],
                    });

                const result = await repository.findAllAlertHistory({ page: 1, limit: 20 });

                expect(result.data).toHaveLength(1);
                expect(result.total).toBe(20);
            });

            it('should filter by severity', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                    .mockResolvedValueOnce({
                        rows: [{ ...createMockAlertHistoryRow(), rule_name: 'Test', rule_type: 'license', rule_severity: 'warning' }],
                    });

                await repository.findAllAlertHistory({ severity: 'critical' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('h.severity = $'),
                    expect.arrayContaining(['critical'])
                );
            });

            it('should filter by isAcknowledged', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '10' }] })
                    .mockResolvedValueOnce({
                        rows: [{ ...createMockAlertHistoryRow(), rule_name: 'Test', rule_type: 'license', rule_severity: 'warning' }],
                    });

                await repository.findAllAlertHistory({ isAcknowledged: false });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('is_acknowledged = $'),
                    expect.arrayContaining([false])
                );
            });
        });

        describe('findAlertHistoryById', () => {
            it('should return alert history when found', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [{ ...createMockAlertHistoryRow(), rule_name: 'Test', rule_type: 'license', rule_severity: 'warning' }],
                });

                const result = await repository.findAlertHistoryById('423e4567-e89b-12d3-a456-426614174000');

                expect(result).not.toBeNull();
                expect(result?.title).toBe('License Expiring Soon');
            });
        });

        describe('findUnacknowledgedAlerts', () => {
            it('should return unacknowledged alerts', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [{ ...createMockAlertHistoryRow(), rule_name: 'Test', rule_type: 'license', rule_severity: 'warning' }],
                });

                const result = await repository.findUnacknowledgedAlerts();

                expect(result).toHaveLength(1);
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('is_acknowledged = FALSE'),
                    []
                );
            });

            it('should filter by organizationId', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [] });

                await repository.findUnacknowledgedAlerts('org-123');

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('organization_id = $1'),
                    ['org-123']
                );
            });
        });

        describe('createAlertHistory', () => {
            it('should create alert history entry', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockAlertHistoryRow()] });

                const result = await repository.createAlertHistory({
                    ruleId: '323e4567-e89b-12d3-a456-426614174000',
                    triggerData: { items: [] },
                    title: 'License Expiring Soon',
                    message: '5 licenses expiring',
                    severity: 'warning',
                });

                expect(result).not.toBeNull();
                expect(result.title).toBe('License Expiring Soon');
            });
        });

        describe('acknowledgeAlert', () => {
            it('should acknowledge alert', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockAlertHistoryRow({ is_acknowledged: true })],
                });

                const result = await repository.acknowledgeAlert('423e4567-e89b-12d3-a456-426614174000', {
                    acknowledgedBy: 'user-123',
                    acknowledgmentNote: 'Reviewed',
                });

                expect(result).not.toBeNull();
                expect(result?.isAcknowledged).toBe(true);
            });
        });

        describe('updateAlertDeliveryStatus', () => {
            it('should update delivery status', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });

                await repository.updateAlertDeliveryStatus('423e4567-e89b-12d3-a456-426614174000', 'sent');

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('delivery_status = $1'),
                    ['sent', null, '423e4567-e89b-12d3-a456-426614174000']
                );
            });
        });

        describe('bulkAcknowledgeAlerts', () => {
            it('should acknowledge multiple alerts', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 3 });

                const result = await repository.bulkAcknowledgeAlerts(
                    ['id1', 'id2', 'id3'],
                    { acknowledgedBy: 'user-123' }
                );

                expect(result).toBe(3);
            });
        });
    });

    // ==================== USER ALERT PREFERENCES ====================

    describe('User Alert Preferences', () => {
        describe('findUserAlertPreferences', () => {
            it('should return user preferences when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockUserAlertPreferencesRow()] });

                const result = await repository.findUserAlertPreferences('723e4567-e89b-12d3-a456-426614174000');

                expect(result).not.toBeNull();
                expect(result?.emailEnabled).toBe(true);
            });

            it('should return null when not found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [] });

                const result = await repository.findUserAlertPreferences('nonexistent');

                expect(result).toBeNull();
            });
        });

        describe('upsertUserAlertPreferences', () => {
            it('should upsert preferences', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockUserAlertPreferencesRow()] });

                const result = await repository.upsertUserAlertPreferences('723e4567-e89b-12d3-a456-426614174000', {
                    emailEnabled: true,
                    inAppEnabled: false,
                });

                expect(result).not.toBeNull();
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('ON CONFLICT'),
                    expect.any(Array)
                );
            });
        });
    });

    // ==================== DASHBOARD WIDGETS ====================

    describe('Dashboard Widgets', () => {
        describe('findAllDashboardWidgets', () => {
            it('should return paginated widgets', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '12' }] })
                    .mockResolvedValueOnce({ rows: [createMockDashboardWidgetRow()] });

                const result = await repository.findAllDashboardWidgets({ page: 1, limit: 20 });

                expect(result.data).toHaveLength(1);
                expect(result.total).toBe(12);
            });

            it('should filter by widgetType', async () => {
                mockQuery
                    .mockResolvedValueOnce({ rows: [{ count: '3' }] })
                    .mockResolvedValueOnce({ rows: [createMockDashboardWidgetRow()] });

                await repository.findAllDashboardWidgets({ widgetType: 'pie_chart' });

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('widget_type = $'),
                    expect.arrayContaining(['pie_chart'])
                );
            });
        });

        describe('findDashboardWidgetById', () => {
            it('should return widget when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockDashboardWidgetRow()] });

                const result = await repository.findDashboardWidgetById('523e4567-e89b-12d3-a456-426614174000');

                expect(result).not.toBeNull();
                expect(result?.widgetCode).toBe('WDG-ASSET-STATUS');
            });
        });

        describe('findDashboardWidgetByCode', () => {
            it('should return widget by code', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockDashboardWidgetRow()] });

                const result = await repository.findDashboardWidgetByCode('WDG-ASSET-STATUS');

                expect(result).not.toBeNull();
                expect(result?.name).toBe('Assets by Status');
            });
        });

        describe('createDashboardWidget', () => {
            it('should create widget', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockDashboardWidgetRow()] });

                const result = await repository.createDashboardWidget({
                    name: 'Assets by Status',
                    widgetType: 'pie_chart',
                    dataSource: 'assets',
                });

                expect(result).not.toBeNull();
                expect(result.name).toBe('Assets by Status');
            });
        });

        describe('updateDashboardWidget', () => {
            it('should update widget', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockDashboardWidgetRow({ name: 'Updated Widget' })],
                });

                const result = await repository.updateDashboardWidget('523e4567-e89b-12d3-a456-426614174000', {
                    name: 'Updated Widget',
                });

                expect(result).not.toBeNull();
                expect(result?.name).toBe('Updated Widget');
            });
        });

        describe('deleteDashboardWidget', () => {
            it('should delete widget', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });

                const result = await repository.deleteDashboardWidget('523e4567-e89b-12d3-a456-426614174000');

                expect(result).toBe(true);
            });
        });
    });

    // ==================== USER DASHBOARD LAYOUTS ====================

    describe('User Dashboard Layouts', () => {
        describe('findUserDashboardLayout', () => {
            it('should return layout when found', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockUserDashboardLayoutRow()] });

                const result = await repository.findUserDashboardLayout('723e4567-e89b-12d3-a456-426614174000', 'main');

                expect(result).not.toBeNull();
                expect(result?.dashboardType).toBe('main');
            });
        });

        describe('saveUserDashboardLayout', () => {
            it('should save layout with upsert', async () => {
                mockQuery.mockResolvedValueOnce({ rows: [createMockUserDashboardLayoutRow()] });

                const result = await repository.saveUserDashboardLayout({
                    userId: '723e4567-e89b-12d3-a456-426614174000',
                    dashboardType: 'main',
                    layout: [{ widgetId: '523e4567-e89b-12d3-a456-426614174000', x: 0, y: 0, w: 2, h: 2 }],
                });

                expect(result).not.toBeNull();
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('ON CONFLICT'),
                    expect.any(Array)
                );
            });
        });
    });

    // ==================== SCHEDULED REPORTS ====================

    describe('Scheduled Reports', () => {
        describe('findScheduledReportsDue', () => {
            it('should return reports due for execution', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [createMockReportDefinitionRow({ is_scheduled: true })],
                });

                const result = await repository.findScheduledReportsDue();

                expect(result).toHaveLength(1);
                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('is_scheduled = TRUE')
                );
            });
        });

        describe('updateReportSchedule', () => {
            it('should update schedule timestamps', async () => {
                mockQuery.mockResolvedValueOnce({ rowCount: 1 });
                const lastRunAt = new Date();
                const nextRunAt = new Date();
                nextRunAt.setDate(nextRunAt.getDate() + 1);

                await repository.updateReportSchedule('123e4567-e89b-12d3-a456-426614174000', lastRunAt, nextRunAt);

                expect(mockQuery).toHaveBeenCalledWith(
                    expect.stringContaining('last_run_at = $1'),
                    [lastRunAt, nextRunAt, '123e4567-e89b-12d3-a456-426614174000']
                );
            });
        });
    });

    // ==================== STATISTICS ====================

    describe('Statistics', () => {
        describe('getReportStats', () => {
            it('should return report statistics', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [{
                        total_reports: '10',
                        builtin_reports: '5',
                        custom_reports: '5',
                        scheduled_reports: '3',
                        executions_today: '15',
                    }],
                });

                const result = await repository.getReportStats();

                expect(result.totalReports).toBe(10);
                expect(result.builtinReports).toBe(5);
                expect(result.customReports).toBe(5);
                expect(result.scheduledReports).toBe(3);
                expect(result.executionsToday).toBe(15);
            });
        });

        describe('getAlertStats', () => {
            it('should return alert statistics', async () => {
                mockQuery.mockResolvedValueOnce({
                    rows: [{
                        total_rules: '13',
                        active_rules: '10',
                        alerts_today: '5',
                        unacknowledged_alerts: '3',
                        critical_alerts: '1',
                    }],
                });

                const result = await repository.getAlertStats();

                expect(result.totalRules).toBe(13);
                expect(result.activeRules).toBe(10);
                expect(result.alertsToday).toBe(5);
                expect(result.unacknowledgedAlerts).toBe(3);
                expect(result.criticalAlerts).toBe(1);
            });
        });
    });
});
