/**
 * CMDB Enhancement Repository
 * Discovery, impact analysis, smart tags
 */
import type { PgClient } from '../PgClient.js'

export interface DiscoveryRule {
    id: string
    name: string
    discoveryType: string
    scope: unknown[]
    scheduleCron: string | null
    mappingRules: unknown[]
    isActive: boolean
    lastRunAt: Date | null
    lastStatus: string | null
    createdAt: Date
    updatedAt: Date
}

export interface DiscoveryResult {
    id: string
    ruleId: string
    discoveredData: Record<string, unknown>
    status: string
    confidence: number
    ciId: string | null
    reviewedBy: string | null
    reviewedAt: Date | null
    createdAt: Date
}

export interface SmartTag {
    id: string
    tagName: string
    tagCategory: string
    color: string
    description: string | null
    autoAssignRules: unknown[]
    createdAt: Date
}

export interface ChangeAssessment {
    id: string
    title: string
    description: string | null
    targetCiIds: string[]
    impactAnalysis: Record<string, unknown>
    riskScore: number
    status: string
    createdBy: string | null
    reviewedBy: string | null
    createdAt: Date
    updatedAt: Date
}

export class DiscoveryRuleRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<DiscoveryRule, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastStatus'>): Promise<DiscoveryRule> {
        const result = await this.pg.query(
            `INSERT INTO cmdb_discovery_rules (name, discovery_type, scope, schedule_cron, mapping_rules, is_active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [input.name, input.discoveryType, JSON.stringify(input.scope),
            input.scheduleCron, JSON.stringify(input.mappingRules), input.isActive]
        )
        return this.mapRow(result.rows[0])
    }

    async list(): Promise<DiscoveryRule[]> {
        const result = await this.pg.query(`SELECT * FROM cmdb_discovery_rules ORDER BY name`)
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async getById(id: string): Promise<DiscoveryRule | null> {
        const result = await this.pg.query(`SELECT * FROM cmdb_discovery_rules WHERE id = $1`, [id])
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM cmdb_discovery_rules WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    private mapRow(row: any): DiscoveryRule {
        return {
            id: row.id, name: row.name, discoveryType: row.discovery_type,
            scope: row.scope ?? [], scheduleCron: row.schedule_cron,
            mappingRules: row.mapping_rules ?? [], isActive: row.is_active,
            lastRunAt: row.last_run_at, lastStatus: row.last_status,
            createdAt: row.created_at, updatedAt: row.updated_at
        }
    }
}

export class DiscoveryResultRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<DiscoveryResult, 'id' | 'createdAt'>): Promise<DiscoveryResult> {
        const result = await this.pg.query(
            `INSERT INTO cmdb_discovery_results (rule_id, discovered_data, status, confidence, ci_id, reviewed_by, reviewed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [input.ruleId, JSON.stringify(input.discoveredData), input.status,
            input.confidence, input.ciId, input.reviewedBy, input.reviewedAt]
        )
        return this.mapRow(result.rows[0])
    }

    async listByRule(ruleId: string, status?: string): Promise<DiscoveryResult[]> {
        const conditions = ['rule_id = $1']
        const params: unknown[] = [ruleId]
        if (status) { params.push(status); conditions.push(`status = $${params.length}`) }
        const result = await this.pg.query(
            `SELECT * FROM cmdb_discovery_results WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
            params
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async updateStatus(id: string, status: string, reviewedBy?: string): Promise<DiscoveryResult | null> {
        const result = await this.pg.query(
            `UPDATE cmdb_discovery_results SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3 RETURNING *`,
            [status, reviewedBy ?? null, id]
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    private mapRow(row: any): DiscoveryResult {
        return {
            id: row.id, ruleId: row.rule_id, discoveredData: row.discovered_data ?? {},
            status: row.status, confidence: parseFloat(row.confidence),
            ciId: row.ci_id, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
            createdAt: row.created_at
        }
    }
}

export class SmartTagRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<SmartTag, 'id' | 'createdAt'>): Promise<SmartTag> {
        const result = await this.pg.query(
            `INSERT INTO cmdb_smart_tags (tag_name, tag_category, color, description, auto_assign_rules)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [input.tagName, input.tagCategory, input.color, input.description, JSON.stringify(input.autoAssignRules)]
        )
        return this.mapRow(result.rows[0])
    }

    async list(): Promise<SmartTag[]> {
        const result = await this.pg.query(`SELECT * FROM cmdb_smart_tags ORDER BY tag_category, tag_name`)
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM cmdb_smart_tags WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    async assignTag(ciId: string, tagId: string, assignedBy = 'manual'): Promise<void> {
        await this.pg.query(
            `INSERT INTO cmdb_ci_tags (ci_id, tag_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [ciId, tagId, assignedBy]
        )
    }

    async removeTag(ciId: string, tagId: string): Promise<void> {
        await this.pg.query(`DELETE FROM cmdb_ci_tags WHERE ci_id = $1 AND tag_id = $2`, [ciId, tagId])
    }

    async getTagsByCi(ciId: string): Promise<SmartTag[]> {
        const result = await this.pg.query(
            `SELECT t.* FROM cmdb_smart_tags t JOIN cmdb_ci_tags ct ON ct.tag_id = t.id WHERE ct.ci_id = $1`,
            [ciId]
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    private mapRow(row: any): SmartTag {
        return {
            id: row.id, tagName: row.tag_name, tagCategory: row.tag_category,
            color: row.color, description: row.description,
            autoAssignRules: row.auto_assign_rules ?? [], createdAt: row.created_at
        }
    }
}

export class ChangeAssessmentRepo {
    constructor(private pg: PgClient) { }

    async create(input: Omit<ChangeAssessment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChangeAssessment> {
        const result = await this.pg.query(
            `INSERT INTO cmdb_change_assessments (title, description, target_ci_ids, impact_analysis, risk_score, status, created_by, reviewed_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [input.title, input.description, input.targetCiIds, JSON.stringify(input.impactAnalysis),
            input.riskScore, input.status, input.createdBy, input.reviewedBy]
        )
        return this.mapRow(result.rows[0])
    }

    async list(status?: string): Promise<ChangeAssessment[]> {
        const conditions: string[] = []
        const params: unknown[] = []
        if (status) { params.push(status); conditions.push(`status = $${params.length}`) }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
        const result = await this.pg.query(
            `SELECT * FROM cmdb_change_assessments ${where} ORDER BY created_at DESC`, params
        )
        return result.rows.map((r: any) => this.mapRow(r))
    }

    async getById(id: string): Promise<ChangeAssessment | null> {
        const result = await this.pg.query(`SELECT * FROM cmdb_change_assessments WHERE id = $1`, [id])
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    async updateStatus(id: string, status: string, reviewedBy?: string): Promise<ChangeAssessment | null> {
        const result = await this.pg.query(
            `UPDATE cmdb_change_assessments SET status = $1, reviewed_by = COALESCE($2, reviewed_by), updated_at = NOW() WHERE id = $3 RETURNING *`,
            [status, reviewedBy, id]
        )
        return result.rows.length ? this.mapRow(result.rows[0]) : null
    }

    private mapRow(row: any): ChangeAssessment {
        return {
            id: row.id, title: row.title, description: row.description,
            targetCiIds: row.target_ci_ids ?? [], impactAnalysis: row.impact_analysis ?? {},
            riskScore: parseFloat(row.risk_score), status: row.status,
            createdBy: row.created_by, reviewedBy: row.reviewed_by,
            createdAt: row.created_at, updatedAt: row.updated_at
        }
    }
}
