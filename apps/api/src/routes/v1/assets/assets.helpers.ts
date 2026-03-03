import type { FastifyRequest } from 'fastify'
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/http-errors.js'
import { normalizeUserRole } from '../../../shared/security/jwt-auth.js'

export function getHeader(request: FastifyRequest, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()]
    if (Array.isArray(value)) return value[0]
    return value
}

export function getCorrelationId(request: FastifyRequest): string {
    const header = getHeader(request, 'x-correlation-id')
    if (header && header.trim().length > 0) return header
    const withCorrelation = request as FastifyRequest & { correlationId?: string }
    return withCorrelation.correlationId ?? String(request.id)
}

export function getUserContext(request: FastifyRequest): { userId: string; role: string; correlationId: string } {
    if (request.user?.id) {
        return {
            userId: request.user.id,
            role: normalizeUserRole(request.user.role),
            correlationId: getCorrelationId(request)
        }
    }
    throw new UnauthorizedError('Missing authenticated user context')
}

export function requireRole(request: FastifyRequest, allowed: string[]): { userId: string; correlationId: string } {
    const ctx = getUserContext(request)
    const elevated = new Set(['admin', 'super_admin'])
    const normalizedAllowed = new Set(allowed.map(normalizeUserRole))
    if (!normalizedAllowed.has(ctx.role) && !elevated.has(ctx.role)) {
        throw new ForbiddenError('Insufficient role for this action')
    }
    return { userId: ctx.userId, correlationId: ctx.correlationId }
}

// ─── Permission fallback table (mirror migration 050) ─────────────────────────
// Dùng khi role_permissions chưa được seed vào DB (setup mới / test).
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
    admin: ['*'],
    super_admin: ['*'],
    it_asset_manager: [
        'assets:read', 'assets:create', 'assets:update', 'assets:delete', 'assets:export', 'assets:import', 'assets:assign',
        'categories:read', 'categories:manage',
        'cmdb:read', 'cmdb:create', 'cmdb:update', 'cmdb:delete',
        'warehouse:read', 'warehouse:create', 'warehouse:approve',
        'inventory:read', 'inventory:create', 'inventory:manage',
        'licenses:read', 'licenses:manage',
        'accessories:read', 'accessories:manage',
        'consumables:read', 'consumables:manage',
        'components:read', 'components:manage',
        'checkout:read', 'checkout:create', 'checkout:approve',
        'requests:read', 'requests:create', 'requests:approve',
        'maintenance:read', 'maintenance:create', 'maintenance:manage',
        'reports:read', 'reports:export', 'analytics:read',
        'depreciation:read', 'depreciation:manage',
        'labels:read', 'labels:manage',
        'documents:read', 'documents:upload', 'documents:delete',
        'automation:read', 'automation:manage',
        'integrations:read', 'integrations:manage',
        'security:read',
    ],
    warehouse_keeper: [
        'assets:read', 'assets:create', 'assets:update', 'assets:export',
        'categories:read',
        'warehouse:read', 'warehouse:create',
        'inventory:read', 'inventory:create',
        'accessories:read', 'accessories:manage',
        'consumables:read', 'consumables:manage',
        'components:read', 'components:manage',
        'requests:read', 'requests:create',
        'audit:read', 'audit:create',
        'maintenance:read',
        'reports:read', 'reports:export',
        'depreciation:read',
        'labels:read', 'labels:manage',
        'documents:read', 'documents:upload',
    ],
    technician: [
        'assets:read', 'categories:read', 'cmdb:read',
        'warehouse:read', 'inventory:read',
        'accessories:read', 'consumables:read',
        'components:read', 'components:manage',
        'checkout:read', 'checkout:create',
        'requests:read', 'requests:create',
        'maintenance:read', 'maintenance:create', 'maintenance:manage',
        'reports:read', 'labels:read',
        'documents:read', 'documents:upload',
    ],
    requester: [
        'assets:read', 'categories:read', 'licenses:read',
        'checkout:read', 'checkout:create',
        'requests:read', 'requests:create',
        'maintenance:read', 'maintenance:create',
        'reports:read', 'documents:read',
    ],
    // 'user' = backward-compat alias cho 'requester'
    user: [
        'assets:read', 'categories:read', 'licenses:read',
        'checkout:read', 'checkout:create',
        'requests:read', 'requests:create',
        'maintenance:read', 'maintenance:create',
        'reports:read', 'documents:read',
    ],
    viewer: [
        'assets:read', 'categories:read', 'cmdb:read',
        'warehouse:read', 'inventory:read', 'licenses:read',
        'accessories:read', 'consumables:read', 'components:read',
        'checkout:read', 'requests:read', 'maintenance:read',
        'reports:read', 'analytics:read', 'depreciation:read',
        'labels:read', 'security:read', 'documents:read', 'automation:read',
    ],
}

