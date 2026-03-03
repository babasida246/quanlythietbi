// =============================================
// Module: Reports & Alerts (10-REPORTS)
// Zod Validation Schemas
// =============================================

import { z } from 'zod';

// ==================== ENUMS ====================

export const reportTypeSchema = z.enum(['dashboard', 'tabular', 'chart', 'scheduled']);
export const accessLevelSchema = z.enum(['all', 'admin', 'asset_manager', 'custom']);
export const executionTypeSchema = z.enum(['manual', 'scheduled']);
export const executionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export const fileFormatSchema = z.enum(['excel', 'pdf', 'csv']);

export const alertRuleTypeSchema = z.enum(['license', 'warranty', 'stock', 'checkout', 'depreciation', 'custom']);
export const alertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export const alertChannelSchema = z.enum(['email', 'in_app', 'both']);
export const alertFrequencySchema = z.enum(['once', 'daily', 'weekly']);
export const deliveryStatusSchema = z.enum(['pending', 'sent', 'partial', 'failed']);

export const conditionOperatorSchema = z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']);
export const digestFrequencySchema = z.enum(['immediate', 'daily', 'weekly']);

export const widgetTypeSchema = z.enum(['pie_chart', 'bar_chart', 'line_chart', 'stat_card', 'table', 'timeline', 'list', 'map']);
export const widgetSizeSchema = z.enum(['small', 'medium', 'large', 'full']);

// ==================== HELPER SCHEMAS ====================

export const reportFilterSchema = z.object({
    field: z.string(),
    label: z.string(),
    type: z.string().optional(),
    options: z.array(z.object({
        value: z.string(),
        label: z.string(),
    })).optional(),
});

export const sortConfigSchema = z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
});

export const widgetLayoutItemSchema = z.object({
    widgetId: z.string().uuid(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
});

export const tableColumnSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean']).optional(),
    sortable: z.boolean().optional(),
});

// ==================== REPORT DEFINITION SCHEMAS ====================

export const createReportDefinitionSchema = z.object({
    reportCode: z.string().max(50).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    reportType: reportTypeSchema,
    dataSource: z.string().min(1).max(100),
    fields: z.array(z.string()).min(1),
    filters: z.array(reportFilterSchema).optional(),
    defaultFilters: z.record(z.unknown()).optional(),
    grouping: z.array(z.string()).optional(),
    sorting: z.array(sortConfigSchema).optional(),
    chartConfig: z.record(z.unknown()).optional(),
    accessLevel: accessLevelSchema.optional(),
    allowedRoles: z.array(z.string()).optional(),
    isScheduled: z.boolean().optional(),
    scheduleCron: z.string().max(100).optional(),
    scheduleRecipients: z.array(z.string()).optional(),
    scheduleFormat: fileFormatSchema.optional(),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid().optional(),
});

export const updateReportDefinitionSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    fields: z.array(z.string()).min(1).optional(),
    filters: z.array(reportFilterSchema).optional(),
    defaultFilters: z.record(z.unknown()).optional(),
    grouping: z.array(z.string()).optional(),
    sorting: z.array(sortConfigSchema).optional(),
    chartConfig: z.record(z.unknown()).optional(),
    accessLevel: accessLevelSchema.optional(),
    allowedRoles: z.array(z.string()).optional(),
    isScheduled: z.boolean().optional(),
    scheduleCron: z.string().max(100).optional(),
    scheduleRecipients: z.array(z.string()).optional(),
    scheduleFormat: fileFormatSchema.optional(),
    isActive: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    updatedBy: z.string().uuid().optional(),
});

