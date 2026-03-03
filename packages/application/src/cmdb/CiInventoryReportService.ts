import type { CiRecord, CiTypeRecord, ICiRepo, ICiTypeRepo, IRelRepo } from '@qltb/contracts'

interface NormalizedCi {
    id: string
    typeId: string
    ciCode: string
    name: string
    status: string
    environment: string
    createdAt: Date
}

interface NormalizedRelationship {
    fromCiId: string
    toCiId: string
}

export interface CiCountByType {
    typeId: string
    typeName: string
    count: number
}

export interface CiCountByStatus {
    status: string
    count: number
}

export interface CiCountByEnvironment {
    environment: string
    count: number
}

export interface CiAgeDistribution {
    rangeLabel: string
    minDays: number
    maxDays: number
    count: number
}

export interface ComplianceIssue {
    ciId: string
    ciCode: string
    ciName: string
    ciTypeId: string
    missingAttributes: string[]
}

export interface CiInventoryReport {
    generatedAt: Date
    totalCiCount: number
    countByType: CiCountByType[]
    countByStatus: CiCountByStatus[]
    countByEnvironment: CiCountByEnvironment[]
    orphanedCiCount: number
    orphanedCis: CiRecord[]
    ageDistribution: CiAgeDistribution[]
    complianceIssues: ComplianceIssue[]
}

export class CiInventoryReportService {
    constructor(
        private ciRepo: ICiRepo,
        private relRepo: IRelRepo,
        private ciTypeRepo: ICiTypeRepo
    ) { }

    async generateCiInventoryReport(): Promise<CiInventoryReport> {
        const listedCis = await this.ciRepo.list({ limit: 10000 })
        const allCis = this.normalizeCis(Array.isArray(listedCis) ? listedCis : listedCis.items ?? [])
        const listedRelationships = await this.relRepo.list()
        const allRelationships = this.normalizeRelationships(
            Array.isArray(listedRelationships) ? listedRelationships : (listedRelationships as any).items ?? []
        )

        // Load all CI types for name resolution
        const allCiTypes: CiTypeRecord[] = await this.ciTypeRepo.list().catch(() => [])
        const ciTypeNames = new Map<string, string>(allCiTypes.map(t => [t.id, t.name]))

        // Count by type
        const countByType = this.groupBy(allCis, 'typeId').map(([typeId, cis]) => ({
            typeId,
            typeName: ciTypeNames.get(typeId) ?? `CI Type ${typeId.slice(0, 8)}`,
            count: cis.length
        }))

        // Count by status
        const countByStatus = this.groupBy(allCis, 'status').map(([status, cis]) => ({
            status,
            count: cis.length
        }))

        // Count by environment
        const environmentCounts = new Map<string, number>()
        allCis.forEach((ci) => {
            const env = ci.environment || 'unknown'
            environmentCounts.set(env, (environmentCounts.get(env) || 0) + 1)
        })
        const countByEnvironment = Array.from(environmentCounts.entries()).map(([env, count]) => ({
            environment: env,
            count
        }))

        // Find orphaned CIs (no relationships)
        const relatedCiIds = new Set<string>()
        allRelationships.forEach(rel => {
            relatedCiIds.add(rel.fromCiId)
            relatedCiIds.add(rel.toCiId)
        })
        const orphanedCis = allCis.filter((ci) => !relatedCiIds.has(ci.id))

        // Age distribution
        const now = new Date()
        const ageDistribution = this.calculateAgeDistribution(allCis, now)

        // Compliance issues (missing required attributes)
        const complianceIssues = this.findComplianceIssues(allCis)

        return {
            generatedAt: now,
            totalCiCount: allCis.length,
            countByType,
            countByStatus,
            countByEnvironment,
            orphanedCiCount: orphanedCis.length,
            orphanedCis: orphanedCis as unknown as CiRecord[],
            ageDistribution,
            complianceIssues
        }
    }

