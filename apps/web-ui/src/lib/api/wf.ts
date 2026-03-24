/**
 * Workflow Request & Approval Module - Frontend API Client
 * Talks to /api/v1/wf/* endpoints
 */

import { API_BASE, apiJson, requireAccessToken } from './httpClient'
import type {
    WfRequestType,
    WfPriority,
    WfRequestStatus,
    WfApprovalStatus,
    WfRequestLineItemType,
    WfRequestLineStatus,
} from '@qltb/contracts'

// ==================== Shared types ====================

export type { WfRequestType, WfPriority, WfRequestStatus, WfApprovalStatus, WfRequestLineItemType, WfRequestLineStatus }

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
    definitionName: string | null;
    currentStepNo: number | null;
    dueAt: string | null;
    payload: Record<string, unknown>;
    submittedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    requesterName?: string | null;
    requesterEmail?: string | null;
}

export interface WfApproval {
    id: string;
    requestId: string;
    stepId: string;
    stepNo: number;
    stepName: string | null;
    assigneeUserId: string | null;
    assigneeName: string | null;
    status: WfApprovalStatus;
    comment: string | null;
    decisionAt: string | null;
    decisionBy: string | null;
    decisionByName: string | null;
    dueAt: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface WfEvent {
    id: string;
    requestId: string;
    eventType: string;
    actorId: string | null;
    actorName: string | null;
    meta: Record<string, unknown>;
    createdAt: string;
}

// ==================== Request Lines ====================

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
    createdAt: string;
    updatedAt: string;
    // Joined display fields
    partCode?: string | null;
    partName?: string | null;
    assetCode?: string | null;
    assetName?: string | null;
}

export interface CreateWfRequestLineInput {
    lineNo?: number;
    itemType: WfRequestLineItemType;
    assetId?: string;
    partId?: string;
    requestedQty: number;
    unitCost?: number;
    note?: string;
    metadata?: Record<string, unknown>;
}

// ==================== Request Detail ====================

export interface WfRequestDetail extends WfRequest {
    approvals: WfApproval[];
    events: WfEvent[];
    lines?: WfRequestLine[];
}

export interface WfDefinition {
    id: string;
    key: string;
    name: string;
    requestType: WfRequestType;
    version: number;
    isActive: boolean;
}

export interface InboxSummary {
    pendingCount: number;
    urgentCount: number;
    overdueCount: number;
    unassignedCount: number;
}

export interface InboxApproval extends WfApproval {
    request: WfRequest;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    meta: { total: number; page: number; limit: number };
}

// ==================== Helpers ====================

const WF_BASE = `${API_BASE}/v1`;

function authHeaders(): Record<string, string> {
    return {
        Authorization: `Bearer ${requireAccessToken()}`,
        'Content-Type': 'application/json',
    };
}

// ==================== My Requests ====================

export async function listMyWfRequests(params: {
    status?: WfRequestStatus;
    requestType?: WfRequestType;
    priority?: WfPriority;
    search?: string;
    page?: number;
    limit?: number;
} = {}): Promise<PaginatedResponse<WfRequest>> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.requestType) qs.set('requestType', params.requestType);
    if (params.priority) qs.set('priority', params.priority);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiJson<PaginatedResponse<WfRequest>>(`${WF_BASE}/wf/me/requests${query}`, {
        headers: authHeaders(),
    });
}

export async function getMyWfRequest(id: string): Promise<{ success: boolean; data: WfRequestDetail }> {
    return apiJson<{ success: boolean; data: WfRequestDetail }>(`${WF_BASE}/wf/me/requests/${id}`, {
        headers: authHeaders(),
    });
}

export async function createWfRequest(input: {
    title: string;
    requestType: WfRequestType;
    priority?: WfPriority;
    dueAt?: string;
    payload?: Record<string, unknown>;
    lines?: CreateWfRequestLineInput[];
}): Promise<{ success: boolean; data: WfRequest }> {
    return apiJson<{ success: boolean; data: WfRequest }>(`${WF_BASE}/wf/me/requests`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(input),
    });
}

export async function submitWfRequest(id: string): Promise<{ success: boolean; data: WfRequest }> {
    return apiJson<{ success: boolean; data: WfRequest }>(`${WF_BASE}/wf/me/requests/${id}/submit`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
    });
}

