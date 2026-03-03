/**
 * CSV Exporter Utility
 * Converts various report types to CSV format
 */

export interface CiInventoryReport {
    generatedAt: Date
    totalCiCount: number
    countByType?: Array<{ typeId: string; typeName: string; count: number }>
    countByStatus?: Array<{ status: string; count: number }>
    countByEnvironment?: Array<{ environment: string; count: number }>
    orphanedCiCount?: number
    orphanedCis?: Array<any>
    ageDistribution?: Array<any>
    complianceIssues?: Array<any>
}

export interface RelationshipAnalyticsReport {
    generatedAt: Date
    totalRelationshipCount: number
    densityByType?: Array<any>
    hubCis?: Array<{
        ciId: string
        ciName: string
        ciType: string
        incomingCount: number
        outgoingCount: number
        totalConnectionCount: number
    }>
    isolatedClusters?: Array<any>
    brokenRelationships?: Array<{
        relationshipId: string
        fromCiId: string
        toCiId: string
        relationshipType: string
    }>
}

export interface AuditTrailReport {
    generatedAt: Date
    ciChangeHistory?: Array<{
        timestamp: string
        operation: string
        ciId: string
        ciName: string
    }>
    relationshipChangeHistory?: Array<{
        timestamp: string
        operation: string
        fromCiId: string
        toCiId: string
        relationshipType: string
    }>
    schemaVersionHistory?: Array<any>
}

/**
 * Escapes CSV field value to handle quotes and newlines
 */
function escapeCsvField(value: any): string {
    if (value === null || value === undefined) {
        return ''
    }
    const stringValue = String(value)
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"` // Escape quotes by doubling them
    }
    return stringValue
}

/**
 * Exports CI Inventory Report to CSV format
 */
export function exportCiInventoryReportToCSV(report: CiInventoryReport): string {
    const lines: string[] = []

    // Header
    lines.push('CI INVENTORY REPORT')
    lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`)
    lines.push('')

    // Summary
    lines.push('SUMMARY')
    lines.push('Metric,Value')
    lines.push(`Total CIs,${report.totalCiCount || 0}`)
    lines.push(`Orphaned CIs,${report.orphanedCiCount || 0}`)
    lines.push('')

    // By Type
    if (report.countByType && report.countByType.length > 0) {
        lines.push('BY TYPE')
        lines.push('Type,Count')
        report.countByType.forEach((item) => {
            lines.push(`${escapeCsvField(item.typeName || item.typeId)},${item.count}`)
        })
        lines.push('')
    }

    // By Status
    if (report.countByStatus && report.countByStatus.length > 0) {
        lines.push('BY STATUS')
        lines.push('Status,Count')
        report.countByStatus.forEach((item) => {
            lines.push(`${escapeCsvField(item.status)},${item.count}`)
        })
        lines.push('')
    }

    // By Environment
    if (report.countByEnvironment && report.countByEnvironment.length > 0) {
        lines.push('BY ENVIRONMENT')
        lines.push('Environment,Count')
        report.countByEnvironment.forEach((item) => {
            lines.push(`${escapeCsvField(item.environment)},${item.count}`)
        })
        lines.push('')
    }

    // Age Distribution
    if (report.ageDistribution && report.ageDistribution.length > 0) {
        lines.push('AGE DISTRIBUTION')
        lines.push('Age Range,Count')
        report.ageDistribution.forEach((item: any) => {
            lines.push(`${escapeCsvField(item.range || item.label)},${item.count}`)
        })
        lines.push('')
    }

    // Compliance Issues
    if (report.complianceIssues && report.complianceIssues.length > 0) {
        lines.push('COMPLIANCE ISSUES')
        lines.push('CI ID,CI Name,Issue')
        report.complianceIssues.forEach((issue: any) => {
            lines.push(
                `${escapeCsvField(issue.ciId)},${escapeCsvField(issue.ciName)},${escapeCsvField(issue.issue)}`
            )
        })
    }

    return lines.join('\n')
}

/**
 * Exports Relationship Analytics Report to CSV format
 */
export function exportRelationshipAnalyticsToCSV(report: RelationshipAnalyticsReport): string {
    const lines: string[] = []

    // Header
    lines.push('RELATIONSHIP ANALYTICS REPORT')
    lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`)
    lines.push('')

    // Summary
    lines.push('SUMMARY')
    lines.push('Metric,Value')
    lines.push(`Total Relationships,${report.totalRelationshipCount || 0}`)
    lines.push('')

    // Density by Type
    if (report.densityByType && report.densityByType.length > 0) {
        lines.push('RELATIONSHIP DENSITY BY TYPE')
        lines.push('Relationship Type,Count,Density Score')
        report.densityByType.forEach((item: any) => {
            lines.push(`${escapeCsvField(item.relType || item.type)},${item.count},${item.densityScore || 0}`)
        })
        lines.push('')
    }

    // Hub CIs
    if (report.hubCis && report.hubCis.length > 0) {
        lines.push('TOP HUB CIs (MOST CONNECTED)')
        lines.push('Rank,CI ID,CI Name,Type,Incoming,Outgoing,Total Connections')
        report.hubCis.forEach((hub, index) => {
            lines.push(
                `${index + 1},${escapeCsvField(hub.ciId)},${escapeCsvField(hub.ciName)},${escapeCsvField(
                    hub.ciType
                )},${hub.incomingCount},${hub.outgoingCount},${hub.totalConnectionCount}`
            )
        })
        lines.push('')
    }

    // Broken Relationships
    if (report.brokenRelationships && report.brokenRelationships.length > 0) {
        lines.push('BROKEN RELATIONSHIPS')
        lines.push('Relationship ID,From CI,To CI,Relationship Type')
        report.brokenRelationships.forEach((broken) => {
            lines.push(
                `${escapeCsvField(broken.relationshipId)},${escapeCsvField(broken.fromCiId)},${escapeCsvField(
                    broken.toCiId
                )},${escapeCsvField(broken.relationshipType)}`
            )
        })
    }

    return lines.join('\n')
}

