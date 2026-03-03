// =============================================
// Module: Reports & Alerts (10-REPORTS)
// Service Unit Tests
// =============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool } from 'pg';
import {
    ReportsService,
    ReportNotFoundError,
    AlertRuleNotFoundError,
    AlertHistoryNotFoundError,
    WidgetNotFoundError,
    BuiltinModificationError,
} from '../reports.service';
import { ReportsRepository } from '../reports.repository';
import {
    ReportDefinitionWithStats,
    ReportExecution,
    AlertRule,
    AlertRuleWithStats,
    AlertHistoryWithRule,
    UserAlertPreferences,
    DashboardWidget,
    UserDashboardLayout,
    PaginatedResult,
} from '../reports.types';

// ==================== MOCK SETUP ====================

const mockRepository = {
    // Report Definitions
    findAllReportDefinitions: vi.fn(),
    findReportDefinitionById: vi.fn(),
    findReportDefinitionByCode: vi.fn(),
    createReportDefinition: vi.fn(),
    updateReportDefinition: vi.fn(),
    deleteReportDefinition: vi.fn(),
    incrementViewCount: vi.fn(),

    // Report Executions
    findAllReportExecutions: vi.fn(),
    findReportExecutionById: vi.fn(),
    createReportExecution: vi.fn(),
    updateReportExecution: vi.fn(),

    // Alert Rules
    findAllAlertRules: vi.fn(),
    findAlertRuleById: vi.fn(),
    findAlertRuleByCode: vi.fn(),
    findActiveAlertRules: vi.fn(),
    findAlertRulesByType: vi.fn(),
    createAlertRule: vi.fn(),
    updateAlertRule: vi.fn(),
    deleteAlertRule: vi.fn(),
    updateAlertRuleLastTriggered: vi.fn(),
    checkCooldown: vi.fn(),

    // Alert History
    findAllAlertHistory: vi.fn(),
    findAlertHistoryById: vi.fn(),
    findUnacknowledgedAlerts: vi.fn(),
    createAlertHistory: vi.fn(),
    acknowledgeAlert: vi.fn(),
    updateAlertDeliveryStatus: vi.fn(),
    bulkAcknowledgeAlerts: vi.fn(),

    // User Alert Preferences
    findUserAlertPreferences: vi.fn(),
    upsertUserAlertPreferences: vi.fn(),

    // Dashboard Widgets
    findAllDashboardWidgets: vi.fn(),
    findDashboardWidgetById: vi.fn(),
    findDashboardWidgetByCode: vi.fn(),
    createDashboardWidget: vi.fn(),
    updateDashboardWidget: vi.fn(),
    deleteDashboardWidget: vi.fn(),

    // User Dashboard Layouts
    findUserDashboardLayout: vi.fn(),
    saveUserDashboardLayout: vi.fn(),

    // Scheduled Reports
    findScheduledReportsDue: vi.fn(),
    updateReportSchedule: vi.fn(),

    // Statistics
    getReportStats: vi.fn(),
    getAlertStats: vi.fn(),
} as unknown as ReportsRepository;

const mockPool = {} as Pool;

// ==================== HELPER FUNCTIONS ====================

function createMockReportDefinition(overrides = {}): ReportDefinitionWithStats {
    return {
        id: '123e4567-e89b-12d3-a456-426614174000',
        reportCode: 'RPT-TAB-001',
        name: 'Asset List Report',
        description: 'Complete list of all assets',
        reportType: 'tabular',
        dataSource: 'assets',
        fields: ['asset_tag', 'name', 'category'],
        filters: [],
        defaultFilters: {},
        grouping: [],
        sorting: [],
        chartConfig: {},
        accessLevel: 'all',
        allowedRoles: [],
        isScheduled: false,
        scheduleCron: null,
        scheduleRecipients: [],
        scheduleFormat: 'excel',
        lastRunAt: null,
        nextRunAt: null,
        isBuiltin: false,
        isActive: true,
        isFavorite: false,
        viewCount: 10,
        organizationId: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        ...overrides,
    };
}

