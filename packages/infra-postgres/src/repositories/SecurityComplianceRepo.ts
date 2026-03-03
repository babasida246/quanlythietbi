/**
 * Security & Compliance Repository
 * RBAC, audit logs, compliance frameworks
 */
import type { PgClient } from '../PgClient.js'

export interface RbacPermission {
    id: string
    code: string
    name: string
    description: string | null
    module: string
    action: string
    createdAt: Date
}

export interface SecurityAuditLog {
    id: string
    userId: string | null
    action: string
    resourceType: string
    resourceId: string | null
    ipAddress: string | null
    userAgent: string | null
    details: Record<string, unknown>
    riskLevel: string
    createdAt: Date
}

export interface ComplianceFramework {
    id: string
    code: string
    name: string
    description: string | null
    version: string | null
    isActive: boolean
    createdAt: Date
}

export interface ComplianceControl {
    id: string
    frameworkId: string
    controlCode: string
    title: string
    description: string | null
    category: string | null
    checkType: string
    checkQuery: string | null
    severity: string | null
    createdAt: Date
}

export interface ComplianceAssessment {
    id: string
    frameworkId: string
    assessmentDate: Date
    totalControls: number
    passedControls: number
    failedControls: number
    notApplicable: number
    score: number
    status: string
    assessedBy: string | null
    results: unknown[]
    createdAt: Date
}

export class RbacPermissionRepo {
    constructor(private pg: PgClient) { }