/**
 * Exports Audit Trail Report to CSV format
 */
export function exportAuditTrailToCSV(report: AuditTrailReport): string {
    const lines: string[] = []

    // Header
    lines.push('AUDIT TRAIL REPORT')
    lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`)
    lines.push('')

    // CI Changes
    if (report.ciChangeHistory && report.ciChangeHistory.length > 0) {
        lines.push('CI CHANGES')
        lines.push('Timestamp,Operation,CI ID,CI Name')
        report.ciChangeHistory.forEach((event) => {
            lines.push(
                `${escapeCsvField(event.timestamp)},${escapeCsvField(event.operation)},${escapeCsvField(
                    event.ciId
                )},${escapeCsvField(event.ciName)}`
            )
        })
        lines.push('')
    }

    // Relationship Changes
    if (report.relationshipChangeHistory && report.relationshipChangeHistory.length > 0) {
        lines.push('RELATIONSHIP CHANGES')
        lines.push('Timestamp,Operation,From CI,To CI,Relationship Type')
        report.relationshipChangeHistory.forEach((event) => {
            lines.push(
                `${escapeCsvField(event.timestamp)},${escapeCsvField(event.operation)},${escapeCsvField(
                    event.fromCiId
                )},${escapeCsvField(event.toCiId)},${escapeCsvField(event.relationshipType)}`
            )
        })
        lines.push('')
    }

    // Schema Version History
    if (report.schemaVersionHistory && report.schemaVersionHistory.length > 0) {
        lines.push('SCHEMA VERSIONS')
        lines.push('Timestamp,Change Type,Description')
        report.schemaVersionHistory.forEach((event: any) => {
            lines.push(
                `${escapeCsvField(event.timestamp)},${escapeCsvField(event.changeType)},${escapeCsvField(
                    event.description || ''
                )}`
            )
        })
    }

    return lines.join('\n')
}
