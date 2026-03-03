import type { PgClient } from '../PgClient.js';

export type UserId = string;

// Session entity type (simple object for now, can create domain entity later)
export interface Session {
    id: string;
    userId: UserId;
    token: string;
    refreshToken: string;
    expiresAt: Date;
    refreshExpiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    isRevoked: boolean;
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Interface matching use-case expectations
export interface ISessionRepository {
    findById(id: string): Promise<Session | null>;
    findByToken(token: string): Promise<Session | null>;
    findByUserId(userId: UserId): Promise<Session[]>;
    save(session: Session): Promise<void>;
    delete(id: string): Promise<void>;
    deleteByUserId(userId: UserId): Promise<void>;
}

/**
 * PostgreSQL implementation of Session Repository
 */
export class SessionRepo implements ISessionRepository {
    constructor(private pg: PgClient) { }

    async findById(id: string): Promise<Session | null> {
        const result = await this.pg.query(
            `SELECT * FROM sessions WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) return null;

        return this.toDomain(result.rows[0]);
    }

    async findByToken(token: string): Promise<Session | null> {
        // Support lookup by either access token or refresh token
        const result = await this.pg.query(
            `SELECT * FROM sessions WHERE (token = $1 OR refresh_token = $1) AND is_revoked = false`,
            [token]
        );

        if (result.rows.length === 0) return null;

        return this.toDomain(result.rows[0]);
    }

    async findByUserId(userId: UserId): Promise<Session[]> {
        const result = await this.pg.query(
            `SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows.map(row => this.toDomain(row));
    }

    async save(session: Session): Promise<void> {
        await this.pg.query(
            `INSERT INTO sessions (
                id, user_id, token, refresh_token, 
                expires_at, refresh_expires_at, 
                ip_address, user_agent, is_revoked,
                last_activity_at, created_at, updated_at
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
                token = EXCLUDED.token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                refresh_expires_at = EXCLUDED.refresh_expires_at,
                is_revoked = EXCLUDED.is_revoked,
                last_activity_at = EXCLUDED.last_activity_at,
                updated_at = EXCLUDED.updated_at`,
            [
                session.id,
                session.userId,
                session.token,
                session.refreshToken,
                session.expiresAt,
                session.refreshExpiresAt,
                session.ipAddress,
                session.userAgent,
                session.isRevoked,
                session.lastActivityAt,
                session.createdAt,
                session.updatedAt,
            ]
        );
    }

    async delete(id: string): Promise<void> {
        await this.pg.query(`DELETE FROM sessions WHERE id = $1`, [id]);
    }

    async deleteByUserId(userId: UserId): Promise<void> {
        await this.pg.query(`DELETE FROM sessions WHERE user_id = $1`, [
            userId,
        ]);
    }

    /**
     * Map database row to session object
     */
    private toDomain(row: any): Session {
        return {
            id: row.id,
            userId: row.user_id,
            token: row.token,
            refreshToken: row.refresh_token,
            expiresAt: row.expires_at,
            refreshExpiresAt: row.refresh_expires_at,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            isRevoked: row.is_revoked,
            lastActivityAt: row.last_activity_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