export const reportDefinitionQuerySchema = z.object({
    reportType: reportTypeSchema.optional(),
    dataSource: z.string().optional(),
    accessLevel: accessLevelSchema.optional(),
    isScheduled: z.coerce.boolean().optional(),
    isBuiltin: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    isFavorite: z.coerce.boolean().optional(),
    search: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ==================== REPORT EXECUTION SCHEMAS ====================

export const createReportExecutionSchema = z.object({
    reportId: z.string().uuid(),
    executionType: executionTypeSchema.optional(),
    filtersUsed: z.record(z.unknown()).optional(),
    executedBy: z.string().uuid().optional(),
});

export const updateReportExecutionSchema = z.object({
    status: executionStatusSchema.optional(),
    rowCount: z.number().int().optional(),
    filePath: z.string().max(500).optional(),
    fileFormat: fileFormatSchema.optional(),
    fileSizeBytes: z.number().int().optional(),
    startedAt: z.coerce.date().optional(),
    completedAt: z.coerce.date().optional(),
    durationMs: z.number().int().optional(),
    errorMessage: z.string().optional(),
    deliveryStatus: deliveryStatusSchema.optional(),
    deliveryError: z.string().optional(),
});

export const reportExecutionQuerySchema = z.object({
    reportId: z.string().uuid().optional(),
    executionType: executionTypeSchema.optional(),
    status: executionStatusSchema.optional(),
    executedBy: z.string().uuid().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ==================== ALERT RULE SCHEMAS ====================

export const createAlertRuleSchema = z.object({
    ruleCode: z.string().max(50).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    ruleType: alertRuleTypeSchema,
    conditionField: z.string().min(1).max(100),
    conditionOperator: conditionOperatorSchema,
    conditionValue: z.record(z.unknown()),
    conditionQuery: z.string().optional(),
    severity: alertSeveritySchema.optional(),
    channel: alertChannelSchema.optional(),
    frequency: alertFrequencySchema.optional(),
    cooldownHours: z.number().int().min(0).max(720).optional(),
    recipients: z.array(z.string()).optional(),
    recipientRoles: z.array(z.string()).optional(),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid().optional(),
});

export const updateAlertRuleSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    conditionField: z.string().min(1).max(100).optional(),
    conditionOperator: conditionOperatorSchema.optional(),
    conditionValue: z.record(z.unknown()).optional(),
    conditionQuery: z.string().optional(),
    severity: alertSeveritySchema.optional(),
    channel: alertChannelSchema.optional(),
    frequency: alertFrequencySchema.optional(),
    cooldownHours: z.number().int().min(0).max(720).optional(),
    recipients: z.array(z.string()).optional(),
    recipientRoles: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    updatedBy: z.string().uuid().optional(),
});

export const alertRuleQuerySchema = z.object({
    ruleType: alertRuleTypeSchema.optional(),
    severity: alertSeveritySchema.optional(),
    channel: alertChannelSchema.optional(),
    isBuiltin: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ==================== ALERT HISTORY SCHEMAS ====================

export const createAlertHistorySchema = z.object({
    ruleId: z.string().uuid(),
    triggerData: z.record(z.unknown()),
    affectedCount: z.number().int().min(1).optional(),
    title: z.string().min(1).max(500),
    message: z.string().min(1),
    severity: alertSeveritySchema,
    channelUsed: alertChannelSchema.optional(),
    organizationId: z.string().uuid().optional(),
});

export const acknowledgeAlertSchema = z.object({
    acknowledgedBy: z.string().uuid(),
    acknowledgmentNote: z.string().max(1000).optional(),
});

export const alertHistoryQuerySchema = z.object({
    ruleId: z.string().uuid().optional(),
    ruleType: alertRuleTypeSchema.optional(),
    severity: alertSeveritySchema.optional(),
    deliveryStatus: deliveryStatusSchema.optional(),
    isAcknowledged: z.coerce.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    organizationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ==================== USER ALERT PREFERENCES SCHEMAS ====================

export const updateUserAlertPreferencesSchema = z.object({
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    digestFrequency: digestFrequencySchema.optional(),
    digestTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).optional(),
    digestDay: z.number().int().min(0).max(6).optional(),
    emailMinSeverity: alertSeveritySchema.optional(),
    mutedRules: z.array(z.string().uuid()).optional(),
});

// ==================== DASHBOARD WIDGET SCHEMAS ====================

export const createDashboardWidgetSchema = z.object({
    widgetCode: z.string().max(50).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    widgetType: widgetTypeSchema,
    dataSource: z.string().min(1).max(100),
    dataQuery: z.string().optional(),
    dataConfig: z.record(z.unknown()).optional(),
    defaultSize: widgetSizeSchema.optional(),
    minWidth: z.number().int().min(1).max(12).optional(),
    minHeight: z.number().int().min(1).max(12).optional(),
    refreshInterval: z.number().int().min(0).max(86400).optional(),
    organizationId: z.string().uuid().optional(),
    createdBy: z.string().uuid().optional(),
});

export const updateDashboardWidgetSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    dataQuery: z.string().optional(),
    dataConfig: z.record(z.unknown()).optional(),
    defaultSize: widgetSizeSchema.optional(),
    minWidth: z.number().int().min(1).max(12).optional(),
    minHeight: z.number().int().min(1).max(12).optional(),
    refreshInterval: z.number().int().min(0).max(86400).optional(),
    isActive: z.boolean().optional(),
});

export const dashboardWidgetQuerySchema = z.object({
    widgetType: widgetTypeSchema.optional(),
    dataSource: z.string().optional(),
    isBuiltin: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().optional(),
    organizationId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== USER DASHBOARD LAYOUT SCHEMAS ====================

export const saveDashboardLayoutSchema = z.object({
    userId: z.string().uuid(),
    dashboardType: z.string().max(50).optional(),
    layout: z.array(widgetLayoutItemSchema),
});

// ==================== ROUTE PARAM SCHEMAS ====================

export const reportIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const reportCodeParamSchema = z.object({
    code: z.string(),
});

export const executionIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const alertRuleIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const alertRuleCodeParamSchema = z.object({
    code: z.string(),
});

export const alertHistoryIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const widgetIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const userIdParamSchema = z.object({
    userId: z.string().uuid(),
});

// ==================== EXECUTE REPORT SCHEMAS ====================

export const executeReportSchema = z.object({
    filters: z.record(z.unknown()).optional(),
    format: fileFormatSchema.optional(),
    sendEmail: z.boolean().optional(),
    recipients: z.array(z.string().email()).optional(),
});

export const triggerAlertCheckSchema = z.object({
    ruleIds: z.array(z.string().uuid()).optional(),
    ruleTypes: z.array(alertRuleTypeSchema).optional(),
    force: z.boolean().optional(),
});

// ==================== TYPE EXPORTS ====================

export type CreateReportDefinitionInput = z.infer<typeof createReportDefinitionSchema>;
export type UpdateReportDefinitionInput = z.infer<typeof updateReportDefinitionSchema>;
export type ReportDefinitionQueryInput = z.infer<typeof reportDefinitionQuerySchema>;

export type CreateReportExecutionInput = z.infer<typeof createReportExecutionSchema>;
export type UpdateReportExecutionInput = z.infer<typeof updateReportExecutionSchema>;
export type ReportExecutionQueryInput = z.infer<typeof reportExecutionQuerySchema>;

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;
export type AlertRuleQueryInput = z.infer<typeof alertRuleQuerySchema>;

export type CreateAlertHistoryInput = z.infer<typeof createAlertHistorySchema>;
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
export type AlertHistoryQueryInput = z.infer<typeof alertHistoryQuerySchema>;

export type UpdateUserAlertPreferencesInput = z.infer<typeof updateUserAlertPreferencesSchema>;

export type CreateDashboardWidgetInput = z.infer<typeof createDashboardWidgetSchema>;
export type UpdateDashboardWidgetInput = z.infer<typeof updateDashboardWidgetSchema>;
export type DashboardWidgetQueryInput = z.infer<typeof dashboardWidgetQuerySchema>;

export type SaveDashboardLayoutInput = z.infer<typeof saveDashboardLayoutSchema>;

export type ExecuteReportInput = z.infer<typeof executeReportSchema>;
export type TriggerAlertCheckInput = z.infer<typeof triggerAlertCheckSchema>;
