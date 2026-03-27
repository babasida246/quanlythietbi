import type {
    CreateFieldApprovalRequestInput,
    CreateFieldAuditEventInput,
    CreateFieldNoteInput,
    CreateFieldSnapshotInput,
    FieldApprovalRequest,
    FieldAuditEvent,
    FieldConnectivityPlan,
    FieldPlaybookRun,
    FieldQuickCheckSnapshot,
    FieldScenario,
    FieldSnippet,
    FieldVendor,
    FieldVisualizerData,
    GenerateFieldConnectivityPlanInput,
    GenerateFieldPlaybookInput,
    RunFieldQuickCheckInput,
    FieldNote,
    FieldSnapshot
} from '@qltb/contracts'

export interface IFieldKitRepository {
    createQuickCheck(snapshot: Omit<FieldQuickCheckSnapshot, 'id' | 'createdAt'>): Promise<FieldQuickCheckSnapshot>
    listQuickChecks(deviceId: string): Promise<FieldQuickCheckSnapshot[]>

    createPlaybook(run: Omit<FieldPlaybookRun, 'id' | 'createdAt'>): Promise<FieldPlaybookRun>
    listPlaybooks(deviceId: string): Promise<FieldPlaybookRun[]>

    listSnippets(vendor?: FieldVendor | 'any'): Promise<FieldSnippet[]>

    createSnapshot(snapshot: Omit<FieldSnapshot, 'id' | 'createdAt'>): Promise<FieldSnapshot>
    listSnapshots(deviceId: string): Promise<FieldSnapshot[]>

    createNote(note: Omit<FieldNote, 'id' | 'createdAt'>): Promise<FieldNote>
    listNotes(deviceId: string): Promise<FieldNote[]>

    createApproval(request: Omit<FieldApprovalRequest, 'id' | 'createdAt' | 'status'>): Promise<FieldApprovalRequest>
    listApprovals(deviceId: string): Promise<FieldApprovalRequest[]>

    createAuditEvent(event: Omit<FieldAuditEvent, 'id' | 'createdAt'>): Promise<FieldAuditEvent>
}

function overallStatus(items: FieldQuickCheckSnapshot['items']): FieldQuickCheckSnapshot['overallStatus'] {
    if (items.some((item) => item.status === 'fail')) return 'fail'
    if (items.some((item) => item.status === 'warn')) return 'warn'
    return 'pass'
}

function buildQuickCheckItems(vendor: FieldVendor): FieldQuickCheckSnapshot['items'] {
    const cisco = [
        { title: 'CPU health', command: 'show processes cpu sorted | ex 0.00', status: 'pass', output: 'CPU five sec: 12%' },
        { title: 'Interface errors', command: 'show interfaces counters errors', status: 'warn', output: 'Gi1/0/48 crc=12' },
        { title: 'OSPF adjacency', command: 'show ip ospf neighbor', status: 'pass', output: 'FULL on 2 neighbors' }
    ] as const

    const mikrotik = [
        { title: 'CPU health', command: '/system resource print', status: 'pass', output: 'cpu-load: 16' },
        { title: 'Interface link', command: '/interface print terse', status: 'pass', output: 'ether1 running' },
        { title: 'BGP peers', command: '/routing bgp connection print', status: 'warn', output: '1 peer idle' }
    ] as const

    return (vendor === 'mikrotik' ? mikrotik : cisco).map((item) => ({ ...item }))
}

function buildPlaybookSteps(scenario: FieldScenario, vendor: FieldVendor): FieldPlaybookRun['steps'] {
    const base = vendor === 'mikrotik'
        ? ['/interface print terse', '/ip route print where active=yes', '/tool ping 8.8.8.8 count=5']
        : ['show ip interface brief', 'show ip route', 'ping 8.8.8.8 repeat 5']

    if (scenario === 'loop') {
        return [
            {
                title: 'Identify loop domain',
                status: 'todo',
                commands: base.map((command) => ({ command, risk: 'low' }))
            },
            {
                title: 'Disable suspected edge port',
                status: 'todo',
                requiresConfirm: true,
                commands: [
                    {
                        command: vendor === 'mikrotik' ? '/interface disable ether5' : 'interface gi1/0/5\nshutdown',
                        risk: 'high'
                    }
                ]
            }
        ]
    }

    return [
        {
            title: 'Baseline health checks',
            status: 'todo',
            commands: base.map((command) => ({ command, risk: 'low' }))
        },
        {
            title: 'Verify path and latency',
            status: 'todo',
            commands: [
                {
                    command: vendor === 'mikrotik' ? '/tool traceroute 8.8.8.8' : 'traceroute 8.8.8.8',
                    risk: 'low'
                }
            ]
        }
    ]
}

