import type { IOpsEventRepo, OpsEventRecord } from '@qltb/contracts'

export interface CiChangeEvent {
    eventId: string
    timestamp: Date
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    ciId: string
    ciCode: string
    changedFields?: Record<string, { before: unknown; after: unknown }>
    userId?: string
    notes?: string
}

export interface RelationshipChangeEvent {
    eventId: string
    timestamp: Date
    action: 'CREATE' | 'DELETE'
    fromCiId: string
    fromCiCode: string
    toCiId: string
    toCiCode: string
    relTypeId: string
    userId?: string
    notes?: string
}

export interface SchemaVersionHistory {
    version: number
    timestamp: Date
    changes: string[]
    userId?: string
}

export interface AuditTrailReport {
    generatedAt: Date
    ciChangeHistory: CiChangeEvent[]
    relationshipChangeHistory: RelationshipChangeEvent[]
    schemaVersionHistory: SchemaVersionHistory[]
    totalEvents: number
}

export class AuditTrailService {
    constructor(private opsEventRepo: IOpsEventRepo) { }

    async generateAuditTrailReport(
        ciId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<AuditTrailReport> {
        const events = await this.opsEventRepo.list()

        const filteredEvents = events.filter(event => {
            if (startDate && event.createdAt < startDate) return false
            if (endDate && event.createdAt > endDate) return false
            return true
        })

        const ciChanges = this.parseCiChanges(filteredEvents, ciId)
        const relChanges = this.parseRelationshipChanges(filteredEvents)
        const schemaChanges = this.parseSchemaVersionHistory(filteredEvents)

        return {
            generatedAt: new Date(),
            ciChangeHistory: ciChanges,
            relationshipChangeHistory: relChanges,
            schemaVersionHistory: schemaChanges,
            totalEvents: filteredEvents.length
        }
    }

    async getCiChangeHistory(ciId: string): Promise<CiChangeEvent[]> {
        const events = await this.opsEventRepo.list()
        return this.parseCiChanges(events, ciId)
    }

    async getRelationshipChangeHistory(relTypeId?: string): Promise<RelationshipChangeEvent[]> {
        const events = await this.opsEventRepo.list()
        return this.parseRelationshipChanges(events, relTypeId)
    }

    private parseCiChanges(events: OpsEventRecord[], ciId?: string): CiChangeEvent[] {
        const ciEvents = events.filter(e =>
            e.eventType.includes('CI_') &&
            (!ciId || e.entityId === ciId)
        )

        return ciEvents.map(event => {
            const actionMap: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
                'CI_CREATED': 'CREATE',
                'CI_UPDATED': 'UPDATE',
                'CI_DELETED': 'DELETE'
            }

            return {
                eventId: event.id,
                timestamp: event.createdAt,
                action: actionMap[event.eventType] || 'UPDATE',
                ciId: event.entityId,
                ciCode: (event.payload as any)?.ciCode || event.entityId,
                changedFields: (event.payload as any)?.changes,
                userId: event.actorUserId || undefined,
                notes: (event.payload as any)?.description
            }
        })
    }

    private parseRelationshipChanges(
        events: OpsEventRecord[],
        relTypeId?: string
    ): RelationshipChangeEvent[] {
        const relEvents = events.filter(e =>
            e.eventType.includes('REL_') &&
            (!relTypeId || (e.payload as any)?.relTypeId === relTypeId)
        )

        return relEvents.map(event => {
            const payload = event.payload as any || {}
            const actionMap: Record<string, 'CREATE' | 'DELETE'> = {
                'REL_CREATED': 'CREATE',
                'REL_DELETED': 'DELETE'
            }

            return {
                eventId: event.id,
                timestamp: event.createdAt,
                action: actionMap[event.eventType] || 'CREATE',
                fromCiId: payload.fromCiId || event.entityId,
                fromCiCode: payload.fromCiCode || 'UNKNOWN',
                toCiId: payload.toCiId || '',
                toCiCode: payload.toCiCode || '',
                relTypeId: payload.relTypeId || '',
                userId: event.actorUserId || undefined,
                notes: payload.description
            }
        })
    }

    private parseSchemaVersionHistory(events: OpsEventRecord[]): SchemaVersionHistory[] {
        const schemaEvents = events.filter(e => e.eventType.includes('SCHEMA_'))
        const versions = new Map<number, SchemaVersionHistory>()

        schemaEvents.forEach(event => {
            const payload = event.payload as any || {}
            const version = payload.version || 1
            const existing = versions.get(version)

            if (existing) {
                existing.changes.push((event.payload as any)?.change || payload.description)
            } else {
                versions.set(version, {
                    version,
                    timestamp: event.createdAt,
                    changes: [(event.payload as any)?.change || payload.description],
                    userId: event.actorUserId || undefined
                })
            }
        })

        return Array.from(versions.values()).sort((a, b) => b.version - a.version)
    }
}
