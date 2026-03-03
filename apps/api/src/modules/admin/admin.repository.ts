/**
 * Admin Module - Minimal repository for audit log support
 * Used by documents module for tracking document operations.
 */
import type { Pool } from 'pg'

export class AdminRepository {
    constructor(private db: Pool) { }

    /**
     * Create an audit log entry
     */
    async createAuditLog(data: {
        userId?: string
        action: string
        resource: string
        resourceId?: string
        details?: Record<string, any>
        ipAddress?: string
        userAgent?: string
    }): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO ops_events (event_type, entity_type, entity_id, actor_id, metadata, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [
                    data.action,
                    data.resource,
                    data.resourceId ?? null,
                    data.userId ?? null,
                    JSON.stringify(data.details ?? {})
                ]
            )
        } catch (error) {
            // Silently fail audit logging - don't break main operations
            console.warn('Failed to create audit log:', error)
        }
    }
}
