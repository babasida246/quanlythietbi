/**
 * NetOps Contracts - Type definitions for Network Operations
 * 
 * This module provides shared types for:
 * - Device inventory management
 * - Configuration management & versioning
 * - Compliance/lint rules
 * - Change workflow
 * - Normalized configuration schema
 */

// ====================
// ENUMS & CONSTANTS
// ====================

export const DeviceVendor = {
    CISCO: 'cisco',
    MIKROTIK: 'mikrotik',
    FORTIGATE: 'fortigate',
    GENERIC: 'generic'
} as const

export type DeviceVendor = typeof DeviceVendor[keyof typeof DeviceVendor]

export const DeviceRole = {
    CORE: 'core',
    DISTRIBUTION: 'distribution',
    ACCESS: 'access',
    EDGE: 'edge',
    FIREWALL: 'firewall',
    WAN: 'wan',
    DATACENTER: 'datacenter',
    BRANCH: 'branch'
} as const

export type DeviceRole = typeof DeviceRole[keyof typeof DeviceRole]

export const DeviceStatus = {
    ACTIVE: 'active',
    MAINTENANCE: 'maintenance',
    DECOMMISSIONED: 'decommissioned',
    UNREACHABLE: 'unreachable'
} as const

export type DeviceStatus = typeof DeviceStatus[keyof typeof DeviceStatus]

export const ConfigType = {
    RUNNING: 'running',
    STARTUP: 'startup',
    CANDIDATE: 'candidate',
    GENERATED: 'generated',
    ROLLBACK: 'rollback'
} as const

export type ConfigType = typeof ConfigType[keyof typeof ConfigType]

export const ConfigSource = {
    PULL: 'pull',
    UPLOAD: 'upload',
    GENERATED: 'generated',
    ROLLBACK: 'rollback'
} as const

export type ConfigSource = typeof ConfigSource[keyof typeof ConfigSource]

export const ChangeRequestStatus = {
    DRAFT: 'draft',
    PLANNED: 'planned',
    CANDIDATE_READY: 'candidate_ready',
    VERIFIED: 'verified',
    WAITING_APPROVAL: 'waiting_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DEPLOYING: 'deploying',
    DEPLOYED: 'deployed',
    VERIFIED_POST: 'verified_post',
    FAILED: 'failed',
    ROLLED_BACK: 'rolled_back',
    CLOSED: 'closed'
} as const

export type ChangeRequestStatus = typeof ChangeRequestStatus[keyof typeof ChangeRequestStatus]

export const IntentType = {
    VLAN_TRUNK: 'vlan_trunk',
    FIREWALL_POLICY: 'firewall_policy',
    NAT_RULE: 'nat_rule',
    ROUTING: 'routing',
    ACL: 'acl',
    INTERFACE: 'interface',
    CUSTOM: 'custom'
} as const

export type IntentType = typeof IntentType[keyof typeof IntentType]

export const RiskLevel = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const

export type RiskLevel = typeof RiskLevel[keyof typeof RiskLevel]

export const LintSeverity = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    INFO: 'info'
} as const

export type LintSeverity = typeof LintSeverity[keyof typeof LintSeverity]

export const CredentialType = {
    SSH: 'ssh',
    API: 'api',
    SNMP: 'snmp',
    TELNET: 'telnet'
} as const

export type CredentialType = typeof CredentialType[keyof typeof CredentialType]

export const ApprovalDecision = {
    APPROVED: 'approved',
    REJECTED: 'rejected',
    WAIVED: 'waived'
} as const

export type ApprovalDecision = typeof ApprovalDecision[keyof typeof ApprovalDecision]

// ====================
// DEVICE TYPES
// ====================

export interface NetDevice {
    id: string
    name: string
    hostname: string
    vendor: DeviceVendor
    model?: string
    osVersion?: string
    mgmtIp: string
    site?: string
    role?: DeviceRole
    tags: string[]
    status: DeviceStatus
    lastSeenAt?: Date
    createdBy?: string
    createdAt: Date
    updatedAt: Date
}

export interface NetDeviceCredentialRef {
    id: string
    deviceId: string
    credentialType: CredentialType
    vaultRef: string
    usernameHint?: string
    priority: number
    isActive: boolean
    lastUsedAt?: Date
    lastSuccessAt?: Date
    failureCount: number
    createdAt: Date
    updatedAt: Date
}

