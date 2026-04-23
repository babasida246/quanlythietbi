/**
 * Workflow Domain – Shared Enums & Constants
 *
 * Single source-of-truth for enums used in:
 *   - DB seed data (wf_definitions.request_type, wf_requests.status, etc.)
 *   - API Zod schemas
 *   - Frontend types & UI labels
 *
 * Rules:
 *   1. Add new values HERE first.
 *   2. If the DB has a CHECK constraint, update the migration too.
 *   3. Keep _VALUES arrays and TypeScript types in sync.
 */

// ─── Request type ─────────────────────────────────────────────────────────────

export const WF_REQUEST_TYPES = [
    'asset_request',
    'asset_recall',
    'asset_transfer',
    'repair_request',
    'disposal_request',
    'purchase',
    'other',
] as const;

export type WfRequestType = (typeof WF_REQUEST_TYPES)[number];

// ─── Priority ─────────────────────────────────────────────────────────────────

export const WF_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type WfPriority = (typeof WF_PRIORITIES)[number];

// ─── Request status ───────────────────────────────────────────────────────────

export const WF_REQUEST_STATUSES = [
    'draft',
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'cancelled',
    'closed',
] as const;

export type WfRequestStatus = (typeof WF_REQUEST_STATUSES)[number];

// ─── Approval status ──────────────────────────────────────────────────────────

export const WF_APPROVAL_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'skipped',
    'cancelled',
] as const;

export type WfApprovalStatus = (typeof WF_APPROVAL_STATUSES)[number];

// ─── Approver rule type ───────────────────────────────────────────────────────

export const WF_APPROVER_RULE_TYPES = [
    'user',
    'role',
    'ou_head',
    'any_manager',
] as const;

export type WfApproverRuleType = (typeof WF_APPROVER_RULE_TYPES)[number];

export interface ApproverRule {
    type: WfApproverRuleType;
    value?: string;
}

// ─── Event type ───────────────────────────────────────────────────────────────

export const WF_EVENT_TYPES = [
    'created',
    'updated',
    'submitted',
    'assigned',
    'step_started',
    'approved',
    'rejected',
    'commented',
    'cancelled',
    'closed',
    'reopened',
    'delegated',
    'info_requested',
    'withdrawn',
] as const;

export type WfEventType = (typeof WF_EVENT_TYPES)[number];

// ─── Request line item type ───────────────────────────────────────────────────

export const WF_LINE_ITEM_TYPES = ['asset', 'part', 'service'] as const;
export type WfRequestLineItemType = (typeof WF_LINE_ITEM_TYPES)[number];

export const WF_LINE_STATUSES = ['pending', 'partial', 'fulfilled', 'cancelled'] as const;
export type WfRequestLineStatus = (typeof WF_LINE_STATUSES)[number];

// ─── Vietnamese labels (shared by FE & reports) ──────────────────────────────

export const WF_TYPE_LABELS: Record<WfRequestType, string> = {
    asset_request: 'Cấp phát tài sản',
    asset_recall: 'Thu hồi tài sản',
    asset_transfer: 'Điều chuyển tài sản',
    repair_request: 'Sửa chữa / Bảo trì',
    disposal_request: 'Thanh lý tài sản',
    purchase: 'Mua sắm',
    other: 'Khác',
};

export const WF_STATUS_LABELS: Record<WfRequestStatus, string> = {
    draft: 'Nháp',
    submitted: 'Đã gửi',
    in_review: 'Đang duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    cancelled: 'Đã huỷ',
    closed: 'Đã đóng',
};

export const WF_PRIORITY_LABELS: Record<WfPriority, string> = {
    low: 'Thấp',
    normal: 'Bình thường',
    high: 'Cao',
    urgent: 'Khẩn cấp',
};
