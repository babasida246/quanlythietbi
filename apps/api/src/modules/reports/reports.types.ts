// =============================================
// Module: Reports & Alerts (10-REPORTS)
// TypeScript Type Definitions
// =============================================

// ==================== ENUMS ====================

export type ReportType = 'dashboard' | 'tabular' | 'chart' | 'scheduled';
export type AccessLevel = 'all' | 'admin' | 'asset_manager' | 'custom';
export type ExecutionType = 'manual' | 'scheduled';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type FileFormat = 'excel' | 'pdf' | 'csv';

export type AlertRuleType = 'license' | 'warranty' | 'stock' | 'checkout' | 'depreciation' | 'custom';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertChannel = 'email' | 'in_app' | 'both';
export type AlertFrequency = 'once' | 'daily' | 'weekly';
export type DeliveryStatus = 'pending' | 'sent' | 'partial' | 'failed';

export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
export type DigestFrequency = 'immediate' | 'daily' | 'weekly';

export type WidgetType = 'pie_chart' | 'bar_chart' | 'line_chart' | 'stat_card' | 'table' | 'timeline' | 'list' | 'map';
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

// ==================== DATABASE ENTITIES ====================

export interface ReportDefinition {
    id: string;
    reportCode: string;
    name: string;
    description: string | null;
    reportType: ReportType;
    dataSource: string;
    fields: string[];
    filters: ReportFilter[];
    defaultFilters: Record<string, unknown>;
    grouping: string[];
    sorting: SortConfig[];
    chartConfig: Record<string, unknown>;
    accessLevel: AccessLevel;
    allowedRoles: string[];
    isScheduled: boolean;
    scheduleCron: string | null;
    scheduleRecipients: string[];
    scheduleFormat: FileFormat;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    isBuiltin: boolean;
    isActive: boolean;
    isFavorite: boolean;
    viewCount: number;
    organizationId: string | null;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ReportFilter {
    field: string;
    label: string;
    type?: string;
    options?: Array<{ value: string; label: string }>;
}

export interface SortConfig {
    field: string;
    direction: 'asc' | 'desc';
}

export interface ReportExecution {
    id: string;
    reportId: string;
    executionType: ExecutionType;
    status: ExecutionStatus;
    filtersUsed: Record<string, unknown>;
    rowCount: number | null;
    filePath: string | null;
    fileFormat: FileFormat | null;
    fileSizeBytes: number | null;
    startedAt: Date | null;
    completedAt: Date | null;
    durationMs: number | null;
    errorMessage: string | null;
    recipients: string[];
    deliveryStatus: DeliveryStatus | null;
    deliveryError: string | null;
    executedBy: string | null;
    createdAt: Date;
}

export interface AlertRule {
    id: string;
    ruleCode: string;
    name: string;
    description: string | null;
    ruleType: AlertRuleType;
    conditionField: string;
    conditionOperator: ConditionOperator;
    conditionValue: Record<string, unknown>;
    conditionQuery: string | null;
    severity: AlertSeverity;
    channel: AlertChannel;
    frequency: AlertFrequency;
    cooldownHours: number;
    recipients: string[];
    recipientRoles: string[];
    isBuiltin: boolean;
    isActive: boolean;
    lastTriggeredAt: Date | null;
    triggerCount: number;
    organizationId: string | null;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface AlertHistory {
    id: string;
    ruleId: string;
    triggeredAt: Date;
    triggerData: Record<string, unknown>;
    affectedCount: number;
    title: string;
    message: string;
    severity: AlertSeverity;
    recipientsNotified: string[];
    channelUsed: AlertChannel | null;
    deliveryStatus: DeliveryStatus;
    deliveryError: string | null;
    isAcknowledged: boolean;
    acknowledgedBy: string | null;
    acknowledgedAt: Date | null;
    acknowledgmentNote: string | null;
    organizationId: string | null;
    createdAt: Date;
}

export interface UserAlertPreferences {
    id: string;
    userId: string;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    digestFrequency: DigestFrequency;
    digestTime: string;
    digestDay: number;
    emailMinSeverity: AlertSeverity;
    mutedRules: string[];
    updatedAt: Date;
}

export interface DashboardWidget {
    id: string;
    widgetCode: string;
    name: string;
    description: string | null;
    widgetType: WidgetType;
    dataSource: string;
    dataQuery: string | null;
    dataConfig: Record<string, unknown>;
    defaultSize: WidgetSize;
    minWidth: number;
    minHeight: number;
    refreshInterval: number;
    isBuiltin: boolean;
    isActive: boolean;
    organizationId: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserDashboardLayout {
    id: string;
    userId: string;
    dashboardType: string;
    layout: WidgetLayoutItem[];
    createdAt: Date;
    updatedAt: Date;
}

export interface WidgetLayoutItem {
    widgetId: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

// ==================== DTOs ====================

// Report Definition DTOs
export interface CreateReportDefinitionDto {
    reportCode?: string;
    name: string;
    description?: string;
    reportType: ReportType;
    dataSource: string;
    fields: string[];
    filters?: ReportFilter[];
    defaultFilters?: Record<string, unknown>;
    grouping?: string[];
    sorting?: SortConfig[];
    chartConfig?: Record<string, unknown>;
    accessLevel?: AccessLevel;
    allowedRoles?: string[];
    isScheduled?: boolean;
    scheduleCron?: string;
    scheduleRecipients?: string[];
    scheduleFormat?: FileFormat;
    organizationId?: string;
    createdBy?: string;
}

export interface UpdateReportDefinitionDto {
    name?: string;
    description?: string;
    fields?: string[];
    filters?: ReportFilter[];
    defaultFilters?: Record<string, unknown>;
    grouping?: string[];
    sorting?: SortConfig[];
    chartConfig?: Record<string, unknown>;
    accessLevel?: AccessLevel;
    allowedRoles?: string[];
    isScheduled?: boolean;
    scheduleCron?: string;
    scheduleRecipients?: string[];
    scheduleFormat?: FileFormat;
    isActive?: boolean;
    isFavorite?: boolean;
    updatedBy?: string;
}

// Report Execution DTOs
export interface CreateReportExecutionDto {
    reportId: string;
    executionType?: ExecutionType;
    filtersUsed?: Record<string, unknown>;
    executedBy?: string;
}

export interface UpdateReportExecutionDto {
    status?: ExecutionStatus;
    rowCount?: number;
    filePath?: string;
    fileFormat?: FileFormat;
    fileSizeBytes?: number;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
    errorMessage?: string;
    deliveryStatus?: DeliveryStatus;
    deliveryError?: string;
}

// Alert Rule DTOs
export interface CreateAlertRuleDto {
    ruleCode?: string;
    name: string;
    description?: string;
    ruleType: AlertRuleType;
    conditionField: string;
    conditionOperator: ConditionOperator;
    conditionValue: Record<string, unknown>;
    conditionQuery?: string;
    severity?: AlertSeverity;
    channel?: AlertChannel;
    frequency?: AlertFrequency;
    cooldownHours?: number;
    recipients?: string[];
    recipientRoles?: string[];
    organizationId?: string;
    createdBy?: string;
}

export interface UpdateAlertRuleDto {
    name?: string;
    description?: string;
    conditionField?: string;
    conditionOperator?: ConditionOperator;
    conditionValue?: Record<string, unknown>;
    conditionQuery?: string;
    severity?: AlertSeverity;
    channel?: AlertChannel;
    frequency?: AlertFrequency;
    cooldownHours?: number;
    recipients?: string[];
    recipientRoles?: string[];
    isActive?: boolean;
    updatedBy?: string;
}

// Alert History DTOs
export interface CreateAlertHistoryDto {
    ruleId: string;
    triggerData: Record<string, unknown>;
    affectedCount?: number;
    title: string;
    message: string;
    severity: AlertSeverity;
    channelUsed?: AlertChannel;
    organizationId?: string;
}

export interface AcknowledgeAlertDto {
    acknowledgedBy: string;
    acknowledgmentNote?: string;
}

// User Alert Preferences DTOs
export interface UpdateUserAlertPreferencesDto {
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    digestFrequency?: DigestFrequency;
    digestTime?: string;
    digestDay?: number;
    emailMinSeverity?: AlertSeverity;
    mutedRules?: string[];
}

// Dashboard Widget DTOs
export interface CreateDashboardWidgetDto {
    widgetCode?: string;
    name: string;
    description?: string;
    widgetType: WidgetType;
    dataSource: string;
    dataQuery?: string;
    dataConfig?: Record<string, unknown>;
    defaultSize?: WidgetSize;
    minWidth?: number;
    minHeight?: number;
    refreshInterval?: number;
    organizationId?: string;
    createdBy?: string;
}

export interface UpdateDashboardWidgetDto {
    name?: string;
    description?: string;
    dataQuery?: string;
    dataConfig?: Record<string, unknown>;
    defaultSize?: WidgetSize;
    minWidth?: number;
    minHeight?: number;
    refreshInterval?: number;
    isActive?: boolean;
}

// User Dashboard Layout DTOs
export interface SaveDashboardLayoutDto {
    userId: string;
    dashboardType?: string;
    layout: WidgetLayoutItem[];
}

// ==================== QUERY INTERFACES ====================

export interface ReportDefinitionQuery {
    reportType?: ReportType;
    dataSource?: string;
    accessLevel?: AccessLevel;
    isScheduled?: boolean;
    isBuiltin?: boolean;
    isActive?: boolean;
    isFavorite?: boolean;
    search?: string;
    organizationId?: string;
    createdBy?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface ReportExecutionQuery {
    reportId?: string;
    executionType?: ExecutionType;
    status?: ExecutionStatus;
    executedBy?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AlertRuleQuery {
    ruleType?: AlertRuleType;
    severity?: AlertSeverity;
    channel?: AlertChannel;
    isBuiltin?: boolean;
    isActive?: boolean;
    search?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AlertHistoryQuery {
    ruleId?: string;
    ruleType?: AlertRuleType;
    severity?: AlertSeverity;
    deliveryStatus?: DeliveryStatus;
    isAcknowledged?: boolean;
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface DashboardWidgetQuery {
    widgetType?: WidgetType;
    dataSource?: string;
    isBuiltin?: boolean;
    isActive?: boolean;
    search?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
}

// ==================== RESULT INTERFACES ====================

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ReportDefinitionWithStats extends ReportDefinition {
    executionCount?: number;
    successCount?: number;
    lastSuccessAt?: Date | null;
    createdByName?: string;
}

export interface AlertRuleWithStats extends AlertRule {
    totalTriggers?: number;
    triggersLast30Days?: number;
    unacknowledgedCount?: number;
    createdByName?: string;
}

export interface AlertHistoryWithRule extends AlertHistory {
    ruleName?: string;
    ruleType?: AlertRuleType;
    ruleSeverity?: AlertSeverity;
}

// ==================== DASHBOARD DATA INTERFACES ====================

export interface DashboardData {
    widgets: WidgetData[];
    refreshedAt: Date;
}

export interface WidgetData {
    widgetId: string;
    widgetCode: string;
    widgetType: WidgetType;
    data: unknown;
    lastUpdated: Date;
}

export interface StatCardData {
    value: number | string;
    label: string;
    change?: number;
    changePercent?: number;
    changeDirection?: 'up' | 'down' | 'neutral';
}

export interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

export interface ChartDataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
}

export interface TableWidgetData {
    columns: TableColumn[];
    rows: Record<string, unknown>[];
    total: number;
}

export interface TableColumn {
    key: string;
    label: string;
    type?: 'string' | 'number' | 'date' | 'boolean';
    sortable?: boolean;
}

// ==================== REPORT EXECUTION INTERFACES ====================

export interface ReportExecutionResult {
    executionId: string;
    reportId: string;
    status: ExecutionStatus;
    data?: Record<string, unknown>[];
    rowCount: number;
    columns: TableColumn[];
    filePath?: string;
    fileFormat?: FileFormat;
    durationMs: number;
    error?: string;
}

export interface ScheduledReportConfig {
    reportId: string;
    cronExpression: string;
    recipients: string[];
    format: FileFormat;
    filters?: Record<string, unknown>;
    nextRunAt: Date;
}

// ==================== ALERT TRIGGER INTERFACES ====================

export interface AlertTriggerResult {
    alertId: string;
    ruleId: string;
    triggered: boolean;
    affectedItems: number;
    message: string;
    notificationsSent: number;
    cooldownActive?: boolean;
}

export interface AlertCheckResult {
    ruleId: string;
    ruleName: string;
    conditionMet: boolean;
    affectedCount: number;
    items: Record<string, unknown>[];
}
