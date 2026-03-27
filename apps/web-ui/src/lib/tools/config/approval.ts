import type { CanonicalConfig, Vendor } from '$lib/tools/config/types';

const KEY = 'netops.config.approvals.v1';

export interface ApprovalRecord {
    id: string;
    deviceId: string;
    vendor: Vendor;
    environment: 'dev' | 'staging' | 'prod';
    configHash: string;
    requestedBy?: string;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
    decidedAt?: string;
    decidedBy?: string;
    decisionReason?: string;
}

function uid(): string {
    return `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadApprovals(): ApprovalRecord[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as ApprovalRecord[];
    } catch {
        return [];
    }
}

function saveApprovals(items: ApprovalRecord[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(items));
}

export function hashConfig(config: CanonicalConfig, vendor: Vendor): string {
    const text = `${vendor}:${JSON.stringify(config)}`;
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return `cfg_${Math.abs(hash).toString(36)}`;
}

export function createApprovalRequest(input: {
    deviceId: string;
    vendor: Vendor;
    environment: 'dev' | 'staging' | 'prod';
    configHash: string;
    requestedBy?: string;
    reason?: string;
}): ApprovalRecord {
    const next: ApprovalRecord = {
        id: uid(),
        deviceId: input.deviceId,
        vendor: input.vendor,
        environment: input.environment,
        configHash: input.configHash,
        requestedBy: input.requestedBy,
        reason: input.reason,
        status: 'pending',
        requestedAt: new Date().toISOString()
    };
    const all = [next, ...loadApprovals()];
    saveApprovals(all);
    return next;
}

export function decideApproval(
    approvalId: string,
    status: 'approved' | 'rejected',
    decidedBy?: string,
    decisionReason?: string
): ApprovalRecord | null {
    const all = loadApprovals();
    const target = all.find((item) => item.id === approvalId);
    if (!target) return null;
    target.status = status;
    target.decidedAt = new Date().toISOString();
    target.decidedBy = decidedBy;
    target.decisionReason = decisionReason;
    saveApprovals(all);
    return target;
}