export interface NetDeviceFacts {
    id: string
    deviceId: string
    facts: DeviceFactsData
    collectedAt: Date
    collectorVersion?: string
    collectionDurationMs?: number
    rawOutput?: string // Redacted
}

export interface DeviceFactsData {
    hostname: string
    serialNumber?: string
    uptime?: string
    uptimeSeconds?: number
    model?: string
    osVersion?: string
    memory?: { total: number; used: number; free: number }
    cpu?: { usage: number; cores?: number }
    interfaces?: InterfaceFact[]
    vlans?: VlanFact[]
    neighbors?: NeighborFact[]
}

export interface InterfaceFact {
    name: string
    adminStatus: 'up' | 'down'
    operStatus: 'up' | 'down'
    speed?: string
    duplex?: string
    mtu?: number
    macAddress?: string
    ipAddresses?: string[]
}

export interface VlanFact {
    id: number
    name: string
    status: 'active' | 'suspended'
    ports?: string[]
}

export interface NeighborFact {
    localInterface: string
    remoteDevice: string
    remoteInterface: string
    protocol: 'cdp' | 'lldp'
}

// ====================
// CONFIGURATION TYPES
// ====================

export interface NetConfigVersion {
    id: string
    deviceId: string
    configType: ConfigType
    rawConfig: string // Redacted
    configHash: string
    normalizedConfig?: NormalizedConfig
    parserVersion?: string
    parseErrors?: ParseError[]
    fileSizeBytes?: number
    lineCount?: number
    collectedAt: Date
    collectedBy?: string
    source: ConfigSource
    parentVersionId?: string
    metadata: Record<string, unknown>
}

export interface ParseError {
    line?: number
    message: string
    severity: 'error' | 'warning'
}

// ====================
// NORMALIZED CONFIG SCHEMA v1
// ====================

export interface NormalizedConfig {
    schemaVersion: '1.0.0'
    device: NormalizedDeviceInfo
    interfaces: NormalizedInterface[]
    vlans: NormalizedVlan[]
    routing: NormalizedRouting
    security: NormalizedSecurity
    mgmt: NormalizedManagement
    metadata: NormalizedMetadata
}

export interface NormalizedDeviceInfo {
    vendor: DeviceVendor
    hostname: string
    mgmtIp?: string
    osVersion?: string
    model?: string
    domain?: string
}

export interface NormalizedInterface {
    name: string
    type: 'physical' | 'vlan' | 'loopback' | 'tunnel' | 'aggregate' | 'bridge' | 'virtual'
    adminUp: boolean
    ips: NormalizedIpAddress[]
    vlanMode?: 'access' | 'trunk' | 'hybrid'
    accessVlan?: number
    trunkVlans?: number[]
    nativeVlan?: number
    description?: string
    zone?: string
    mtu?: number
    speed?: string
    duplex?: 'auto' | 'full' | 'half'
}

export interface NormalizedIpAddress {
    address: string
    prefix: number
    type: 'ipv4' | 'ipv6'
    secondary?: boolean
}

export interface NormalizedVlan {
    id: number
    name?: string
    l3GatewayIps: string[]
    description?: string
    status?: 'active' | 'suspended'
}

export interface NormalizedRouting {
    staticRoutes: NormalizedStaticRoute[]
    ospf?: NormalizedOspf
    bgp?: NormalizedBgp
    defaultGateway?: string
}

export interface NormalizedStaticRoute {
    destination: string
    prefix: number
    nextHop?: string
    interface?: string
    metric?: number
    vrf?: string
}

export interface NormalizedOspf {
    routerId?: string
    processes: Array<{
        processId: number | string
        areas: Array<{
            areaId: string
            networks: string[]
            type?: 'normal' | 'stub' | 'nssa'
        }>
    }>
}

export interface NormalizedBgp {
    asn: number
    routerId?: string
    neighbors: Array<{
        address: string
        remoteAs: number
        description?: string
        state?: string
    }>
}

export interface NormalizedSecurity {
    acls: NormalizedAcl[]
    firewallPolicies: NormalizedFirewallPolicy[]
    natRules: NormalizedNatRule[]
    vpnTunnels: NormalizedVpnTunnel[]
    users?: Array<{
        name: string
        role?: string
        privilege?: number
    }>
}

