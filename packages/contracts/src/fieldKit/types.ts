export const FieldScenario = {
    LOSS: 'loss',
    LOOP: 'loop',
    PACKET_LOSS: 'packet-loss',
    SLOW: 'slow'
} as const

export type FieldScenario = typeof FieldScenario[keyof typeof FieldScenario]

export const FieldRisk = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
} as const

export type FieldRisk = typeof FieldRisk[keyof typeof FieldRisk]

export type FieldVendor = 'cisco' | 'mikrotik' | 'fortigate' | 'generic'

export interface FieldCommandItem {
    command: string
    risk: FieldRisk
}

export interface FieldQuickCheckItem {
    title: string
    command: string
    status: 'pass' | 'warn' | 'fail'
    output: string
}

export interface FieldQuickCheckSnapshot {
    id: string
    deviceId: string
    ticketId: string
    vendor: FieldVendor
    overallStatus: 'pass' | 'warn' | 'fail'
    createdAt: string
    items: FieldQuickCheckItem[]
}

export interface FieldPlaybookStep {
    title: string
    status: 'todo' | 'running' | 'done'
    requiresConfirm?: boolean
    commands: FieldCommandItem[]
    output?: string[]
}

export interface FieldPlaybookRun {
    id: string
    deviceId: string
    vendor: FieldVendor
    scenario: FieldScenario
    createdAt: string
    steps: FieldPlaybookStep[]
}

export interface FieldSnippet {
    id: string
    code: string
    title: string
    description: string
    command: string
    risk: FieldRisk
    vendor: FieldVendor | 'any'
    tags: string[]
}

export interface FieldPortView {
    name: string
    mode: 'access' | 'trunk' | 'routed'
    vlan?: number
    status: 'up' | 'down'
}

export interface FieldVlanView {
    id: number
    name: string
}

export interface FieldVisualizerData {
    ports: FieldPortView[]
    vlans: FieldVlanView[]
}

export interface FieldSnapshot {
    id: string
    deviceId: string
    quickCheckId?: string
    summary: string
    notes?: string
    createdAt: string
    ticketId: string
    visualizer?: FieldVisualizerData
}

export interface FieldConnectivityHop {
    label: string
    status: 'todo' | 'running' | 'done'
    commands: FieldCommandItem[]
    output?: string[]
}

export interface FieldConnectivityPlan {
    id: string
    deviceId: string
    vendor: FieldVendor
    createdAt: string
    hops: FieldConnectivityHop[]
}

export interface FieldNote {
    id: string
    deviceId: string
    author: string
    message: string
    attachments: string[]
    createdAt: string
    ticketId: string
}

export interface FieldApprovalRequest {
    id: string
    deviceId: string
    requestedBy: string
    reason: string
    status: 'pending' | 'approved' | 'rejected'
    createdAt: string
    ticketId: string
}

export interface FieldAuditEvent {
    id: string
    deviceId: string
    actor: string
    type: string
    detail: string
    ticketId?: string
    createdAt: string
}

export interface RunFieldQuickCheckInput {
    deviceId: string
    vendor: FieldVendor
    ticketId: string
}

export interface GenerateFieldPlaybookInput {
    scenario: FieldScenario
    vendor: FieldVendor
    deviceId: string
}

export interface CreateFieldSnapshotInput {
    deviceId: string
    quickCheckId?: string
    notes?: string
    ticketId: string
}

export interface GenerateFieldConnectivityPlanInput {
    deviceId: string
    vendor: FieldVendor
}

export interface CreateFieldNoteInput {
    deviceId: string
    author: string
    message: string
    attachments: string[]
    ticketId: string
}

export interface CreateFieldApprovalRequestInput {
    deviceId: string
    requestedBy: string
    reason: string
    ticketId: string
}

export interface CreateFieldAuditEventInput {
    deviceId: string
    actor: string
    type: string
    detail: string
    ticketId?: string
}
