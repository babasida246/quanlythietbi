/**
 * Security & Compliance Service
 */

// --- Interfaces (decoupled from infra) ---
export interface IRbacPermissionRepo {
    listAll(): Promise<unknown[]>
    getByRole(role: string): Promise<unknown[]>
    grantPermission(role: string, permissionId: string, grantedBy?: string): Promise<unknown>
    revokePermission(role: string, permissionId: string): Promise<boolean>
    checkPermission(role: string, permissionCode: string): Promise<boolean>
}

export interface AuditLogInput {
    userId: string
    action: string
    resourceType: string
    resourceId: string | null
    ipAddress: string | null
    userAgent: string | null
    details: Record<string, unknown>
    riskLevel: string
}

export interface ISecurityAuditRepo {
    log(input: AuditLogInput): Promise<unknown>
    search(filters: { userId?: string; action?: string; resourceType?: string; riskLevel?: string; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<unknown>
    getStats(): Promise<unknown>
}

export interface IComplianceRepo {
    listFrameworks(): Promise<unknown[]>
    createFramework(input: Record<string, unknown>): Promise<unknown>
    listControls(frameworkId: string): Promise<unknown[]>
    createControl(input: Record<string, unknown>): Promise<unknown>
    createAssessment(input: Record<string, unknown>): Promise<unknown>
    listAssessments(frameworkId: string): Promise<unknown[]>
    getLatestAssessment(frameworkId: string): Promise<unknown>
}

export interface SecurityContext {
    userId: string
    correlationId: string
    ipAddress?: string
    userAgent?: string
}

export class SecurityService {
    constructor(
        private rbac: IRbacPermissionRepo,
        private audit: ISecurityAuditRepo,
        private compliance: IComplianceRepo
    ) { }

    // --- RBAC ---
    async listPermissions() { return this.rbac.listAll() }
    async getRolePermissions(role: string) { return this.rbac.getByRole(role) }
    async grantPermission(role: string, permissionId: string, grantedBy?: string) { return this.rbac.grantPermission(role, permissionId, grantedBy) }
    async revokePermission(role: string, permissionId: string) { return this.rbac.revokePermission(role, permissionId) }
    async checkPermission(role: string, permissionCode: string) { return this.rbac.checkPermission(role, permissionCode) }

    // --- Audit ---
    async logAudit(input: AuditLogInput) { return this.audit.log(input) }
    async logAction(input: Record<string, unknown>) {
        return this.audit.log({
            userId: input.userId as string,
            action: input.action as string,
            resourceType: input.entityType as string ?? input.resourceType as string ?? 'unknown',
            resourceId: (input.entityId ?? input.resourceId ?? null) as string | null,
            ipAddress: (input.ipAddress ?? null) as string | null,
            userAgent: (input.userAgent ?? null) as string | null,
            details: (input.details ?? {}) as Record<string, unknown>,
            riskLevel: (input.riskLevel ?? 'info') as string
        })
    }
    async getAuditLogs(filters: Record<string, unknown>) {
        return this.audit.search({
            userId: filters.userId as string | undefined,
            action: filters.action as string | undefined,
            riskLevel: filters.riskLevel as string | undefined,
            startDate: filters.from as string | undefined,
            endDate: filters.to as string | undefined,
            limit: filters.limit as number | undefined,
            page: filters.offset !== undefined ? Math.floor((filters.offset as number) / (filters.limit as number || 50)) + 1 : undefined
        })
    }
    async searchAuditLogs(filters: { userId?: string; action?: string; resourceType?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) { return this.audit.search(filters) }
    async getAuditStats() { return this.audit.getStats() }

    // --- Compliance ---
    async listFrameworks() { return this.compliance.listFrameworks() }
    async createFramework(input: Record<string, unknown>) { return this.compliance.createFramework(input) }
    async listControls(frameworkId: string) { return this.compliance.listControls(frameworkId) }
    async createControl(input: Record<string, unknown>) { return this.compliance.createControl(input) }
    async createAssessment(input: Record<string, unknown>) { return this.compliance.createAssessment(input) }
    async listAssessments(filters: Record<string, unknown> | string) {
        if (typeof filters === 'string') return this.compliance.listAssessments(filters)
        return this.compliance.listAssessments(filters.frameworkId as string ?? '')
    }
    async getLatestAssessment(frameworkId: string) { return this.compliance.getLatestAssessment(frameworkId) }

    // --- Compliance Summary ---
    async getComplianceSummary(): Promise<Record<string, unknown>> {
        const frameworks = await this.compliance.listFrameworks() as Array<{ id: string; name: string; code: string }>
        const summary = []
        for (const fw of frameworks) {
            const controls = await this.compliance.listControls(fw.id) as unknown[]
            const latest = await this.compliance.getLatestAssessment(fw.id) as Record<string, unknown> | null
            summary.push({
                framework: fw.name,
                code: fw.code,
                totalControls: controls.length,
                latestAssessment: latest,
                status: latest ? 'assessed' : 'pending'
            })
        }
        return { frameworks: summary, totalFrameworks: frameworks.length }
    }

    // --- Security Middleware helper ---
    async auditRequest(ctx: SecurityContext, action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) {
        return this.audit.log({
            userId: ctx.userId,
            action,
            resourceType,
            resourceId: resourceId ?? null,
            ipAddress: ctx.ipAddress ?? null,
            userAgent: ctx.userAgent ?? null,
            details: details ?? {},
            riskLevel: this.calculateRiskLevel(action, resourceType)
        } as AuditLogInput)
    }

    private calculateRiskLevel(action: string, resourceType: string): string {
        if (action === 'delete' || action === 'bulk_delete') return 'high'
        if (resourceType === 'admin' || resourceType === 'security') return 'medium'
        if (action === 'export' || action === 'create') return 'low'
        return 'info'
    }
}