export interface NormalizedAcl {
    name: string
    type: 'standard' | 'extended' | 'named'
    rules: NormalizedAclRule[]
}

export interface NormalizedAclRule {
    sequence?: number
    action: 'permit' | 'deny'
    protocol?: string
    source: string
    sourcePort?: string
    destination: string
    destinationPort?: string
    log?: boolean
}

export interface NormalizedFirewallPolicy {
    id: string | number
    name?: string
    srcZone: string | string[]
    dstZone: string | string[]
    srcAddr: string | string[]
    dstAddr: string | string[]
    service: string | string[]
    action: 'accept' | 'deny' | 'drop' | 'reject'
    nat?: boolean
    log?: boolean
    enabled?: boolean
    schedule?: string
    comment?: string
}

export interface NormalizedNatRule {
    id: string | number
    name?: string
    type: 'snat' | 'dnat' | 'static' | 'masquerade' | 'pat'
    srcAddr?: string
    dstAddr?: string
    translatedAddr?: string
    srcPort?: string
    dstPort?: string
    translatedPort?: string
    interface?: string
    enabled?: boolean
}

export interface NormalizedVpnTunnel {
    name: string
    type: 'ipsec' | 'ssl' | 'gre' | 'l2tp' | 'wireguard'
    localEndpoint?: string
    remoteEndpoint?: string
    phase1?: {
        encryption?: string[]
        hash?: string[]
        dhGroup?: number[]
        lifetime?: number
    }
    phase2?: {
        encryption?: string[]
        hash?: string[]
        pfs?: string
        lifetime?: number
    }
    status?: 'up' | 'down'
}

export interface NormalizedManagement {
    ssh: {
        enabled: boolean
        port?: number
        version?: number
        allowedSources?: string[]
    }
    telnet: {
        enabled: boolean
        port?: number
    }
    snmp: {
        enabled: boolean
        version?: 'v1' | 'v2c' | 'v3'
        communities?: string[] // REDACTED - only presence checked
        users?: string[]
    }
    syslog: {
        enabled: boolean
        servers: Array<{
            address: string
            port?: number
            protocol?: 'udp' | 'tcp' | 'tls'
            facility?: string
            severity?: string
        }>
    }
    ntp: {
        enabled: boolean
        servers: Array<{
            address: string
            prefer?: boolean
            key?: number
        }>
        timezone?: string
    }
    aaa: {
        tacacs?: { servers: string[]; enabled: boolean }
        radius?: { servers: string[]; enabled: boolean }
        localUsers?: string[]
    }
}

export interface NormalizedMetadata {
    extractedAt: Date
    parserVersion: string
    vendor: DeviceVendor
    warnings?: string[]
    rawLineCount?: number
}

// ====================
// LINT & COMPLIANCE TYPES
// ====================

export interface NetRulepack {
    id: string
    name: string
    version: string
    description?: string
    vendorScope: DeviceVendor[]
    isActive: boolean
    isBuiltin: boolean
    rules: LintRule[]
    ruleCount: number
    createdBy?: string
    createdAt: Date
    updatedAt: Date
    activatedAt?: Date
}

export interface LintRule {
    id: string
    title: string
    description?: string
    severity: LintSeverity
    vendorScope: DeviceVendor[]
    match: LintMatch
    remediation?: string
    waivable: boolean
}

export interface LintMatch {
    type: 'jsonpath' | 'regex' | 'custom'
    path?: string
    pattern?: string
    operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'not_empty' | 'empty' | 'matches' | 'exists'
    value?: unknown
    predicate?: string // For custom predicates
}

export interface NetLintRun {
    id: string
    targetType: 'device' | 'config_version' | 'change_set'
    targetId: string
    rulepackId: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    findings: LintFinding[]
    summary?: LintSummary
    rulesEvaluated: number
    rulesPassed: number
    rulesFailed: number
    rulesSkipped: number
    startedAt?: Date
    completedAt?: Date
    durationMs?: number
    triggeredBy?: string
    createdAt: Date
}

export interface LintFinding {
    id: string
    ruleId: string
    ruleName: string
    severity: LintSeverity
    message: string
    path?: string
    line?: number
    value?: unknown
    remediation?: string
    waived?: boolean
    waivedBy?: string
    waivedAt?: Date
    waiverReason?: string
}

