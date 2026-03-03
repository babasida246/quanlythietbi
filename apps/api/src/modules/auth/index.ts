/**
 * Auth Module - Stub for module compatibility
 * QuanLyThietBi uses global auth hook (createApiV1AuthHook) instead of per-module auth.
 * This stub provides the AuthService interface that copied modules expect.
 */
import type { PgClient } from '@qltb/infra-postgres'
import jwt from 'jsonwebtoken'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key'

export interface AuthService {
    verifyAccessToken(token: string): Promise<{ userId: string; email: string; role: string } | null>
}

/**
 * Create a simple AuthService that verifies JWT tokens.
 * Tries JWT verification first (matches global auth hook), then falls back to session lookup.
 */
export function createAuthService(pgClient: PgClient): AuthService {
    return {
        async verifyAccessToken(token: string) {
            // Try JWT verification first (matches global auth hook behavior)
            try {
                const payload = jwt.verify(token, JWT_ACCESS_SECRET) as { userId: string; email: string; role: string }
                if (payload.userId && payload.email) {
                    return { userId: payload.userId, email: payload.email, role: payload.role || 'user' }
                }
            } catch {
                // JWT verification failed, try session lookup
            }

            // Fallback: session-based lookup
            try {
                const result = await pgClient.query(
                    `SELECT u.id as user_id, u.email, u.role 
                     FROM sessions s 
                     JOIN users u ON u.id = s.user_id 
                     WHERE s.token = $1 AND s.expires_at > NOW()`,
                    [token]
                )
                if (result.rows.length === 0) return null
                const row = result.rows[0]
                return { userId: row.user_id, email: row.email, role: row.role }
            } catch {
                return null
            }
        }
    }
}
