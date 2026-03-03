import type { PgClient } from '../PgClient.js';

// Plain types for infrastructure layer
export type UserId = string & { __brand: 'UserId' };
export type Email = string & { __brand: 'Email' };

export interface UserEntity {
    id: UserId;
    email: string;
    username: string;
    passwordHash: string;
    role: string;
    tier: string;
    status: string;
    emailVerified?: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Interface matching use-case expectations
export interface IUserRepository {
    findById(id: UserId): Promise<UserEntity | null>;
    findByEmail(email: Email): Promise<UserEntity | null>;
    findByUsername(username: string): Promise<UserEntity | null>;
    save(user: UserEntity): Promise<void>;
    update(user: UserEntity): Promise<void>;
    delete(id: UserId): Promise<void>;
}

/**
 * PostgreSQL implementation of User Repository
 * Maps between domain UserEntity and database rows
 */
export class UserRepo implements IUserRepository {
    constructor(private pg: PgClient) { }

    async findById(id: UserId): Promise<UserEntity | null> {
        const result = await this.pg.query(
            `SELECT * FROM users WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) return null;

        return this.toDomain(result.rows[0]);
    }

    async findByEmail(email: Email): Promise<UserEntity | null> {
        const result = await this.pg.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) return null;

        return this.toDomain(result.rows[0]);
    }

    async findByUsername(username: string): Promise<UserEntity | null> {
        const result = await this.pg.query(
            `SELECT * FROM users WHERE username = $1`,
            [username]
        );

        if (result.rows.length === 0) return null;

        return this.toDomain(result.rows[0]);
    }

    async save(user: UserEntity): Promise<void> {
        await this.pg.query(
            `INSERT INTO users (id, email, name, username, password_hash, role, tier, status, last_login_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                user.id,
                user.email,
                user.username,
                user.username,
                user.passwordHash,
                user.role,
                user.tier,
                user.status,
                user.lastLoginAt,
                user.createdAt,
                user.updatedAt,
            ]
        );
    }

    async update(user: UserEntity): Promise<void> {
        await this.pg.query(
            `UPDATE users 
             SET email = $2, 
                 name = $3,
                 username = $4, 
                 password_hash = $5, 
                 role = $6, 
                 tier = $7, 
                 status = $8,
                 last_login_at = $9,
                 updated_at = $10
             WHERE id = $1`,
            [
                user.id,
                user.email,
                user.username,
                user.username,
                user.passwordHash,
                user.role,
                user.tier,
                user.status,
                user.lastLoginAt,
                user.updatedAt,
            ]
        );
    }

    async delete(id: UserId): Promise<void> {
        await this.pg.query(`DELETE FROM users WHERE id = $1`, [id]);
    }

    /**
     * Map database row to domain entity
     */
    private toDomain(row: any): UserEntity {
        return {
            id: row.id,
            email: row.email,
            username: row.username,
            passwordHash: row.password_hash,
            role: row.role,
            tier: row.tier,
            status: row.status,
            emailVerified: false,
            lastLoginAt: row.last_login_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