/**
 * Kiểm tra permission cụ thể trên request đã xác thực.
 * Ưu tiên dùng permissions được load từ DB (role_permissions).
 * Nếu DB chưa có bảng phân quyền, fallback về ROLE_DEFAULT_PERMISSIONS.
 *
 * @example requirePermission(request, 'assets:create')
 */
export function requirePermission(
    request: FastifyRequest,
    permission: string
): { userId: string; correlationId: string } {
    const ctx = getUserContext(request)

    // Admin/super_admin: bypass mọi kiểm tra
    if (ctx.role === 'admin' || ctx.role === 'super_admin') {
        return { userId: ctx.userId, correlationId: ctx.correlationId }
    }

    const userPerms: string[] = request.user?.permissions ?? []

    if (userPerms.length > 0) {
        if (!userPerms.includes(permission)) {
            throw new ForbiddenError(`Permission required: ${permission}`)
        }
    } else {
        // Fallback: dùng bảng mặc định
        const defaults = ROLE_DEFAULT_PERMISSIONS[ctx.role] ?? []
        if (!defaults.includes('*') && !defaults.includes(permission)) {
            throw new ForbiddenError(`Permission required: ${permission}`)
        }
    }

    return { userId: ctx.userId, correlationId: ctx.correlationId }
}

/**
 * Kiểm tra nhiều permissions cùng lúc (AND logic — cần có TẤT CẢ).
 */
export function requirePermissions(
    request: FastifyRequest,
    ...permissions: string[]
): { userId: string; correlationId: string } {
    for (const perm of permissions) {
        requirePermission(request, perm)
    }
    const ctx = getUserContext(request)
    return { userId: ctx.userId, correlationId: ctx.correlationId }
}

/**
 * Kiểm tra có ít nhất một trong các permissions (OR logic).
 */
export function requireAnyPermission(
    request: FastifyRequest,
    ...permissions: string[]
): { userId: string; correlationId: string } {
    const ctx = getUserContext(request)
    if (ctx.role === 'admin' || ctx.role === 'super_admin') {
        return { userId: ctx.userId, correlationId: ctx.correlationId }
    }

    const userPerms: string[] = request.user?.permissions ?? []
    const defaults = ROLE_DEFAULT_PERMISSIONS[ctx.role] ?? []
    const effectivePerms = userPerms.length > 0 ? userPerms : defaults

    const hasAny = permissions.some(p => effectivePerms.includes('*') || effectivePerms.includes(p))
    if (!hasAny) {
        throw new ForbiddenError(`One of these permissions required: ${permissions.join(', ')}`)
    }
    return { userId: ctx.userId, correlationId: ctx.correlationId }
}

/**
 * Trả về true/false — dùng để hiển thị/ẩn UI hoặc filter response fields.
 */
export function hasPermission(request: FastifyRequest, permission: string): boolean {
    try {
        requirePermission(request, permission)
        return true
    } catch {
        return false
    }
}