    async listAll(): Promise<RbacPermission[]> {
        const result = await this.pg.query(`SELECT * FROM rbac_permissions ORDER BY module, action`)
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async getByRole(role: string): Promise<RbacPermission[]> {
        const result = await this.pg.query(
            `SELECT p.* FROM rbac_permissions p JOIN rbac_role_permissions rp ON rp.permission_id = p.id WHERE rp.role = $1 ORDER BY p.module, p.action`,
            [role]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async grantPermission(role: string, permissionId: string, grantedBy?: string): Promise<void> {
        await this.pg.query(
            `INSERT INTO rbac_role_permissions (role, permission_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [role, permissionId, grantedBy ?? null]
        )
    }

    async revokePermission(role: string, permissionId: string): Promise<void> {
        await this.pg.query(
            `DELETE FROM rbac_role_permissions WHERE role = $1 AND permission_id = $2`, [role, permissionId]
        )
    }

    async checkPermission(role: string, permissionCode: string): Promise<boolean> {
        const result = await this.pg.query(
            `SELECT COUNT(*) AS count FROM rbac_role_permissions rp JOIN rbac_permissions p ON p.id = rp.permission_id WHERE rp.role = $1 AND p.code = $2`,
            [role, permissionCode]
        )
        return parseInt(result.rows[0]?.count ?? '0') > 0
    }

    private mapRow(row: any): RbacPermission {
        return {
            id: row.id, code: row.code, name: row.name, description: row.description,
            module: row.module, action: row.action, createdAt: row.created_at
        }
    }
}

export class SecurityAuditRepo {
    constructor(private pg: PgClient) { }

    async log(input: Omit<SecurityAuditLog, 'id' | 'createdAt'>): Promise<SecurityAuditLog> {
        const result = await this.pg.query(
            `INSERT INTO security_audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details, risk_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [input.userId, input.action, input.resourceType, input.resourceId,
            input.ipAddress, input.userAgent, JSON.stringify(input.details), input.riskLevel]
        )
        return this.mapRow(result.rows[0])
    }

    async search(filters: { userId?: string; action?: string; riskLevel?: string; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<{ items: SecurityAuditLog[]; total: number }> {
        const conditions: string[] = []
        const params: unknown[] = []
        if (filters.userId) { params.push(filters.userId); conditions.push(`user_id = $${params.length}`) }
        if (filters.action) { params.push(filters.action); conditions.push(`action = $${params.length}`) }
        if (filters.riskLevel) { params.push(filters.riskLevel); conditions.push(`risk_level = $${params.length}`) }
        if (filters.startDate) { params.push(filters.startDate); conditions.push(`created_at >= $${params.length}`) }
        if (filters.endDate) { params.push(filters.endDate); conditions.push(`created_at <= $${params.length}`) }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
        const page = Math.max(1, filters.page ?? 1)
        const limit = Math.min(Math.max(1, filters.limit ?? 50), 200)
        const offset = (page - 1) * limit

        const countResult = await this.pg.query(`SELECT COUNT(*) AS count FROM security_audit_logs ${where}`, params)
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        params.push(limit, offset)
        const result = await this.pg.query(
            `SELECT * FROM security_audit_logs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        )
        return { items: result.rows.map((r: any) => this.mapRow(r)), total }
    }

    async getStats(): Promise<Record<string, unknown>> {
        const result = await this.pg.query(`
            SELECT
                COUNT(*) AS total_events,
                COUNT(*) FILTER (WHERE risk_level = 'critical') AS critical_events,
                COUNT(*) FILTER (WHERE risk_level = 'high') AS high_events,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS recent_events,
                COUNT(DISTINCT user_id) AS unique_users
            FROM security_audit_logs
        `)
        return result.rows[0]
    }

    private mapRow(row: any): SecurityAuditLog {
        return {
            id: row.id, userId: row.user_id, action: row.action,
            resourceType: row.resource_type, resourceId: row.resource_id,
            ipAddress: row.ip_address, userAgent: row.user_agent,
            details: row.details ?? {}, riskLevel: row.risk_level,
            createdAt: row.created_at
        }
    }
}

export class ComplianceRepo {
    constructor(private pg: PgClient) { }

    async listFrameworks(): Promise<ComplianceFramework[]> {
        const result = await this.pg.query(`SELECT * FROM compliance_frameworks WHERE is_active = true ORDER BY name`)
        return result.rows.map((r: any) => ({
            id: r.id, code: r.code, name: r.name, description: r.description,
            version: r.version, isActive: r.is_active, createdAt: r.created_at
        }))
    }

    async createFramework(input: Record<string, unknown>): Promise<ComplianceFramework> {
        const result = await this.pg.query(
            `INSERT INTO compliance_frameworks (code, name, description, version) VALUES ($1, $2, $3, $4) RETURNING *`,
            [input.code, input.name, input.description ?? null, input.version ?? '1.0']
        )
        const r = result.rows[0]
        return { id: r.id, code: r.code, name: r.name, description: r.description, version: r.version, isActive: r.is_active, createdAt: r.created_at }
    }

    async createControl(input: Omit<ComplianceControl, 'id' | 'createdAt'>): Promise<ComplianceControl> {
        const result = await this.pg.query(
            `INSERT INTO compliance_controls (framework_id, control_code, title, description, category, check_type, check_query, severity)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [input.frameworkId, input.controlCode, input.title, input.description,
            input.category, input.checkType, input.checkQuery, input.severity]
        )
        return this.mapControlRow(result.rows[0])
    }

    async listControls(frameworkId: string): Promise<ComplianceControl[]> {
        const result = await this.pg.query(
            `SELECT * FROM compliance_controls WHERE framework_id = $1 ORDER BY control_code`, [frameworkId]
        )
        return result.rows.map((r: any) => this.mapControlRow(r))
    }

    async createAssessment(input: Omit<ComplianceAssessment, 'id' | 'createdAt'>): Promise<ComplianceAssessment> {
        const result = await this.pg.query(
            `INSERT INTO compliance_assessments (framework_id, assessment_date, total_controls, passed_controls, failed_controls, not_applicable, score, status, assessed_by, results)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [input.frameworkId, input.assessmentDate, input.totalControls, input.passedControls,
            input.failedControls, input.notApplicable, input.score, input.status, input.assessedBy, JSON.stringify(input.results)]
        )
        return this.mapAssessmentRow(result.rows[0])
    }

    async listAssessments(frameworkId: string): Promise<ComplianceAssessment[]> {
        const result = await this.pg.query(
            `SELECT * FROM compliance_assessments WHERE framework_id = $1 ORDER BY assessment_date DESC`, [frameworkId]
        )
        return result.rows.map((r: any) => this.mapAssessmentRow(r))
    }

    async getLatestAssessment(frameworkId: string): Promise<ComplianceAssessment | null> {
        const result = await this.pg.query(
            `SELECT * FROM compliance_assessments WHERE framework_id = $1 ORDER BY assessment_date DESC LIMIT 1`, [frameworkId]
        )
        return result.rows.length ? this.mapAssessmentRow(result.rows[0]) : null
    }

    private mapControlRow(row: any): ComplianceControl {
        return {
            id: row.id, frameworkId: row.framework_id, controlCode: row.control_code,
            title: row.title, description: row.description, category: row.category,
            checkType: row.check_type, checkQuery: row.check_query, severity: row.severity,
            createdAt: row.created_at
        }
    }

    private mapAssessmentRow(row: any): ComplianceAssessment {
        return {
            id: row.id, frameworkId: row.framework_id, assessmentDate: row.assessment_date,
            totalControls: row.total_controls, passedControls: row.passed_controls,
            failedControls: row.failed_controls, notApplicable: row.not_applicable,
            score: parseFloat(row.score), status: row.status, assessedBy: row.assessed_by,
            results: row.results ?? [], createdAt: row.created_at
        }
    }
}