export class FieldKitService {
    constructor(private readonly repository: IFieldKitRepository) { }

    async runQuickCheck(input: RunFieldQuickCheckInput): Promise<FieldQuickCheckSnapshot> {
        const items = buildQuickCheckItems(input.vendor)
        return this.repository.createQuickCheck({
            deviceId: input.deviceId,
            ticketId: input.ticketId,
            vendor: input.vendor,
            overallStatus: overallStatus(items),
            items
        })
    }

    async listQuickChecks(deviceId: string): Promise<FieldQuickCheckSnapshot[]> {
        return this.repository.listQuickChecks(deviceId)
    }

    async generatePlaybook(input: GenerateFieldPlaybookInput): Promise<FieldPlaybookRun> {
        return this.repository.createPlaybook({
            deviceId: input.deviceId,
            vendor: input.vendor,
            scenario: input.scenario,
            steps: buildPlaybookSteps(input.scenario, input.vendor)
        })
    }

    async listPlaybooks(deviceId: string): Promise<FieldPlaybookRun[]> {
        return this.repository.listPlaybooks(deviceId)
    }

    async listSnippets(vendor?: FieldVendor | 'any'): Promise<FieldSnippet[]> {
        return this.repository.listSnippets(vendor)
    }

    async getVisualizer(_deviceId: string): Promise<FieldVisualizerData> {
        return {
            ports: [
                { name: 'Gi1/0/1', mode: 'trunk', vlan: 10, status: 'up' },
                { name: 'Gi1/0/2', mode: 'access', vlan: 20, status: 'up' },
                { name: 'Gi1/0/48', mode: 'routed', status: 'down' }
            ],
            vlans: [
                { id: 10, name: 'MGMT' },
                { id: 20, name: 'USERS' },
                { id: 30, name: 'VOICE' }
            ]
        }
    }

    async createSnapshot(input: CreateFieldSnapshotInput): Promise<FieldSnapshot> {
        const visualizer = await this.getVisualizer(input.deviceId)
        return this.repository.createSnapshot({
            deviceId: input.deviceId,
            quickCheckId: input.quickCheckId,
            notes: input.notes,
            summary: `Snapshot ${input.deviceId}${input.notes ? ` - ${input.notes}` : ''}`,
            ticketId: input.ticketId,
            visualizer
        })
    }

    async listSnapshots(deviceId: string): Promise<FieldSnapshot[]> {
        return this.repository.listSnapshots(deviceId)
    }

    async generateConnectivityPlan(input: GenerateFieldConnectivityPlanInput): Promise<FieldConnectivityPlan> {
        return {
            id: `conn-${Date.now()}`,
            deviceId: input.deviceId,
            vendor: input.vendor,
            createdAt: new Date().toISOString(),
            hops: [
                {
                    label: 'Access edge',
                    status: 'todo',
                    commands: [
                        {
                            command: input.vendor === 'mikrotik' ? '/tool ping 10.10.0.1 count=5' : 'ping 10.10.0.1 repeat 5',
                            risk: 'low'
                        }
                    ]
                },
                {
                    label: 'Core gateway',
                    status: 'todo',
                    commands: [
                        {
                            command: input.vendor === 'mikrotik' ? '/tool traceroute 10.10.0.254' : 'traceroute 10.10.0.254',
                            risk: 'low'
                        }
                    ]
                }
            ]
        }
    }

    async addNote(input: CreateFieldNoteInput): Promise<FieldNote> {
        return this.repository.createNote({
            deviceId: input.deviceId,
            author: input.author,
            message: input.message,
            attachments: input.attachments,
            ticketId: input.ticketId
        })
    }

    async listNotes(deviceId: string): Promise<FieldNote[]> {
        return this.repository.listNotes(deviceId)
    }

    async requestApproval(input: CreateFieldApprovalRequestInput): Promise<FieldApprovalRequest> {
        return this.repository.createApproval({
            deviceId: input.deviceId,
            requestedBy: input.requestedBy,
            reason: input.reason,
            ticketId: input.ticketId
        })
    }

    async listApprovals(deviceId: string): Promise<FieldApprovalRequest[]> {
        return this.repository.listApprovals(deviceId)
    }

    async recordAudit(input: CreateFieldAuditEventInput): Promise<FieldAuditEvent> {
        return this.repository.createAuditEvent({
            deviceId: input.deviceId,
            actor: input.actor,
            type: input.type,
            detail: input.detail,
            ticketId: input.ticketId
        })
    }
}