export async function cancelWfRequest(
    id: string,
    reason?: string
): Promise<{ success: boolean; data: WfRequest }> {
    return apiJson<{ success: boolean; data: WfRequest }>(`${WF_BASE}/wf/me/requests/${id}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason }),
    });
}

export async function commentWfRequest(
    id: string,
    comment: string
): Promise<{ success: boolean }> {
    return apiJson<{ success: boolean }>(`${WF_BASE}/wf/me/requests/${id}/comment`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ comment }),
    });
}

export async function withdrawWfRequest(
    id: string,
    reason?: string
): Promise<{ success: boolean; data: WfRequest }> {
    return apiJson<{ success: boolean; data: WfRequest }>(`${WF_BASE}/wf/me/requests/${id}/withdraw`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason }),
    });
}

// ==================== Inbox ====================

export async function listInboxApprovals(params: {
    page?: number;
    limit?: number;
} = {}): Promise<PaginatedResponse<InboxApproval>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiJson<PaginatedResponse<InboxApproval>>(`${WF_BASE}/wf/inbox${query}`, {
        headers: authHeaders(),
    });
}

export async function getInboxSummary(): Promise<{ success: boolean; data: InboxSummary }> {
    return apiJson<{ success: boolean; data: InboxSummary }>(`${WF_BASE}/wf/inbox/summary`, {
        headers: authHeaders(),
    });
}

export async function approveWfApproval(
    id: string,
    comment?: string
): Promise<{ success: boolean; data: WfRequest }> {
    return apiJson<{ success: boolean; data: WfRequest }>(`${WF_BASE}/wf/approvals/${id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ comment }),
    });
}

export async function rejectWfApproval(
    id: string,
    comment?: string
): Promise<{ success: boolean; data: WfRequest }> {
    return apiJson<{ success: boolean; data: WfRequest }>(`${WF_BASE}/wf/approvals/${id}/reject`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ comment }),
    });
}

export async function claimWfApproval(
    id: string
): Promise<{ success: boolean; data: WfApproval }> {
    return apiJson<{ success: boolean; data: WfApproval }>(`${WF_BASE}/wf/approvals/${id}/claim`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
    });
}

export async function delegateWfApproval(
    id: string,
    toUserId: string,
    reason?: string
): Promise<{ success: boolean; data: WfApproval }> {
    return apiJson<{ success: boolean; data: WfApproval }>(`${WF_BASE}/wf/approvals/${id}/delegate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ toUserId, reason }),
    });
}

export async function requestMoreInfo(
    id: string,
    question: string
): Promise<{ success: boolean }> {
    return apiJson<{ success: boolean }>(`${WF_BASE}/wf/approvals/${id}/request-info`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ question }),
    });
}

export async function listUnassignedApprovals(params: {
    page?: number;
    limit?: number;
} = {}): Promise<PaginatedResponse<InboxApproval>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiJson<PaginatedResponse<InboxApproval>>(`${WF_BASE}/wf/approvals/unassigned${query}`, {
        headers: authHeaders(),
    });
}

// ==================== Admin ====================

export async function listAllWfRequests(params: {
    status?: WfRequestStatus;
    requestType?: WfRequestType;
    priority?: WfPriority;
    search?: string;
    page?: number;
    limit?: number;
} = {}): Promise<PaginatedResponse<WfRequest>> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiJson<PaginatedResponse<WfRequest>>(`${WF_BASE}/wf/admin/requests${query}`, {
        headers: authHeaders(),
    });
}

export async function getAdminWfRequestDetail(id: string): Promise<{ success: boolean; data: WfRequestDetail }> {
    return apiJson<{ success: boolean; data: WfRequestDetail }>(`${WF_BASE}/wf/admin/requests/${id}`, {
        headers: authHeaders(),
    });
}

export async function listWfDefinitions(): Promise<{ success: boolean; data: WfDefinition[] }> {
    return apiJson<{ success: boolean; data: WfDefinition[] }>(`${WF_BASE}/wf/admin/definitions`, {
        headers: authHeaders(),
    });
}

// ==================== Status / priority helpers ====================

export const WF_STATUS_LABELS: Record<WfRequestStatus, string> = {
    draft: 'Nháp',
    submitted: 'Đã gửi',
    in_review: 'Đang duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    cancelled: 'Đã hủy',
    closed: 'Đã đóng',
};

export const WF_PRIORITY_LABELS: Record<WfPriority, string> = {
    low: 'Thấp',
    normal: 'Bình thường',
    high: 'Cao',
    urgent: 'Khẩn cấp',
};

export const WF_TYPE_LABELS: Record<WfRequestType, string> = {
    asset_request: 'Cấp phát tài sản',
    repair_request: 'Sửa chữa / Bảo trì',
    disposal_request: 'Thanh lý tài sản',
    purchase: 'Mua sắm',
    other: 'Khác',
};

export function wfStatusBadgeClass(status: WfRequestStatus): string {
    const map: Record<WfRequestStatus, string> = {
        draft: 'badge badge-gray',
        submitted: 'badge badge-blue',
        in_review: 'badge badge-yellow',
        approved: 'badge badge-green',
        rejected: 'badge badge-red',
        cancelled: 'badge badge-gray',
        closed: 'badge badge-green',
    };
    return map[status] ?? 'badge badge-gray';
}

export function wfPriorityBadgeClass(priority: WfPriority): string {
    const map: Record<WfPriority, string> = {
        low: 'badge badge-gray',
        normal: 'badge badge-blue',
        high: 'badge badge-orange',
        urgent: 'badge badge-red',
    };
    return map[priority] ?? 'badge badge-gray';
}
