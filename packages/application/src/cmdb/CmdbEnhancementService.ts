/**
 * CMDB Enhancement Service
 * Discovery, impact analysis, smart tagging
 */

// --- Interfaces (decoupled from infra) ---
export interface DiscoveryRule {
    id: string
    name: string
    ruleType: string
    config: Record<string, unknown>
    schedule: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export interface IDiscoveryRuleRepo {
    create(input: Omit<DiscoveryRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<DiscoveryRule>
    list(): Promise<DiscoveryRule[]>
    getById(id: string): Promise<DiscoveryRule | null>
    delete(id: string): Promise<boolean>
}

export interface IDiscoveryResultRepo {
    listByRule(ruleId: string, status?: string): Promise<unknown[]>
    updateStatus(id: string, status: string, reviewedBy: string): Promise<unknown>
}

export interface SmartTag {
    id: string
    tagName: string
    tagCategory: string
    color: string | null
    autoAssignRules: Record<string, unknown>
    createdAt: Date
}

export interface ISmartTagRepo {
    create(input: Omit<SmartTag, 'id' | 'createdAt'>): Promise<SmartTag>
    list(): Promise<SmartTag[]>
    delete(id: string): Promise<boolean>
    assignTag(ciId: string, tagId: string, by: string): Promise<unknown>
    removeTag(ciId: string, tagId: string): Promise<boolean>
    getTagsByCi(ciId: string): Promise<unknown[]>
}

export interface IChangeAssessmentRepo {
    create(input: Record<string, unknown>): Promise<unknown>
    list(status?: string): Promise<unknown[]>
    getById(id: string): Promise<unknown>
    updateStatus(id: string, status: string, reviewedBy?: string): Promise<unknown>
}

export interface CmdbEnhancementContext {
    userId: string
    correlationId: string
}

export class CmdbEnhancementService {
    constructor(
        private discoveryRules: IDiscoveryRuleRepo,
        private discoveryResults: IDiscoveryResultRepo,
        private smartTags: ISmartTagRepo,
        private changeAssessments: IChangeAssessmentRepo
    ) { }

    // --- Discovery ---
    async createDiscoveryRule(input: Omit<DiscoveryRule, 'id' | 'createdAt' | 'updatedAt'>) {
        return this.discoveryRules.create(input)
    }
    async listDiscoveryRules() { return this.discoveryRules.list() }
    async getDiscoveryRule(id: string) { return this.discoveryRules.getById(id) }
    async deleteDiscoveryRule(id: string) { return this.discoveryRules.delete(id) }

    async getDiscoveryResults(ruleId: string, status?: string) {
        return this.discoveryResults.listByRule(ruleId, status)
    }
    async reviewDiscoveryResult(id: string, status: string, reviewedBy: string) {
        return this.discoveryResults.updateStatus(id, status, reviewedBy)
    }

    // --- Smart Tags ---
    async createTag(input: Omit<SmartTag, 'id' | 'createdAt'>) { return this.smartTags.create(input) }
    async listTags() { return this.smartTags.list() }
    async deleteTag(id: string) { return this.smartTags.delete(id) }
    async assignTag(ciId: string, tagId: string, by = 'manual') { return this.smartTags.assignTag(ciId, tagId, by) }
    async removeTag(ciId: string, tagId: string) { return this.smartTags.removeTag(ciId, tagId) }
    async getCiTags(ciId: string) { return this.smartTags.getTagsByCi(ciId) }

    // --- Change Impact Assessment ---
    async createAssessment(input: Record<string, unknown>) {
        return this.changeAssessments.create(input)
    }
    async listAssessments(status?: string) { return this.changeAssessments.list(status) }
    async getAssessment(id: string) { return this.changeAssessments.getById(id) }
    async updateAssessmentStatus(id: string, status: string, reviewedBy?: string) {
        return this.changeAssessments.updateStatus(id, status, reviewedBy)
    }

    // --- Impact Analysis ---
    async analyzeImpact(ciIds: string[]): Promise<Record<string, unknown>> {
        // Simplistic impact analysis based on tags and relationships
        const allTags: Record<string, unknown[]> = {}
        for (const ciId of ciIds) {
            allTags[ciId] = await this.smartTags.getTagsByCi(ciId)
        }
        const criticalCount = Object.values(allTags).flat().filter((t: any) => t.tagCategory === 'critical').length
        const riskScore = Math.min(10, criticalCount * 2 + ciIds.length * 0.5)

        return {
            affectedCis: ciIds.length,
            criticalDependencies: criticalCount,
            riskScore,
            recommendation: riskScore > 7 ? 'High risk - require senior approval' :
                riskScore > 4 ? 'Medium risk - review carefully' : 'Low risk - proceed with standard process',
            tagsByCI: allTags
        }
    }
}
