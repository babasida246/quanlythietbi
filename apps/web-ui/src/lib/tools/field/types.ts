import type { Vendor } from '$lib/tools/config/types';

export type FieldScenario = 'loss' | 'loop' | 'packet-loss' | 'slow';
export type FieldRisk = 'low' | 'medium' | 'high';
export type StepStatus = 'todo' | 'running' | 'done';

export interface CommandItem {
    command: string;
    risk: FieldRisk;
}

export interface QuickCheckItem {
    title: string;
    command: string;
    status: 'pass' | 'warn' | 'fail';
    output: string;
}

export interface QuickCheckSnapshot {
    id: string;
    deviceId: string;
    ticketId: string;
    vendor: Vendor;
    overallStatus: 'pass' | 'warn' | 'fail';
    createdAt: string;
    items: QuickCheckItem[];
}

export interface PlaybookStep {
    title: string;
    status: StepStatus;
    requiresConfirm?: boolean;
    commands: CommandItem[];
    output?: string[];
}

export interface PlaybookRun {
    id: string;
    deviceId: string;
    vendor: Vendor;
    scenario: FieldScenario;
    createdAt: string;
    steps: PlaybookStep[];
}

export interface Snippet {
    id: string;
    title: string;
    description: string;
    command: string;
    risk: FieldRisk;
    vendor: Vendor | 'any';
    tags?: string[];
}

export interface PortView {
    name: string;
    mode: 'access' | 'trunk' | 'routed';
    vlan?: number;
    status: 'up' | 'down';
}

export interface VlanView {
    id: number;
    name: string;
}

export interface VisualizerData {
    ports: PortView[];
    vlans: VlanView[];
}

export interface Snapshot {
    id: string;
    deviceId: string;
    quickCheckId?: string;
    summary: string;
    notes?: string;
    createdAt: string;
    ticketId: string;
    visualizer?: VisualizerData;
}

export interface ConnectivityHop {
    label: string;
    status: StepStatus;
    commands: CommandItem[];
    output?: string[];
}

export interface ConnectivityPlan {
    id: string;
    deviceId: string;
    vendor: Vendor;
    createdAt: string;
    hops: ConnectivityHop[];
}

export interface FieldNote {
    id: string;
    deviceId: string;
    author: string;
    message: string;
    attachments: string[];
    createdAt: string;
    ticketId: string;
}

export interface ApprovalRequest {
    id: string;
    deviceId: string;
    requestedBy: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    ticketId: string;
}

export interface FieldAuditEvent {
    id: string;
    deviceId: string;
    actor: string;
    type: string;
    detail: string;
    ticketId?: string;
    createdAt: string;
}

export interface RunQuickCheckInput {
    deviceId: string;
    vendor: Vendor;
    ticketId: string;
}

export interface GeneratePlaybookInput {
    scenario: FieldScenario;
    vendor: Vendor;
    deviceId: string;
}

export interface CaptureSnapshotInput {
    deviceId: string;
    quickCheckId?: string;
    notes?: string;
    ticketId: string;
}

export interface GenerateConnectivityPlanInput {
    deviceId: string;
    vendor: Vendor;
}

export interface AddFieldNoteInput {
    deviceId: string;
    author: string;
    message: string;
    attachments: string[];
    ticketId: string;
}

export interface RequestApprovalInput {
    deviceId: string;
    requestedBy: string;
    reason: string;
    ticketId: string;
}

export interface RecordAuditInput {
    deviceId: string;
    actor: string;
    type: string;
    detail: string;
    ticketId?: string;
}
