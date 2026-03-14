/**
 * Unified status badge configuration — Single Source of Truth.
 *
 * Every badge variant maps to CSS custom properties defined in tokens.css.
 * StatusBadge component reads from this config.
 */

export type BadgeVariant =
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'neutral'
    | 'purple'
    | 'cyan'
    | 'orange'
    | 'teal';

export interface StatusConfig {
    variant: BadgeVariant;
    label?: string;
}

/**
 * CSS classes for each badge variant.
 * Uses token-driven colors from tokens.css --status-* variables.
 */
export const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    success: 'status-badge-success',
    warning: 'status-badge-warning',
    danger: 'status-badge-danger',
    info: 'status-badge-info',
    neutral: 'status-badge-neutral',
    purple: 'status-badge-purple',
    cyan: 'status-badge-cyan',
    orange: 'status-badge-orange',
    teal: 'status-badge-teal',
};

/* ─── Asset Statuses ───────────────────────────────────────────── */

export const ASSET_STATUS: Record<string, StatusConfig> = {
    in_use: { variant: 'success', label: 'assetStatus.inUse' },
    in_stock: { variant: 'info', label: 'assetStatus.inStock' },
    in_repair: { variant: 'warning', label: 'assetStatus.inRepair' },
    retired: { variant: 'danger', label: 'assetStatus.retired' },
    disposed: { variant: 'danger', label: 'assetStatus.disposed' },
    lost: { variant: 'neutral', label: 'assetStatus.lost' },
    reserved: { variant: 'purple', label: 'assetStatus.reserved' },
    available: { variant: 'success', label: 'assetStatus.available' },
};

/* ─── Repair Statuses ──────────────────────────────────────────── */

export const REPAIR_STATUS: Record<string, StatusConfig> = {
    open: { variant: 'info', label: 'repairStatus.open' },
    diagnosing: { variant: 'purple', label: 'repairStatus.diagnosing' },
    waiting_parts: { variant: 'warning', label: 'repairStatus.waitingParts' },
    repaired: { variant: 'success', label: 'repairStatus.repaired' },
    closed: { variant: 'neutral', label: 'repairStatus.closed' },
    canceled: { variant: 'danger', label: 'repairStatus.canceled' },
};

/* ─── Repair Severity ──────────────────────────────────────────── */

export const REPAIR_SEVERITY: Record<string, StatusConfig> = {
    low: { variant: 'neutral', label: 'severity.low' },
    medium: { variant: 'warning', label: 'severity.medium' },
    high: { variant: 'orange', label: 'severity.high' },
    critical: { variant: 'danger', label: 'severity.critical' },
};

/* ─── Maintenance Ticket Statuses ──────────────────────────────── */

export const TICKET_STATUS: Record<string, StatusConfig> = {
    open: { variant: 'info', label: 'ticketStatus.open' },
    in_progress: { variant: 'warning', label: 'ticketStatus.inProgress' },
    closed: { variant: 'success', label: 'ticketStatus.closed' },
    canceled: { variant: 'neutral', label: 'ticketStatus.canceled' },
};

/* ─── Warehouse Document Types ─────────────────────────────────── */

export const DOC_TYPE: Record<string, StatusConfig> = {
    receipt: { variant: 'success', label: 'docType.receipt' },
    issue: { variant: 'danger', label: 'docType.issue' },
    transfer: { variant: 'info', label: 'docType.transfer' },
    adjust: { variant: 'warning', label: 'docType.adjust' },
};

/* ─── Warehouse Document Statuses ──────────────────────────────── */

export const DOC_STATUS: Record<string, StatusConfig> = {
    draft: { variant: 'neutral', label: 'docStatus.draft' },
    submitted: { variant: 'warning', label: 'docStatus.submitted' },
    approved: { variant: 'info', label: 'docStatus.approved' },
    posted: { variant: 'success', label: 'docStatus.posted' },
    canceled: { variant: 'danger', label: 'docStatus.canceled' },
};

/* ─── Workflow Request Statuses ────────────────────────────────── */

export const WF_STATUS: Record<string, StatusConfig> = {
    draft: { variant: 'neutral', label: 'wfStatus.draft' },
    submitted: { variant: 'info', label: 'wfStatus.submitted' },
    in_review: { variant: 'warning', label: 'wfStatus.inReview' },
    approved: { variant: 'success', label: 'wfStatus.approved' },
    rejected: { variant: 'danger', label: 'wfStatus.rejected' },
    cancelled: { variant: 'neutral', label: 'wfStatus.cancelled' },
    closed: { variant: 'success', label: 'wfStatus.closed' },
};

/* ─── Inventory Audit Statuses ─────────────────────────────────── */

export const AUDIT_STATUS: Record<string, StatusConfig> = {
    planned: { variant: 'info', label: 'auditStatus.planned' },
    in_progress: { variant: 'warning', label: 'auditStatus.inProgress' },
    completed: { variant: 'success', label: 'auditStatus.completed' },
    canceled: { variant: 'neutral', label: 'auditStatus.canceled' },
};

/**
 * Helper: look up a status config from a registry, with fallback.
 */
export function getStatusConfig(
    registry: Record<string, StatusConfig>,
    status: string,
): StatusConfig {
    return registry[status] ?? { variant: 'neutral' };
}
