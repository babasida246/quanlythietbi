import type { FastifyRequest } from 'fastify'
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/http-errors.js'
import { normalizeUserRole } from '../../../shared/security/jwt-auth.js'
import { SYSTEM_ROLE_PERMISSIONS } from '@qltb/contracts'

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
    // root and super_admin always pass regardless of the allowed list
    const elevated = new Set(['root', 'super_admin'])
    const normalizedAllowed = new Set(allowed.map(normalizeUserRole))
    if (!normalizedAllowed.has(ctx.role) && !elevated.has(ctx.role)) {
        throw new ForbiddenError('Insufficient role for this action')
    }
    return { userId: ctx.userId, correlationId: ctx.correlationId }
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

    // Option A (AD-model): only 'root' is inviolable — bypasses all policy checks.
    // 'admin' and 'super_admin' go through normal permission enforcement so that
    // Policy DENY assignments take effect (e.g. disabling Security/Analytics for admin).
    if (ctx.role === 'root') {
        return { userId: ctx.userId, correlationId: ctx.correlationId }
    }

    // Policy DENY overrides everything for non-root roles.
    const deniedPerms: string[] = request.user?.deniedPermissions ?? []
    if (deniedPerms.includes(permission)) {
        throw new ForbiddenError(`Permission required: ${permission}`)
    }

    const userPerms: string[] = request.user?.permissions ?? []

    if (userPerms.length > 0) {
        // permissions loaded from policy_permissions — enforce as-is
        if (!userPerms.includes(permission)) {
            throw new ForbiddenError(`Permission required: ${permission}`)
        }
    } else {
        // Fallback khi DB chưa có policy: dùng bảng mặc định từ contracts.
        const defaults = SYSTEM_ROLE_PERMISSIONS[ctx.role] ?? []
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

    // Option A (AD-model): only 'root' is inviolable.
    if (ctx.role === 'root') {
        return { userId: ctx.userId, correlationId: ctx.correlationId }
    }

    // Remove any permissions that are explicitly denied
    const deniedPerms = new Set(request.user?.deniedPermissions ?? [])
    const notDenied = permissions.filter(p => !deniedPerms.has(p))
    if (notDenied.length === 0) {
        throw new ForbiddenError(`One of these permissions required: ${permissions.join(', ')}`)
    }

    const userPerms: string[] = request.user?.permissions ?? []
    // Fallback khi DB chưa có policy: dùng bảng mặc định (admin có '*' → luôn pass)
    const defaults = SYSTEM_ROLE_PERMISSIONS[ctx.role] ?? []
    const effectivePerms = userPerms.length > 0 ? userPerms : defaults

    const hasAny = notDenied.some(p => effectivePerms.includes('*') || effectivePerms.includes(p))
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