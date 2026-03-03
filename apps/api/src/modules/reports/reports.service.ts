// =============================================
// Module: Reports & Alerts (10-REPORTS)
// Service Layer - Business Logic
// =============================================

import { Pool } from 'pg';
import { ReportsRepository } from './index.js';
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
    ReportExecutionResult,
    AlertTriggerResult,
    AlertCheckResult,
} from './reports.types.js';

// ==================== ERROR CLASSES ====================

export class ReportNotFoundError extends Error {
    constructor(identifier: string) {
        super(`Report not found: ${identifier}`);
        this.name = 'ReportNotFoundError';
    }
}

export class AlertRuleNotFoundError extends Error {
    constructor(identifier: string) {
        super(`Alert rule not found: ${identifier}`);
        this.name = 'AlertRuleNotFoundError';
    }
}

export class AlertHistoryNotFoundError extends Error {
    constructor(id: string) {
        super(`Alert history not found: ${id}`);
        this.name = 'AlertHistoryNotFoundError';
    }
}

export class WidgetNotFoundError extends Error {
    constructor(identifier: string) {
        super(`Dashboard widget not found: ${identifier}`);
        this.name = 'WidgetNotFoundError';
    }
}

export class BuiltinModificationError extends Error {
    constructor(type: string) {
        super(`Cannot modify or delete built-in ${type}`);
        this.name = 'BuiltinModificationError';
    }
}

export class ReportExportLimitError extends Error {
    constructor(rowCount: number, limit: number) {
        super(`Export limit exceeded: ${rowCount} rows exceeds limit of ${limit}`);
        this.name = 'ReportExportLimitError';
    }
}

export class AlertCooldownActiveError extends Error {
    constructor(ruleId: string, cooldownHours: number) {
        super(`Alert cooldown active for rule ${ruleId}: ${cooldownHours} hours`);
        this.name = 'AlertCooldownActiveError';
    }
}

// ==================== SERVICE CLASS ====================

export class ReportsService {
    constructor(
        private repository: ReportsRepository,
        private pool: Pool
    ) { }

    // ==================== REPORT DEFINITIONS ====================

    async getAllReportDefinitions(query: ReportDefinitionQuery): Promise<PaginatedResult<ReportDefinitionWithStats>> {
        return this.repository.findAllReportDefinitions(query);
    }

    async getReportDefinitionById(id: string): Promise<ReportDefinitionWithStats> {
        const report = await this.repository.findReportDefinitionById(id);
        if (!report) {
            throw new ReportNotFoundError(id);
        }
        // Increment view count
        await this.repository.incrementViewCount(id);
        return report;
    }

    async getReportDefinitionByCode(code: string): Promise<ReportDefinitionWithStats> {
        const report = await this.repository.findReportDefinitionByCode(code);
        if (!report) {
            throw new ReportNotFoundError(code);
        }
        await this.repository.incrementViewCount(report.id);
        return report;
    }

    async createReportDefinition(dto: CreateReportDefinitionDto): Promise<ReportDefinition> {
        // Validate report type specific requirements
        if (dto.reportType === 'chart' && !dto.chartConfig) {
            dto.chartConfig = {};
        }

        if (dto.isScheduled) {
            // Validate schedule configuration
            if (!dto.scheduleCron) {
                throw new Error('Schedule cron expression is required for scheduled reports');
            }
            if (!dto.scheduleRecipients || dto.scheduleRecipients.length === 0) {
                throw new Error('At least one recipient is required for scheduled reports');
            }
        }

        return this.repository.createReportDefinition(dto);
    }