export interface LintSummary {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    waived: number
    total: number
    passed: boolean
}

// ====================
// CHANGE WORKFLOW TYPES
// ====================

export interface NetChangeRequest {
    id: string
    title: string
    description?: string
    intentType?: IntentType
    intentParams?: Record<string, unknown>
    deviceScope: string[]
    status: ChangeRequestStatus
    riskLevel: RiskLevel
    requiredApprovals: number
    lintBlocking: boolean
    rollbackPlan?: string
    preCheckCommands?: string[]
    postCheckCommands?: string[]
    createdBy: string
    assignedTo?: string
    createdAt: Date
    updatedAt: Date
    plannedAt?: Date
    submittedAt?: Date
    approvedAt?: Date
    deployedAt?: Date
    closedAt?: Date
}

export interface NetChangeSet {
    id: string
    changeRequestId: string
    deviceId: string
    sequenceOrder: number
    baselineConfigId?: string
    candidateConfigId?: string
    deployedConfigId?: string
    diffSummary?: DiffSummary
    commandsToApply?: string[]
    rollbackCommands?: string[]
    status: 'pending' | 'ready' | 'deploying' | 'deployed' | 'failed' | 'rolled_back' | 'skipped'
    deployStartedAt?: Date
    deployCompletedAt?: Date
    deployOutput?: string
    createdAt: Date
    updatedAt: Date
}

export interface DiffSummary {
    linesAdded: number
    linesRemoved: number
    sectionsChanged: string[]
}

export interface NetApproval {
    id: string
    changeRequestId: string
    approverId: string
    decision: ApprovalDecision
    comments?: string
    waivedFindings?: string[]
    decidedAt: Date
    createdAt: Date
}

export interface NetDeployment {
    id: string
    changeRequestId: string
    changeSetId?: string
    deviceId: string
    deploymentType: 'apply' | 'rollback' | 'dry_run'
    status: 'pending' | 'running' | 'success' | 'failed' | 'timeout'
    commandsExecuted?: string[]
    output?: string
    errorMessage?: string
    startedAt?: Date
    completedAt?: Date
    durationMs?: number
    executedBy?: string
    createdAt: Date
}

// ====================
// AUDIT TYPES
// ====================

export interface NetAuditEvent {
    id: string
    correlationId?: string
    eventType: string
    actorId?: string
    actorRole?: string
    resourceType: string
    resourceId: string
    action: string
    details: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
    createdAt: Date
}

export const NetAuditEventType = {
    DEVICE_CREATED: 'device.created',
    DEVICE_UPDATED: 'device.updated',
    DEVICE_DELETED: 'device.deleted',
    CONFIG_PULLED: 'config.pulled',
    CONFIG_UPLOADED: 'config.uploaded',
    CONFIG_PARSED: 'config.parsed',
    LINT_STARTED: 'lint.started',
    LINT_COMPLETED: 'lint.completed',
    CHANGE_CREATED: 'change.created',
    CHANGE_PLANNED: 'change.planned',
    CHANGE_GENERATED: 'change.generated',
    CHANGE_VERIFIED: 'change.verified',
    CHANGE_SUBMITTED: 'change.submitted',
    CHANGE_APPROVED: 'change.approved',
    CHANGE_REJECTED: 'change.rejected',
    CHANGE_DEPLOYED: 'change.deployed',
    CHANGE_FAILED: 'change.failed',
    CHANGE_ROLLED_BACK: 'change.rolled_back',
    CHANGE_CLOSED: 'change.closed'
} as const

// ====================
// REPOSITORY INTERFACES
// ====================

export interface INetDeviceRepository {
    findById(id: string): Promise<NetDevice | null>
    findAll(filters?: DeviceFilters): Promise<NetDevice[]>
    findByHostname(hostname: string, site?: string): Promise<NetDevice | null>
    create(device: Omit<NetDevice, 'id' | 'createdAt' | 'updatedAt'>): Promise<NetDevice>
    update(id: string, updates: Partial<NetDevice>): Promise<NetDevice | null>
    delete(id: string): Promise<boolean>
    count(filters?: DeviceFilters): Promise<number>
}

