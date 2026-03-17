/**
 * Workflow Module - Entity & DTO Type Definitions
 * @package @qltb/contracts
 *
 * Note: Core WF enums (WfRequestType, WfPriority, WfRequestStatus, etc.)
 * live in @qltb/contracts/workflow. This file re-exports them for convenience
 * alongside module-specific entity types and DTOs.
 */

export type {
    WfRequestType,
    WfPriority,
    WfRequestStatus,
    WfApprovalStatus,
    WfRequestLineItemType,
    WfRequestLineStatus,
    WfEventType,
    ApproverRule,
    WfApproverRuleType,
} from '../workflow/index.js';

import type {
    WfRequestType,
    WfPriority,
    WfRequestStatus,
    WfApprovalStatus,
    WfRequestLineItemType,
    WfRequestLineStatus,
    WfEventType,
    ApproverRule,
} from '../workflow/index.js';

export interface WfRequestLine {
    id: string;
    requestId: string;
    lineNo: number;
    itemType: WfRequestLineItemType;
    assetId: string | null;
    partId: string | null;
    requestedQty: number;
    fulfilledQty: number;
    unitCost: number | null;
    note: string | null;
    metadata: Record<string, unknown>;
    status: WfRequestLineStatus;
    createdAt: Date;
    updatedAt: Date;
    // joined read-only fields
    partCode?: string | null;
    partName?: string | null;
    assetCode?: string | null;
    assetName?: string | null;
}

export interface CreateWfRequestLineDto {
    lineNo?: number;
    itemType: WfRequestLineItemType;
    assetId?: string;
    partId?: string;
    requestedQty: number;
    unitCost?: number;
    note?: string;
    metadata?: Record<string, unknown>;
}

export interface StepAction {
    nextStep?: number;
    complete?: boolean;
    cancel?: boolean;
}

export interface WfDefinition {
    id: string;
    key: string;
    name: string;
    requestType: WfRequestType;
    version: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    steps?: WfStep[];
}

export interface WfStep {
    id: string;
    definitionId: string;
    stepNo: number;
    name: string;
    approverRule: ApproverRule;
    onApprove: StepAction;
    onReject: StepAction;
    slaHours: number | null;
}

export interface WfRequest {
    id: string;
    code: string;
    title: string;
    requestType: WfRequestType;
    priority: WfPriority;
    status: WfRequestStatus;
    requesterId: string;
    requesterOuId: string | null;
    definitionId: string | null;
    currentStepNo: number | null;
    dueAt: Date | null;
    payload: Record<string, unknown>;
    submittedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lines?: WfRequestLine[];
}

export interface WfRequestWithDetails extends WfRequest {
    requesterName: string | null;
    requesterEmail: string | null;
    definitionName: string | null;
    pendingApprovals?: WfApprovalWithDetails[];
    events?: WfEvent[];
}

export interface WfApproval {
    id: string;
    requestId: string;
    stepId: string;
    stepNo: number;
    assigneeUserId: string | null;
    assigneeGroupId: string | null;
    status: WfApprovalStatus;
    comment: string | null;
    decisionAt: Date | null;
    decisionBy: string | null;
    dueAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface WfApprovalWithDetails extends WfApproval {
    stepName: string | null;
    assigneeName: string | null;
    decisionByName: string | null;
    request?: WfRequest;
}

export interface WfEvent {
    id: string;
    requestId: string;
    eventType: WfEventType;
    actorId: string | null;
    meta: Record<string, unknown>;
    createdAt: Date;
    actorName?: string | null;
}

export interface WfAttachment {
    id: string;
    requestId: string;
    fileKey: string;
    filename: string;
    size: number | null;
    mime: string | null;
    uploadedBy: string | null;
    createdAt: Date;
}

// ==================== DTOs ====================

export interface CreateWfRequestDto {
    title: string;
    requestType: WfRequestType;
    priority?: WfPriority;
    requesterId: string;
    requesterOuId?: string;
    dueAt?: string;
    payload?: Record<string, unknown>;
    lines?: CreateWfRequestLineDto[];
}

export interface UpdateWfRequestDto {
    title?: string;
    priority?: WfPriority;
    dueAt?: string;
    payload?: Record<string, unknown>;
}

export interface SubmitWfRequestDto {
    requestId: string;
    actorId: string;
}

export interface ApproveWfApprovalDto {
    approvalId: string;
    actorId: string;
    comment?: string;
}

export interface RejectWfApprovalDto {
    approvalId: string;
    actorId: string;
    comment?: string;
}

export interface CancelWfRequestDto {
    requestId: string;
    actorId: string;
    reason?: string;
}

export interface CommentWfRequestDto {
    requestId: string;
    actorId: string;
    comment: string;
}

export interface WithdrawWfRequestDto {
    requestId: string;
    actorId: string;
    reason?: string;
}

export interface ClaimWfApprovalDto {
    approvalId: string;
    actorId: string;
}

export interface DelegateWfApprovalDto {
    approvalId: string;
    actorId: string;
    toUserId: string;
    reason?: string;
}

export interface RequestInfoDto {
    approvalId: string;
    actorId: string;
    question: string;
}

export interface CreateWfDefinitionDto {
    key: string;
    name: string;
    requestType: WfRequestType;
    version?: number;
    steps: Array<{
        stepNo: number;
        name: string;
        approverRule: ApproverRule;
        onApprove?: StepAction;
        onReject?: StepAction;
    }>;
}

// ==================== Query Params ====================

export interface WfRequestListParams {
    status?: WfRequestStatus;
    requestType?: WfRequestType;
    priority?: WfPriority;
    requesterId?: string;
    assigneeId?: string;
    page?: number;
    limit?: number;
    search?: string;
}

export interface InboxListParams {
    assigneeId: string;
    page?: number;
    limit?: number;
}

// ==================== Response Shapes ====================

export interface WfPaginatedResult<T> {
    data: T[];
    meta: { total: number; page: number; limit: number };
}

export interface InboxSummary {
    pendingCount: number;
    urgentCount: number;
    overdueCount: number;
    unassignedCount: number;
}