function createMockReportExecution(overrides = {}): ReportExecution {
    return {
        id: '223e4567-e89b-12d3-a456-426614174000',
        reportId: '123e4567-e89b-12d3-a456-426614174000',
        executionType: 'manual',
        status: 'completed',
        filtersUsed: {},
        rowCount: 100,
        filePath: '/exports/report.xlsx',
        fileFormat: 'excel',
        fileSizeBytes: 50000,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:00:05Z'),
        durationMs: 5000,
        errorMessage: null,
        recipients: [],
        deliveryStatus: null,
        deliveryError: null,
        executedBy: null,
        createdAt: new Date('2024-01-15'),
        ...overrides,
    };
}

function createMockAlertRule(overrides = {}): AlertRuleWithStats {
    return {
        id: '323e4567-e89b-12d3-a456-426614174000',
        ruleCode: 'ALR-LIC-001',
        name: 'License Expiring Soon',
        description: 'Alert when license expires within 30 days',
        ruleType: 'license',
        conditionField: 'expiry_date',
        conditionOperator: 'lte',
        conditionValue: { days: 30 },
        conditionQuery: null,
        severity: 'warning',
        channel: 'both',
        frequency: 'once',
        cooldownHours: 168,
        recipients: ['user1@example.com'],
        recipientRoles: ['admin'],
        isBuiltin: false,
        isActive: true,
        lastTriggeredAt: null,
        triggerCount: 0,
        organizationId: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        ...overrides,
    };
}

function createMockAlertHistory(overrides = {}): AlertHistoryWithRule {
    return {
        id: '423e4567-e89b-12d3-a456-426614174000',
        ruleId: '323e4567-e89b-12d3-a456-426614174000',
        triggeredAt: new Date('2024-01-15T10:00:00Z'),
        triggerData: { items: [] },
        affectedCount: 5,
        title: 'License Expiring Soon',
        message: '5 licenses expiring within 30 days',
        severity: 'warning',
        recipientsNotified: ['user1@example.com'],
        channelUsed: 'email',
        deliveryStatus: 'sent',
        deliveryError: null,
        isAcknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        acknowledgmentNote: null,
        organizationId: null,
        createdAt: new Date('2024-01-15'),
        ruleName: 'License Expiring Soon',
        ruleType: 'license',
        ruleSeverity: 'warning',
        ...overrides,
    };
}

function createMockDashboardWidget(overrides = {}): DashboardWidget {
    return {
        id: '523e4567-e89b-12d3-a456-426614174000',
        widgetCode: 'WDG-ASSET-STATUS',
        name: 'Assets by Status',
        description: 'Pie chart showing assets by status',
        widgetType: 'pie_chart',
        dataSource: 'assets',
        dataQuery: null,
        dataConfig: { group_by: 'status' },
        defaultSize: 'medium',
        minWidth: 1,
        minHeight: 1,
        refreshInterval: 300,
        isBuiltin: false,
        isActive: true,
        organizationId: null,
        createdBy: null,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        ...overrides,
    };
}

function createMockUserPreferences(overrides = {}): UserAlertPreferences {
    return {
        id: '623e4567-e89b-12d3-a456-426614174000',
        userId: '723e4567-e89b-12d3-a456-426614174000',
        emailEnabled: true,
        inAppEnabled: true,
        digestFrequency: 'immediate',
        digestTime: '09:00:00',
        digestDay: 1,
        emailMinSeverity: 'warning',
        mutedRules: [],
        updatedAt: new Date('2024-01-15'),
        ...overrides,
    };
}

function createMockDashboardLayout(overrides = {}): UserDashboardLayout {
    return {
        id: '823e4567-e89b-12d3-a456-426614174000',
        userId: '723e4567-e89b-12d3-a456-426614174000',
        dashboardType: 'main',
        layout: [{ widgetId: '523e4567-e89b-12d3-a456-426614174000', x: 0, y: 0, w: 2, h: 2 }],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        ...overrides,
    };
}

// ==================== TESTS ====================