export interface DeviceFilters {
    vendor?: DeviceVendor
    site?: string
    role?: DeviceRole
    status?: DeviceStatus
    tags?: string[]
    search?: string
    limit?: number
    offset?: number
}

export interface INetConfigRepository {
    findById(id: string): Promise<NetConfigVersion | null>
    findByDeviceId(deviceId: string, limit?: number): Promise<NetConfigVersion[]>
    findLatestByDeviceId(deviceId: string, configType?: ConfigType): Promise<NetConfigVersion | null>
    create(config: Omit<NetConfigVersion, 'id' | 'collectedAt'>): Promise<NetConfigVersion>
    updateNormalized(id: string, normalized: NormalizedConfig, parserVersion: string, errors?: ParseError[]): Promise<void>
}

export interface INetRulepackRepository {
    findById(id: string): Promise<NetRulepack | null>
    findActive(): Promise<NetRulepack[]>
    findAll(): Promise<NetRulepack[]>
    create(rulepack: Omit<NetRulepack, 'id' | 'ruleCount' | 'createdAt' | 'updatedAt'>): Promise<NetRulepack>
    activate(id: string): Promise<void>
    deactivate(id: string): Promise<void>
}

export interface INetLintRepository {
    findById(id: string): Promise<NetLintRun | null>
    findByTarget(targetType: string, targetId: string): Promise<NetLintRun[]>
    create(run: Omit<NetLintRun, 'id' | 'createdAt'>): Promise<NetLintRun>
    update(id: string, updates: Partial<NetLintRun>): Promise<void>
}

export interface INetChangeRepository {
    findById(id: string): Promise<NetChangeRequest | null>
    findAll(filters?: ChangeFilters): Promise<NetChangeRequest[]>
    create(change: Omit<NetChangeRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<NetChangeRequest>
    updateStatus(id: string, status: ChangeRequestStatus, metadata?: Record<string, unknown>): Promise<void>
    getChangeSets(changeId: string): Promise<NetChangeSet[]>
    createChangeSet(set: Omit<NetChangeSet, 'id' | 'createdAt' | 'updatedAt'>): Promise<NetChangeSet>
    updateChangeSet(id: string, updates: Partial<NetChangeSet>): Promise<void>
    getApprovals(changeId: string): Promise<NetApproval[]>
    createApproval(approval: Omit<NetApproval, 'id' | 'createdAt'>): Promise<NetApproval>
}

export interface ChangeFilters {
    status?: ChangeRequestStatus | ChangeRequestStatus[]
    createdBy?: string
    assignedTo?: string
    deviceId?: string
    limit?: number
    offset?: number
}

export interface INetAuditRepository {
    log(event: Omit<NetAuditEvent, 'id' | 'createdAt'>): Promise<void>
    findByResource(resourceType: string, resourceId: string): Promise<NetAuditEvent[]>
    findByActor(actorId: string, limit?: number): Promise<NetAuditEvent[]>
}

// ====================
// PARSER INTERFACES
// ====================

export interface IVendorParser {
    vendor: DeviceVendor
    version: string

    /**
     * Parse raw config into normalized format
     */
    parse(rawConfig: string): Promise<ParseResult>

    /**
     * Check if this parser can handle the given config
     */
    canParse(rawConfig: string): boolean
}

export interface ParseResult {
    normalized: NormalizedConfig
    errors: ParseError[]
    warnings: string[]
    rawLineCount: number
}

// ====================
// COLLECTOR INTERFACES
// ====================

export interface IDeviceCollector {
    vendor: DeviceVendor

    /**
     * Collect device facts (show version, inventory, etc.)
     */
    collectFacts(connection: DeviceConnection): Promise<DeviceFactsData>

    /**
     * Pull running/startup configuration
     */
    pullConfig(connection: DeviceConnection, configType: ConfigType): Promise<string>

    /**
     * Test connectivity
     */
    testConnection(connection: DeviceConnection): Promise<boolean>
}

export interface DeviceConnection {
    host: string
    port?: number
    credentials: ResolvedCredentials
    timeout?: number
}

export interface ResolvedCredentials {
    type: CredentialType
    username: string
    password?: string
    privateKey?: string
    apiKey?: string
}

// ====================
// UTILITY TYPES
// ====================

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface PaginatedResult<T> {
    items: T[]
    total: number
    limit: number
    offset: number
    hasMore: boolean
}
