// ============================================================================
// Application: AuthorizationService — AD-style permission checking
// ============================================================================

import { AppError, PermissionResolver } from '@qltb/domain'
import type { PermissionResolverInput, CheckContext, EffectivePermissionResult } from '@qltb/domain'
import type {
    IOrgUnitRepo, IRbacUserRepo, IRbacMembershipRepo,
    IRbacAclRepo, IRbacRoleRepo, IRbacPermissionRepo,
    IAuthorizationService,
} from '@qltb/contracts'

interface AuthorizationDeps {
    ouRepo: IOrgUnitRepo
    userRepo: IRbacUserRepo
    membershipRepo: IRbacMembershipRepo
    aclRepo: IRbacAclRepo
    roleRepo: IRbacRoleRepo
    permissionRepo: IRbacPermissionRepo
}

interface CacheEntry {
    input: PermissionResolverInput
    expiresAt: number
}

const CACHE_TTL_MS = 5 * 60_000  // 5 minutes

export class AuthorizationService implements IAuthorizationService {
    private cache = new Map<string, CacheEntry>()

    constructor(private deps: AuthorizationDeps) { }

    async check(userId: string, permissionKey: string, ctx?: { ouId?: string; resource?: string }): Promise<void> {
        const allowed = await this.has(userId, permissionKey, ctx)
        if (!allowed) {
            throw AppError.forbidden(`Permission denied: ${permissionKey}`)
        }
    }

    async has(userId: string, permissionKey: string, ctx?: { ouId?: string; resource?: string }): Promise<boolean> {
        const input = await this.getResolverInput(userId)
        const checkCtx: CheckContext = {}

        if (ctx?.ouId) {
            const ou = await this.deps.ouRepo.getById(ctx.ouId)
            if (ou) checkCtx.ouPath = ou.path
        }
        if (ctx?.resource) {
            checkCtx.resource = ctx.resource
        }

        return PermissionResolver.check(input, permissionKey, checkCtx)
    }

    async listEffective(userId: string): Promise<EffectivePermissionResult> {
        const input = await this.getResolverInput(userId)
        return PermissionResolver.resolve(input)
    }

    invalidateCache(userId: string): void {
        this.cache.delete(userId)
    }

    // ─── Internal: build resolver input with caching ─────────────────────

    private async getResolverInput(userId: string): Promise<PermissionResolverInput> {
        const cached = this.cache.get(userId)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.input
        }

        // Load all needed data in parallel
        const [rbacUser, allOus, memberships, allAcl, roles, rolePermMappings] = await Promise.all([
            this.deps.userRepo.getById(userId),
            this.deps.ouRepo.getTree(),
            this.deps.membershipRepo.listAll(),
            this.deps.aclRepo.listAll(),
            this.deps.roleRepo.list(),
            this.deps.permissionRepo.getAllRolePermissionMappings(),
        ])

        if (!rbacUser) {
            throw AppError.notFound(`RBAC user not found: ${userId}`)
        }

        // Find user's OU path
        const userOu = allOus.find(ou => ou.id === rbacUser.ouId)
        const userOuPath = userOu?.path ?? '/'

        // Build maps
        const ousById = new Map(allOus.map(ou => [ou.id, ou]))
        const rolesById = new Map(roles.map(r => [r.id, r]))

        const input: PermissionResolverInput = {
            userId,
            userOuPath,
            memberships,
            aclEntries: allAcl,
            rolesById,
            rolePermissions: rolePermMappings,
            ousById,
        }

        this.cache.set(userId, { input, expiresAt: Date.now() + CACHE_TTL_MS })
        return input
    }
}