    async updateReportDefinition(id: string, dto: UpdateReportDefinitionDto): Promise<ReportDefinition> {
        const existing = await this.repository.findReportDefinitionById(id);
        if (!existing) {
            throw new ReportNotFoundError(id);
        }

        // Built-in reports can have limited modifications
        if (existing.isBuiltin) {
            // Only allow changing favorite status for built-in reports
            const allowedFields = ['isFavorite', 'updatedBy'];
            const hasDisallowedFields = Object.keys(dto).some(
                key => !allowedFields.includes(key) && dto[key as keyof UpdateReportDefinitionDto] !== undefined
            );
            if (hasDisallowedFields) {
                throw new BuiltinModificationError('report');
            }
        }

        // Validate schedule if being enabled
        if (dto.isScheduled === true) {
            const scheduleCron = dto.scheduleCron ?? existing.scheduleCron;
            const scheduleRecipients = dto.scheduleRecipients ?? existing.scheduleRecipients;

            if (!scheduleCron) {
                throw new Error('Schedule cron expression is required for scheduled reports');
            }
            if (!scheduleRecipients || scheduleRecipients.length === 0) {
                throw new Error('At least one recipient is required for scheduled reports');
            }
        }

        const updated = await this.repository.updateReportDefinition(id, dto);
        if (!updated) {
            throw new ReportNotFoundError(id);
        }
        return updated;
    }

    async deleteReportDefinition(id: string): Promise<boolean> {
        const existing = await this.repository.findReportDefinitionById(id);
        if (!existing) {
            throw new ReportNotFoundError(id);
        }

        if (existing.isBuiltin) {
            throw new BuiltinModificationError('report');
        }

        return this.repository.deleteReportDefinition(id);
    }

    async toggleReportFavorite(id: string, userId: string): Promise<ReportDefinition> {
        const existing = await this.repository.findReportDefinitionById(id);
        if (!existing) {
            throw new ReportNotFoundError(id);
        }

        const updated = await this.repository.updateReportDefinition(id, {
            isFavorite: !existing.isFavorite,
            updatedBy: userId,
        });

        if (!updated) {
            throw new ReportNotFoundError(id);
        }
        return updated;
    }

    // ==================== REPORT EXECUTIONS ====================

    async getAllReportExecutions(query: ReportExecutionQuery): Promise<PaginatedResult<ReportExecution>> {
        return this.repository.findAllReportExecutions(query);
    }

    async getReportExecutionById(id: string): Promise<ReportExecution> {
        const execution = await this.repository.findReportExecutionById(id);
        if (!execution) {
            throw new ReportNotFoundError(`execution:${id}`);
        }
        return execution;
    }