describe('ReportsService', () => {
    let service: ReportsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ReportsService(mockRepository, mockPool);
    });

    // ==================== REPORT DEFINITIONS ====================

    describe('Report Definitions', () => {
        describe('getAllReportDefinitions', () => {
            it('should return paginated report definitions', async () => {
                const mockResult: PaginatedResult<ReportDefinitionWithStats> = {
                    data: [createMockReportDefinition()],
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                };
                vi.mocked(mockRepository.findAllReportDefinitions).mockResolvedValue(mockResult);

                const result = await service.getAllReportDefinitions({ page: 1, limit: 20 });

                expect(result).toEqual(mockResult);
                expect(mockRepository.findAllReportDefinitions).toHaveBeenCalledWith({ page: 1, limit: 20 });
            });
        });

        describe('getReportDefinitionById', () => {
            it('should return report and increment view count', async () => {
                const mockReport = createMockReportDefinition();
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.incrementViewCount).mockResolvedValue(undefined);

                const result = await service.getReportDefinitionById('123e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockReport);
                expect(mockRepository.incrementViewCount).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
            });

            it('should throw ReportNotFoundError when not found', async () => {
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(null);

                await expect(service.getReportDefinitionById('nonexistent')).rejects.toThrow(ReportNotFoundError);
            });
        });

        describe('getReportDefinitionByCode', () => {
            it('should return report by code', async () => {
                const mockReport = createMockReportDefinition();
                vi.mocked(mockRepository.findReportDefinitionByCode).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.incrementViewCount).mockResolvedValue(undefined);

                const result = await service.getReportDefinitionByCode('RPT-TAB-001');

                expect(result).toEqual(mockReport);
            });

            it('should throw ReportNotFoundError when not found', async () => {
                vi.mocked(mockRepository.findReportDefinitionByCode).mockResolvedValue(null);

                await expect(service.getReportDefinitionByCode('NONEXISTENT')).rejects.toThrow(ReportNotFoundError);
            });
        });

        describe('createReportDefinition', () => {
            it('should create a new report', async () => {
                const mockReport = createMockReportDefinition();
                vi.mocked(mockRepository.createReportDefinition).mockResolvedValue(mockReport);

                const result = await service.createReportDefinition({
                    name: 'Asset List Report',
                    reportType: 'tabular',
                    dataSource: 'assets',
                    fields: ['asset_tag', 'name'],
                });

                expect(result).toEqual(mockReport);
            });

            it('should throw error for scheduled report without cron', async () => {
                await expect(
                    service.createReportDefinition({
                        name: 'Test',
                        reportType: 'scheduled',
                        dataSource: 'assets',
                        fields: ['name'],
                        isScheduled: true,
                    })
                ).rejects.toThrow('Schedule cron expression is required');
            });

            it('should throw error for scheduled report without recipients', async () => {
                await expect(
                    service.createReportDefinition({
                        name: 'Test',
                        reportType: 'scheduled',
                        dataSource: 'assets',
                        fields: ['name'],
                        isScheduled: true,
                        scheduleCron: '0 0 * * *',
                    })
                ).rejects.toThrow('At least one recipient is required');
            });
        });

        describe('updateReportDefinition', () => {
            it('should update report', async () => {
                const mockReport = createMockReportDefinition();
                const updatedReport = { ...mockReport, name: 'Updated Report' };
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.updateReportDefinition).mockResolvedValue(updatedReport);

                const result = await service.updateReportDefinition('123e4567-e89b-12d3-a456-426614174000', {
                    name: 'Updated Report',
                });

                expect(result.name).toBe('Updated Report');
            });

            it('should throw error when trying to modify builtin report', async () => {
                const builtinReport = createMockReportDefinition({ isBuiltin: true });
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(builtinReport);

                await expect(
                    service.updateReportDefinition('123e4567-e89b-12d3-a456-426614174000', { name: 'New Name' })
                ).rejects.toThrow(BuiltinModificationError);
            });

            it('should allow changing favorite status for builtin report', async () => {
                const builtinReport = createMockReportDefinition({ isBuiltin: true });
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(builtinReport);
                vi.mocked(mockRepository.updateReportDefinition).mockResolvedValue({ ...builtinReport, isFavorite: true });

                const result = await service.updateReportDefinition('123e4567-e89b-12d3-a456-426614174000', {
                    isFavorite: true,
                });

                expect(result.isFavorite).toBe(true);
            });
        });

        describe('deleteReportDefinition', () => {
            it('should delete report', async () => {
                const mockReport = createMockReportDefinition();
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.deleteReportDefinition).mockResolvedValue(true);

                const result = await service.deleteReportDefinition('123e4567-e89b-12d3-a456-426614174000');

                expect(result).toBe(true);
            });

            it('should throw error when trying to delete builtin report', async () => {
                const builtinReport = createMockReportDefinition({ isBuiltin: true });
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(builtinReport);

                await expect(service.deleteReportDefinition('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(
                    BuiltinModificationError
                );
            });
        });

        describe('toggleReportFavorite', () => {
            it('should toggle favorite status', async () => {
                const mockReport = createMockReportDefinition({ isFavorite: false });
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.updateReportDefinition).mockResolvedValue({ ...mockReport, isFavorite: true });

                const result = await service.toggleReportFavorite('123e4567-e89b-12d3-a456-426614174000', 'user-123');

                expect(result.isFavorite).toBe(true);
                expect(mockRepository.updateReportDefinition).toHaveBeenCalledWith(
                    '123e4567-e89b-12d3-a456-426614174000',
                    { isFavorite: true, updatedBy: 'user-123' }
                );
            });
        });
    });

    // ==================== REPORT EXECUTIONS ====================

    describe('Report Executions', () => {
        describe('getAllReportExecutions', () => {
            it('should return paginated executions', async () => {
                const mockResult: PaginatedResult<ReportExecution> = {
                    data: [createMockReportExecution()],
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                };
                vi.mocked(mockRepository.findAllReportExecutions).mockResolvedValue(mockResult);

                const result = await service.getAllReportExecutions({ page: 1, limit: 20 });

                expect(result).toEqual(mockResult);
            });
        });

        describe('getReportExecutionById', () => {
            it('should return execution when found', async () => {
                const mockExecution = createMockReportExecution();
                vi.mocked(mockRepository.findReportExecutionById).mockResolvedValue(mockExecution);

                const result = await service.getReportExecutionById('223e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockExecution);
            });

            it('should throw error when not found', async () => {
                vi.mocked(mockRepository.findReportExecutionById).mockResolvedValue(null);

                await expect(service.getReportExecutionById('nonexistent')).rejects.toThrow(ReportNotFoundError);
            });
        });

        describe('executeReport', () => {
            it('should execute report and return result', async () => {
                const mockReport = createMockReportDefinition();
                const mockExecution = createMockReportExecution({ status: 'running' });
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.createReportExecution).mockResolvedValue(mockExecution);
                vi.mocked(mockRepository.updateReportExecution).mockResolvedValue({ ...mockExecution, status: 'completed' });

                const result = await service.executeReport('123e4567-e89b-12d3-a456-426614174000');

                expect(result.status).toBe('completed');
                expect(mockRepository.createReportExecution).toHaveBeenCalled();
                expect(mockRepository.updateReportExecution).toHaveBeenCalled();
            });

            it('should throw error when report not found', async () => {
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(null);

                await expect(service.executeReport('nonexistent')).rejects.toThrow(ReportNotFoundError);
            });
        });

        describe('runScheduledReports', () => {
            it('should process scheduled reports', async () => {
                const mockReport = createMockReportDefinition({ isScheduled: true, scheduleCron: '0 0 * * *' });
                vi.mocked(mockRepository.findScheduledReportsDue).mockResolvedValue([mockReport]);
                // executeReport calls findReportDefinitionById, so mock it
                vi.mocked(mockRepository.findReportDefinitionById).mockResolvedValue(mockReport);
                vi.mocked(mockRepository.createReportExecution).mockResolvedValue(createMockReportExecution());
                vi.mocked(mockRepository.updateReportExecution).mockResolvedValue(createMockReportExecution());
                vi.mocked(mockRepository.updateReportSchedule).mockResolvedValue(undefined);

                const result = await service.runScheduledReports();

                expect(result.processed).toBe(1);
                expect(result.successful).toBe(1);
                expect(result.failed).toBe(0);
            });
        });
    });

    // ==================== ALERT RULES ====================

    describe('Alert Rules', () => {
        describe('getAllAlertRules', () => {
            it('should return paginated rules', async () => {
                const mockResult: PaginatedResult<AlertRuleWithStats> = {
                    data: [createMockAlertRule()],
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                };
                vi.mocked(mockRepository.findAllAlertRules).mockResolvedValue(mockResult);

                const result = await service.getAllAlertRules({ page: 1, limit: 20 });

                expect(result).toEqual(mockResult);
            });
        });

        describe('getAlertRuleById', () => {
            it('should return rule when found', async () => {
                const mockRule = createMockAlertRule();
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(mockRule);

                const result = await service.getAlertRuleById('323e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockRule);
            });

            it('should throw error when not found', async () => {
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(null);

                await expect(service.getAlertRuleById('nonexistent')).rejects.toThrow(AlertRuleNotFoundError);
            });
        });

        describe('createAlertRule', () => {
            it('should create alert rule', async () => {
                const mockRule = createMockAlertRule();
                vi.mocked(mockRepository.createAlertRule).mockResolvedValue(mockRule);

                const result = await service.createAlertRule({
                    name: 'License Expiring Soon',
                    ruleType: 'license',
                    conditionField: 'expiry_date',
                    conditionOperator: 'lte',
                    conditionValue: { days: 30 },
                    recipients: ['user@example.com'],
                });

                expect(result).toEqual(mockRule);
            });

            it('should throw error without condition', async () => {
                await expect(
                    service.createAlertRule({
                        name: 'Test',
                        ruleType: 'license',
                        conditionField: '',
                        conditionOperator: 'eq',
                        conditionValue: {},
                    })
                ).rejects.toThrow('Condition field, operator, and value are required');
            });

            it('should throw error without recipients', async () => {
                await expect(
                    service.createAlertRule({
                        name: 'Test',
                        ruleType: 'license',
                        conditionField: 'expiry_date',
                        conditionOperator: 'lte',
                        conditionValue: { days: 30 },
                    })
                ).rejects.toThrow('At least one recipient or recipient role is required');
            });
        });

        describe('updateAlertRule', () => {
            it('should update rule', async () => {
                const mockRule = createMockAlertRule();
                const updatedRule = { ...mockRule, name: 'Updated Rule' };
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(mockRule);
                vi.mocked(mockRepository.updateAlertRule).mockResolvedValue(updatedRule);

                const result = await service.updateAlertRule('323e4567-e89b-12d3-a456-426614174000', {
                    name: 'Updated Rule',
                });

                expect(result.name).toBe('Updated Rule');
            });

            it('should throw error when modifying builtin rule condition', async () => {
                const builtinRule = createMockAlertRule({ isBuiltin: true });
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(builtinRule);

                await expect(
                    service.updateAlertRule('323e4567-e89b-12d3-a456-426614174000', {
                        conditionValue: { days: 60 },
                    })
                ).rejects.toThrow(BuiltinModificationError);
            });

            it('should allow updating recipients for builtin rule', async () => {
                const builtinRule = createMockAlertRule({ isBuiltin: true });
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(builtinRule);
                vi.mocked(mockRepository.updateAlertRule).mockResolvedValue({
                    ...builtinRule,
                    recipients: ['new@example.com'],
                });

                const result = await service.updateAlertRule('323e4567-e89b-12d3-a456-426614174000', {
                    recipients: ['new@example.com'],
                });

                expect(result.recipients).toContain('new@example.com');
            });
        });

        describe('deleteAlertRule', () => {
            it('should delete rule', async () => {
                const mockRule = createMockAlertRule();
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(mockRule);
                vi.mocked(mockRepository.deleteAlertRule).mockResolvedValue(true);

                const result = await service.deleteAlertRule('323e4567-e89b-12d3-a456-426614174000');

                expect(result).toBe(true);
            });

            it('should throw error when deleting builtin rule', async () => {
                const builtinRule = createMockAlertRule({ isBuiltin: true });
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(builtinRule);

                await expect(service.deleteAlertRule('323e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(
                    BuiltinModificationError
                );
            });
        });

        describe('toggleAlertRule', () => {
            it('should toggle active status', async () => {
                const mockRule = createMockAlertRule({ isActive: true });
                vi.mocked(mockRepository.findAlertRuleById).mockResolvedValue(mockRule);
                vi.mocked(mockRepository.updateAlertRule).mockResolvedValue({ ...mockRule, isActive: false });

                const result = await service.toggleAlertRule('323e4567-e89b-12d3-a456-426614174000', 'user-123');

                expect(result.isActive).toBe(false);
            });
        });
    });

    // ==================== ALERT TRIGGERING ====================

    describe('Alert Triggering', () => {
        describe('checkAndTriggerAlerts', () => {
            it('should check all active rules when no options provided', async () => {
                const mockRule = createMockAlertRule();
                vi.mocked(mockRepository.findActiveAlertRules).mockResolvedValue([mockRule]);
                vi.mocked(mockRepository.checkCooldown).mockResolvedValue(true);

                const results = await service.checkAndTriggerAlerts();

                expect(mockRepository.findActiveAlertRules).toHaveBeenCalled();
                expect(results).toHaveLength(1);
            });

            it('should respect cooldown', async () => {
                const mockRule = createMockAlertRule();
                vi.mocked(mockRepository.findActiveAlertRules).mockResolvedValue([mockRule]);
                vi.mocked(mockRepository.checkCooldown).mockResolvedValue(false);

                const results = await service.checkAndTriggerAlerts();

                expect(results[0].cooldownActive).toBe(true);
                expect(results[0].triggered).toBe(false);
            });

            it('should bypass cooldown when force is true', async () => {
                const mockRule = createMockAlertRule();
                vi.mocked(mockRepository.findActiveAlertRules).mockResolvedValue([mockRule]);

                const results = await service.checkAndTriggerAlerts({ force: true });

                expect(mockRepository.checkCooldown).not.toHaveBeenCalled();
                expect(results).toHaveLength(1);
            });
        });
    });

    // ==================== ALERT HISTORY ====================

    describe('Alert History', () => {
        describe('getAllAlertHistory', () => {
            it('should return paginated history', async () => {
                const mockResult: PaginatedResult<AlertHistoryWithRule> = {
                    data: [createMockAlertHistory()],
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                };
                vi.mocked(mockRepository.findAllAlertHistory).mockResolvedValue(mockResult);

                const result = await service.getAllAlertHistory({ page: 1, limit: 20 });

                expect(result).toEqual(mockResult);
            });
        });

        describe('getAlertHistoryById', () => {
            it('should return alert when found', async () => {
                const mockAlert = createMockAlertHistory();
                vi.mocked(mockRepository.findAlertHistoryById).mockResolvedValue(mockAlert);

                const result = await service.getAlertHistoryById('423e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockAlert);
            });

            it('should throw error when not found', async () => {
                vi.mocked(mockRepository.findAlertHistoryById).mockResolvedValue(null);

                await expect(service.getAlertHistoryById('nonexistent')).rejects.toThrow(AlertHistoryNotFoundError);
            });
        });

        describe('acknowledgeAlert', () => {
            it('should acknowledge alert', async () => {
                const mockAlert = createMockAlertHistory();
                vi.mocked(mockRepository.findAlertHistoryById).mockResolvedValue(mockAlert);
                vi.mocked(mockRepository.acknowledgeAlert).mockResolvedValue({ ...mockAlert, isAcknowledged: true });

                const result = await service.acknowledgeAlert('423e4567-e89b-12d3-a456-426614174000', {
                    acknowledgedBy: 'user-123',
                });

                expect(result.isAcknowledged).toBe(true);
            });

            it('should throw error when already acknowledged', async () => {
                const acknowledgedAlert = createMockAlertHistory({ isAcknowledged: true });
                vi.mocked(mockRepository.findAlertHistoryById).mockResolvedValue(acknowledgedAlert);

                await expect(
                    service.acknowledgeAlert('423e4567-e89b-12d3-a456-426614174000', { acknowledgedBy: 'user-123' })
                ).rejects.toThrow('already acknowledged');
            });
        });

        describe('bulkAcknowledgeAlerts', () => {
            it('should acknowledge multiple alerts', async () => {
                vi.mocked(mockRepository.bulkAcknowledgeAlerts).mockResolvedValue(3);

                const result = await service.bulkAcknowledgeAlerts(['id1', 'id2', 'id3'], {
                    acknowledgedBy: 'user-123',
                });

                expect(result.acknowledged).toBe(3);
            });
        });
    });

    // ==================== USER ALERT PREFERENCES ====================

    describe('User Alert Preferences', () => {
        describe('getUserAlertPreferences', () => {
            it('should return preferences when found', async () => {
                const mockPrefs = createMockUserPreferences();
                vi.mocked(mockRepository.findUserAlertPreferences).mockResolvedValue(mockPrefs);

                const result = await service.getUserAlertPreferences('723e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockPrefs);
            });

            it('should return null when not found', async () => {
                vi.mocked(mockRepository.findUserAlertPreferences).mockResolvedValue(null);

                const result = await service.getUserAlertPreferences('nonexistent');

                expect(result).toBeNull();
            });
        });

        describe('muteAlertRule', () => {
            it('should add rule to muted list', async () => {
                const mockPrefs = createMockUserPreferences({ mutedRules: [] });
                vi.mocked(mockRepository.findUserAlertPreferences).mockResolvedValue(mockPrefs);
                vi.mocked(mockRepository.upsertUserAlertPreferences).mockResolvedValue({
                    ...mockPrefs,
                    mutedRules: ['rule-123'],
                });

                const result = await service.muteAlertRule('723e4567-e89b-12d3-a456-426614174000', 'rule-123');

                expect(result.mutedRules).toContain('rule-123');
            });
        });

        describe('unmuteAlertRule', () => {
            it('should remove rule from muted list', async () => {
                const mockPrefs = createMockUserPreferences({ mutedRules: ['rule-123', 'rule-456'] });
                vi.mocked(mockRepository.findUserAlertPreferences).mockResolvedValue(mockPrefs);
                vi.mocked(mockRepository.upsertUserAlertPreferences).mockResolvedValue({
                    ...mockPrefs,
                    mutedRules: ['rule-456'],
                });

                const result = await service.unmuteAlertRule('723e4567-e89b-12d3-a456-426614174000', 'rule-123');

                expect(result.mutedRules).not.toContain('rule-123');
            });
        });
    });

    // ==================== DASHBOARD WIDGETS ====================

    describe('Dashboard Widgets', () => {
        describe('getAllDashboardWidgets', () => {
            it('should return paginated widgets', async () => {
                const mockResult: PaginatedResult<DashboardWidget> = {
                    data: [createMockDashboardWidget()],
                    total: 1,
                    page: 1,
                    limit: 20,
                    totalPages: 1,
                };
                vi.mocked(mockRepository.findAllDashboardWidgets).mockResolvedValue(mockResult);

                const result = await service.getAllDashboardWidgets({ page: 1, limit: 20 });

                expect(result).toEqual(mockResult);
            });
        });

        describe('getDashboardWidgetById', () => {
            it('should return widget when found', async () => {
                const mockWidget = createMockDashboardWidget();
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(mockWidget);

                const result = await service.getDashboardWidgetById('523e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockWidget);
            });

            it('should throw error when not found', async () => {
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(null);

                await expect(service.getDashboardWidgetById('nonexistent')).rejects.toThrow(WidgetNotFoundError);
            });
        });

        describe('createDashboardWidget', () => {
            it('should create widget', async () => {
                const mockWidget = createMockDashboardWidget();
                vi.mocked(mockRepository.createDashboardWidget).mockResolvedValue(mockWidget);

                const result = await service.createDashboardWidget({
                    name: 'Assets by Status',
                    widgetType: 'pie_chart',
                    dataSource: 'assets',
                });

                expect(result).toEqual(mockWidget);
            });
        });

        describe('updateDashboardWidget', () => {
            it('should update widget', async () => {
                const mockWidget = createMockDashboardWidget();
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(mockWidget);
                vi.mocked(mockRepository.updateDashboardWidget).mockResolvedValue({ ...mockWidget, name: 'Updated' });

                const result = await service.updateDashboardWidget('523e4567-e89b-12d3-a456-426614174000', {
                    name: 'Updated',
                });

                expect(result.name).toBe('Updated');
            });

            it('should throw error when modifying builtin widget', async () => {
                const builtinWidget = createMockDashboardWidget({ isBuiltin: true });
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(builtinWidget);

                await expect(
                    service.updateDashboardWidget('523e4567-e89b-12d3-a456-426614174000', { name: 'New Name' })
                ).rejects.toThrow(BuiltinModificationError);
            });
        });

        describe('deleteDashboardWidget', () => {
            it('should delete widget', async () => {
                const mockWidget = createMockDashboardWidget();
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(mockWidget);
                vi.mocked(mockRepository.deleteDashboardWidget).mockResolvedValue(true);

                const result = await service.deleteDashboardWidget('523e4567-e89b-12d3-a456-426614174000');

                expect(result).toBe(true);
            });

            it('should throw error when deleting builtin widget', async () => {
                const builtinWidget = createMockDashboardWidget({ isBuiltin: true });
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(builtinWidget);

                await expect(service.deleteDashboardWidget('523e4567-e89b-12d3-a456-426614174000')).rejects.toThrow(
                    BuiltinModificationError
                );
            });
        });
    });

    // ==================== USER DASHBOARD LAYOUTS ====================

    describe('User Dashboard Layouts', () => {
        describe('getUserDashboardLayout', () => {
            it('should return layout when found', async () => {
                const mockLayout = createMockDashboardLayout();
                vi.mocked(mockRepository.findUserDashboardLayout).mockResolvedValue(mockLayout);

                const result = await service.getUserDashboardLayout('723e4567-e89b-12d3-a456-426614174000');

                expect(result).toEqual(mockLayout);
            });
        });

        describe('saveUserDashboardLayout', () => {
            it('should save layout', async () => {
                const mockLayout = createMockDashboardLayout();
                const mockWidget = createMockDashboardWidget();
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(mockWidget);
                vi.mocked(mockRepository.saveUserDashboardLayout).mockResolvedValue(mockLayout);

                const result = await service.saveUserDashboardLayout({
                    userId: '723e4567-e89b-12d3-a456-426614174000',
                    layout: [{ widgetId: '523e4567-e89b-12d3-a456-426614174000', x: 0, y: 0, w: 2, h: 2 }],
                });

                expect(result).toEqual(mockLayout);
            });

            it('should throw error for invalid widget in layout', async () => {
                vi.mocked(mockRepository.findDashboardWidgetById).mockResolvedValue(null);

                await expect(
                    service.saveUserDashboardLayout({
                        userId: '723e4567-e89b-12d3-a456-426614174000',
                        layout: [{ widgetId: 'nonexistent', x: 0, y: 0, w: 2, h: 2 }],
                    })
                ).rejects.toThrow(WidgetNotFoundError);
            });
        });
    });

    // ==================== STATISTICS ====================

    describe('Statistics', () => {
        describe('getReportStats', () => {
            it('should return report statistics', async () => {
                const mockStats = {
                    totalReports: 10,
                    builtinReports: 5,
                    customReports: 5,
                    scheduledReports: 3,
                    executionsToday: 15,
                };
                vi.mocked(mockRepository.getReportStats).mockResolvedValue(mockStats);

                const result = await service.getReportStats();

                expect(result).toEqual(mockStats);
            });
        });

        describe('getAlertStats', () => {
            it('should return alert statistics', async () => {
                const mockStats = {
                    totalRules: 13,
                    activeRules: 10,
                    alertsToday: 5,
                    unacknowledgedAlerts: 3,
                    criticalAlerts: 1,
                };
                vi.mocked(mockRepository.getAlertStats).mockResolvedValue(mockStats);

                const result = await service.getAlertStats();

                expect(result).toEqual(mockStats);
            });
        });

        describe('getDashboardStats', () => {
            it('should return combined statistics', async () => {
                const reportStats = {
                    totalReports: 10,
                    builtinReports: 5,
                    customReports: 5,
                    scheduledReports: 3,
                    executionsToday: 15,
                };
                const alertStats = {
                    totalRules: 13,
                    activeRules: 10,
                    alertsToday: 5,
                    unacknowledgedAlerts: 3,
                    criticalAlerts: 1,
                };
                vi.mocked(mockRepository.getReportStats).mockResolvedValue(reportStats);
                vi.mocked(mockRepository.getAlertStats).mockResolvedValue(alertStats);

                const result = await service.getDashboardStats();

                expect(result.reportStats).toEqual(reportStats);
                expect(result.alertStats).toEqual(alertStats);
            });
        });
    });
});