    private groupBy<T>(items: T[], key: keyof T): Array<[string, T[]]> {
        const grouped = new Map<string, T[]>()
        items.forEach(item => {
            const k = String(item[key])
            if (!grouped.has(k)) {
                grouped.set(k, [])
            }
            grouped.get(k)!.push(item)
        })
        return Array.from(grouped.entries())
    }

    private calculateAgeDistribution(cis: NormalizedCi[], now: Date): CiAgeDistribution[] {
        const ranges = [
            { label: 'Last 7 days', minDays: 0, maxDays: 7 },
            { label: '8-30 days', minDays: 8, maxDays: 30 },
            { label: '1-3 months', minDays: 31, maxDays: 90 },
            { label: '3-6 months', minDays: 91, maxDays: 180 },
            { label: '6-12 months', minDays: 181, maxDays: 365 },
            { label: 'Over 1 year', minDays: 366, maxDays: Infinity }
        ]

        return ranges.map(range => {
            const count = cis.filter(ci => {
                const ageDays = Math.floor((now.getTime() - ci.createdAt.getTime()) / (1000 * 60 * 60 * 24))
                return ageDays >= range.minDays && ageDays <= range.maxDays
            }).length
            return {
                rangeLabel: range.label,
                minDays: range.minDays,
                maxDays: range.maxDays,
                count
            }
        })
    }

    private findComplianceIssues(cis: NormalizedCi[]): ComplianceIssue[] {
        const issues: ComplianceIssue[] = []
        const requiredAttributes = ['status', 'environment'] // Define required attributes

        cis.forEach(ci => {
            const missing: string[] = []
            requiredAttributes.forEach(attr => {
                if (attr === 'environment' && !ci.environment) {
                    missing.push(attr)
                } else if (attr === 'status' && !ci.status) {
                    missing.push(attr)
                }
            })
            if (missing.length > 0) {
                issues.push({
                    ciId: ci.id,
                    ciCode: ci.ciCode,
                    ciName: ci.name,
                    ciTypeId: ci.typeId,
                    missingAttributes: missing
                })
            }
        })
        return issues
    }

    private normalizeCis(records: unknown[]): NormalizedCi[] {
        return records
            .map((record) => this.normalizeCi(record))
            .filter((record): record is NormalizedCi => record !== null)
    }

    private normalizeCi(record: unknown): NormalizedCi | null {
        if (!record || typeof record !== 'object') return null
        const data = record as Record<string, unknown>
        const metadata = data.metadata && typeof data.metadata === 'object'
            ? (data.metadata as Record<string, unknown>)
            : {}

        const id = data.id != null ? String(data.id) : ''
        if (!id) return null

        return {
            id,
            typeId: String(data.typeId ?? data.ci_type_id ?? ''),
            ciCode: String(data.ciCode ?? data.ci_code ?? ''),
            name: String(data.name ?? ''),
            status: String(data.status ?? ''),
            environment: String(data.environment ?? metadata.environment ?? ''),
            createdAt: this.asDate(data.createdAt ?? data.created_at)
        }
    }

    private normalizeRelationships(records: unknown[]): NormalizedRelationship[] {
        return records
            .map((record) => this.normalizeRelationship(record))
            .filter((record): record is NormalizedRelationship => record !== null)
    }

    private normalizeRelationship(record: unknown): NormalizedRelationship | null {
        if (!record || typeof record !== 'object') return null
        const data = record as Record<string, unknown>
        const fromCiId = data.fromCiId ?? data.from_ci_id
        const toCiId = data.toCiId ?? data.to_ci_id
        if (fromCiId == null || toCiId == null) return null
        return {
            fromCiId: String(fromCiId),
            toCiId: String(toCiId)
        }
    }

    private asDate(value: unknown): Date {
        if (value instanceof Date) return value
        if (typeof value === 'string' || typeof value === 'number') {
            return new Date(value)
        }
        return new Date()
    }
}