    async executeReport(reportId: string, options: {
        filters?: Record<string, unknown>;
        format?: 'excel' | 'pdf' | 'csv';
        executedBy?: string;
    } = {}): Promise<ReportExecutionResult> {
        const report = await this.repository.findReportDefinitionById(reportId);
        if (!report) {
            throw new ReportNotFoundError(reportId);
        }

        // Create execution record
        const execution = await this.repository.createReportExecution({
            reportId,
            executionType: 'manual',
            filtersUsed: options.filters || {},
            executedBy: options.executedBy,
        });

        const startTime = Date.now();

        try {
            // In a real implementation, this would execute the actual report query
            // For now, we simulate the execution
            const mockData: Record<string, unknown>[] = [];
            const rowCount = mockData.length;

            // RPT-R02: Export limit warning > 10,000 rows
            const EXPORT_LIMIT = 10000;
            if (options.format && rowCount > EXPORT_LIMIT) {
                throw new ReportExportLimitError(rowCount, EXPORT_LIMIT);
            }

            const durationMs = Date.now() - startTime;

            // Update execution with results
            await this.repository.updateReportExecution(execution.id, {
                status: 'completed',
                rowCount,
                completedAt: new Date(),
                durationMs,
                fileFormat: options.format,
            });

            return {
                executionId: execution.id,
                reportId,
                status: 'completed',
                data: mockData,
                rowCount,
                columns: report.fields.map((field: any) => ({ key: field, label: field })),
                durationMs,
            };
        } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await this.repository.updateReportExecution(execution.id, {
                status: 'failed',
                completedAt: new Date(),
                durationMs,
                errorMessage,
            });

            throw error;
        }
    }

    async runScheduledReports(): Promise<{ processed: number; successful: number; failed: number }> {
        const dueReports = await this.repository.findScheduledReportsDue();
        let successful = 0;
        let failed = 0;

        for (const report of dueReports) {
            try {
                await this.executeReport(report.id, {
                    format: report.scheduleFormat,
                });

                // Calculate next run time
                const nextRunAt = this.calculateNextRun(report.scheduleCron || '0 0 * * *');
                await this.repository.updateReportSchedule(report.id, new Date(), nextRunAt);

                successful++;
            } catch {
                failed++;
            }
        }

        return {
            processed: dueReports.length,
            successful,
            failed,
        };
    }

    private calculateNextRun(cron: string): Date {
        // Simplified cron calculation
        const now = new Date();
        if (cron.includes('0 0 * * *')) {
            // Daily
            now.setDate(now.getDate() + 1);
            now.setHours(0, 0, 0, 0);
        } else if (cron.includes('0 0 * * 1')) {
            // Weekly Monday
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
            now.setDate(now.getDate() + daysUntilMonday);
            now.setHours(0, 0, 0, 0);
        } else if (cron.includes('0 0 1 * *')) {
            // Monthly 1st
            now.setMonth(now.getMonth() + 1);
            now.setDate(1);
            now.setHours(0, 0, 0, 0);
        } else {
            // Default: daily
            now.setDate(now.getDate() + 1);
            now.setHours(0, 0, 0, 0);
        }
        return now;
    }

    // ==================== ALERT RULES ====================

    async getAllAlertRules(query: AlertRuleQuery): Promise<PaginatedResult<AlertRuleWithStats>> {
        return this.repository.findAllAlertRules(query);
    }

    async getAlertRuleById(id: string): Promise<AlertRuleWithStats> {
        const rule = await this.repository.findAlertRuleById(id);
        if (!rule) {
            throw new AlertRuleNotFoundError(id);
        }
        return rule;
    }

    async getAlertRuleByCode(code: string): Promise<AlertRuleWithStats> {
        const rule = await this.repository.findAlertRuleByCode(code);
        if (!rule) {
            throw new AlertRuleNotFoundError(code);
        }
        return rule;
    }

    async getActiveAlertRules(): Promise<AlertRule[]> {
        return this.repository.findActiveAlertRules();
    }

    async getAlertRulesByType(ruleType: string): Promise<AlertRule[]> {
        return this.repository.findAlertRulesByType(ruleType);
    }

    async createAlertRule(dto: CreateAlertRuleDto): Promise<AlertRule> {
        // Validate condition configuration
        if (!dto.conditionField || !dto.conditionOperator || !dto.conditionValue) {
            throw new Error('Condition field, operator, and value are required');
        }

        // Validate recipients
        if ((!dto.recipients || dto.recipients.length === 0) &&
            (!dto.recipientRoles || dto.recipientRoles.length === 0)) {
            throw new Error('At least one recipient or recipient role is required');
        }

        return this.repository.createAlertRule(dto);
    }

    async updateAlertRule(id: string, dto: UpdateAlertRuleDto): Promise<AlertRule> {
        const existing = await this.repository.findAlertRuleById(id);
        if (!existing) {
            throw new AlertRuleNotFoundError(id);
        }

        // Built-in rules can have limited modifications
        if (existing.isBuiltin) {
            const allowedFields = ['isActive', 'recipients', 'recipientRoles', 'cooldownHours', 'updatedBy'];
            const hasDisallowedFields = Object.keys(dto).some(
                key => !allowedFields.includes(key) && dto[key as keyof UpdateAlertRuleDto] !== undefined
            );
            if (hasDisallowedFields) {
                throw new BuiltinModificationError('alert rule');
            }
        }

        const updated = await this.repository.updateAlertRule(id, dto);
        if (!updated) {
            throw new AlertRuleNotFoundError(id);
        }
        return updated;
    }

    async deleteAlertRule(id: string): Promise<boolean> {
        const existing = await this.repository.findAlertRuleById(id);
        if (!existing) {
            throw new AlertRuleNotFoundError(id);
        }

        if (existing.isBuiltin) {
            throw new BuiltinModificationError('alert rule');
        }

        return this.repository.deleteAlertRule(id);
    }

    async toggleAlertRule(id: string, userId: string): Promise<AlertRule> {
        const existing = await this.repository.findAlertRuleById(id);
        if (!existing) {
            throw new AlertRuleNotFoundError(id);
        }

        const updated = await this.repository.updateAlertRule(id, {
            isActive: !existing.isActive,
            updatedBy: userId,
        });

        if (!updated) {
            throw new AlertRuleNotFoundError(id);
        }
        return updated;
    }

    // ==================== ALERT TRIGGERING ====================

    async checkAndTriggerAlerts(options: {
        ruleIds?: string[];
        ruleTypes?: string[];
        force?: boolean;
    } = {}): Promise<AlertTriggerResult[]> {
        let rules: AlertRule[];

        if (options.ruleIds && options.ruleIds.length > 0) {
            // Get specific rules
            const rulePromises = options.ruleIds.map(id => this.repository.findAlertRuleById(id));
            const results = await Promise.all(rulePromises);
            rules = results.filter((r: any): r is AlertRule => r !== null && r.isActive);
        } else if (options.ruleTypes && options.ruleTypes.length > 0) {
            // Get rules by types
            const typePromises = options.ruleTypes.map(type => this.repository.findAlertRulesByType(type));
            const results = await Promise.all(typePromises);
            rules = results.flat();
        } else {
            // Get all active rules
            rules = await this.repository.findActiveAlertRules();
        }

        const triggerResults: AlertTriggerResult[] = [];

        for (const rule of rules) {
            try {
                const result = await this.triggerAlert(rule, options.force || false);
                triggerResults.push(result);
            } catch (error) {
                triggerResults.push({
                    alertId: '',
                    ruleId: rule.id,
                    triggered: false,
                    affectedItems: 0,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    notificationsSent: 0,
                });
            }
        }

        return triggerResults;
    }

    private async triggerAlert(rule: AlertRule, force: boolean): Promise<AlertTriggerResult> {
        // ALR-R01: Check cooldown
        if (!force) {
            const canSend = await this.repository.checkCooldown(rule.id, rule.cooldownHours);
            if (!canSend) {
                return {
                    alertId: '',
                    ruleId: rule.id,
                    triggered: false,
                    affectedItems: 0,
                    message: 'Cooldown active',
                    notificationsSent: 0,
                    cooldownActive: true,
                };
            }
        }

        // Check condition (in real implementation, this would query the relevant data)
        const checkResult = await this.checkAlertCondition(rule);

        if (!checkResult.conditionMet || checkResult.affectedCount === 0) {
            return {
                alertId: '',
                ruleId: rule.id,
                triggered: false,
                affectedItems: 0,
                message: 'Condition not met',
                notificationsSent: 0,
            };
        }

        // Create alert history
        const title = `${rule.name}`;
        const message = `${checkResult.affectedCount} item(s) match the alert condition`;

        const alertHistory = await this.repository.createAlertHistory({
            ruleId: rule.id,
            triggerData: { items: checkResult.items },
            affectedCount: checkResult.affectedCount,
            title,
            message,
            severity: rule.severity,
            channelUsed: rule.channel,
        });

        // Update rule trigger stats
        await this.repository.updateAlertRuleLastTriggered(rule.id);

        // Send notifications (in real implementation)
        const notificationsSent = await this.sendAlertNotifications(alertHistory, rule);

        // Update delivery status
        await this.repository.updateAlertDeliveryStatus(
            alertHistory.id,
            notificationsSent > 0 ? 'sent' : 'failed'
        );

        return {
            alertId: alertHistory.id,
            ruleId: rule.id,
            triggered: true,
            affectedItems: checkResult.affectedCount,
            message: title,
            notificationsSent,
        };
    }

    private async checkAlertCondition(rule: AlertRule): Promise<AlertCheckResult> {
        // In real implementation, this would execute the condition query
        // For now, return mock data
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            conditionMet: false, // Default to not met for safety
            affectedCount: 0,
            items: [],
        };
    }

    private async sendAlertNotifications(alert: AlertHistory, rule: AlertRule): Promise<number> {
        // In real implementation, this would send emails and/or in-app notifications
        // For now, return mock count
        const recipientCount = rule.recipients.length;
        return recipientCount;
    }

    // ==================== ALERT HISTORY ====================

    async getAllAlertHistory(query: AlertHistoryQuery): Promise<PaginatedResult<AlertHistoryWithRule>> {
        return this.repository.findAllAlertHistory(query);
    }

    async getAlertHistoryById(id: string): Promise<AlertHistoryWithRule> {
        const alert = await this.repository.findAlertHistoryById(id);
        if (!alert) {
            throw new AlertHistoryNotFoundError(id);
        }
        return alert;
    }

    async getUnacknowledgedAlerts(organizationId?: string): Promise<AlertHistoryWithRule[]> {
        if (!organizationId) {
            throw new Error('Organization ID is required');
        }
        return this.repository.findUnacknowledgedAlerts(organizationId);
    }

    async acknowledgeAlert(id: string, dto: AcknowledgeAlertDto): Promise<AlertHistory> {
        const existing = await this.repository.findAlertHistoryById(id);
        if (!existing) {
            throw new AlertHistoryNotFoundError(id);
        }

        if (existing.isAcknowledged) {
            throw new Error('Alert is already acknowledged');
        }

        const acknowledged = await this.repository.acknowledgeAlert(id, dto);
        if (!acknowledged) {
            throw new AlertHistoryNotFoundError(id);
        }
        return acknowledged;
    }

    async bulkAcknowledgeAlerts(ids: string[], dto: AcknowledgeAlertDto): Promise<{ acknowledged: number }> {
        const count = await this.repository.bulkAcknowledgeAlerts(ids, dto);
        return { acknowledged: count };
    }

    // ==================== USER ALERT PREFERENCES ====================

    async getUserAlertPreferences(userId: string): Promise<UserAlertPreferences | null> {
        return this.repository.findUserAlertPreferences(userId);
    }

    async updateUserAlertPreferences(userId: string, dto: UpdateUserAlertPreferencesDto): Promise<UserAlertPreferences> {
        return this.repository.upsertUserAlertPreferences(userId, dto);
    }

    async muteAlertRule(userId: string, ruleId: string): Promise<UserAlertPreferences> {
        const prefs = await this.repository.findUserAlertPreferences(userId);
        const currentMuted = prefs?.mutedRules || [];

        if (!currentMuted.includes(ruleId)) {
            currentMuted.push(ruleId);
        }

        return this.repository.upsertUserAlertPreferences(userId, { mutedRules: currentMuted });
    }

    async unmuteAlertRule(userId: string, ruleId: string): Promise<UserAlertPreferences> {
        const prefs = await this.repository.findUserAlertPreferences(userId);
        const currentMuted = prefs?.mutedRules || [];
        const updatedMuted = currentMuted.filter((id: any) => id !== ruleId);

        return this.repository.upsertUserAlertPreferences(userId, { mutedRules: updatedMuted });
    }

    // ==================== DASHBOARD WIDGETS ====================

    async getAllDashboardWidgets(query: DashboardWidgetQuery): Promise<PaginatedResult<DashboardWidget>> {
        return this.repository.findAllDashboardWidgets(query);
    }

    async getDashboardWidgetById(id: string): Promise<DashboardWidget> {
        const widget = await this.repository.findDashboardWidgetById(id);
        if (!widget) {
            throw new WidgetNotFoundError(id);
        }
        return widget;
    }

    async getDashboardWidgetByCode(code: string): Promise<DashboardWidget> {
        const widget = await this.repository.findDashboardWidgetByCode(code);
        if (!widget) {
            throw new WidgetNotFoundError(code);
        }
        return widget;
    }

    async createDashboardWidget(dto: CreateDashboardWidgetDto): Promise<DashboardWidget> {
        return this.repository.createDashboardWidget(dto);
    }

    async updateDashboardWidget(id: string, dto: UpdateDashboardWidgetDto): Promise<DashboardWidget> {
        const existing = await this.repository.findDashboardWidgetById(id);
        if (!existing) {
            throw new WidgetNotFoundError(id);
        }

        if (existing.isBuiltin) {
            const allowedFields = ['isActive'];
            const hasDisallowedFields = Object.keys(dto).some(
                key => !allowedFields.includes(key) && dto[key as keyof UpdateDashboardWidgetDto] !== undefined
            );
            if (hasDisallowedFields) {
                throw new BuiltinModificationError('widget');
            }
        }

        const updated = await this.repository.updateDashboardWidget(id, dto);
        if (!updated) {
            throw new WidgetNotFoundError(id);
        }
        return updated;
    }

    async deleteDashboardWidget(id: string): Promise<boolean> {
        const existing = await this.repository.findDashboardWidgetById(id);
        if (!existing) {
            throw new WidgetNotFoundError(id);
        }

        if (existing.isBuiltin) {
            throw new BuiltinModificationError('widget');
        }

        return this.repository.deleteDashboardWidget(id);
    }

    // ==================== USER DASHBOARD LAYOUTS ====================

    async getUserDashboardLayout(userId: string, dashboardType?: string): Promise<UserDashboardLayout | null> {
        return this.repository.findUserDashboardLayout(userId, dashboardType || 'main');
    }

    async saveUserDashboardLayout(dto: SaveDashboardLayoutDto): Promise<UserDashboardLayout> {
        // Validate that all widget IDs exist
        for (const item of dto.layout) {
            const widget = await this.repository.findDashboardWidgetById(item.widgetId);
            if (!widget) {
                throw new WidgetNotFoundError(item.widgetId);
            }
        }

        return this.repository.saveUserDashboardLayout(dto);
    }

    // ==================== STATISTICS ====================

    async getReportStats(organizationId?: string): Promise<{
        totalReports: number;
        builtinReports: number;
        customReports: number;
        scheduledReports: number;
        executionsToday: number;
    }> {
        return this.repository.getReportStats(organizationId);
    }

    async getAlertStats(organizationId?: string): Promise<{
        totalRules: number;
        activeRules: number;
        alertsToday: number;
        unacknowledgedAlerts: number;
        criticalAlerts: number;
    }> {
        return this.repository.getAlertStats(organizationId);
    }

    async getDashboardStats(organizationId?: string): Promise<{
        reportStats: {
            totalReports: number;
            builtinReports: number;
            customReports: number;
            scheduledReports: number;
            executionsToday: number;
        };
        alertStats: {
            totalRules: number;
            activeRules: number;
            alertsToday: number;
            unacknowledgedAlerts: number;
            criticalAlerts: number;
        };
    }> {
        const [reportStats, alertStats] = await Promise.all([
            this.getReportStats(organizationId),
            this.getAlertStats(organizationId),
        ]);

        return { reportStats, alertStats };
    }
}

// ==================== FACTORY FUNCTION ====================

export function createReportsService(repository: ReportsRepository, pool: Pool): ReportsService {
    return new ReportsService(repository, pool);
}
