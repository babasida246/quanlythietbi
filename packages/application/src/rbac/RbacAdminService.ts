// ============================================================================
// Application: RbacAdminService — OU / User / Group / ACL CRUD
// ============================================================================

import { AppError, PermissionResolver, buildOuPath } from '@qltb/domain'
import type { OrgUnit, RbacUser, RbacGroup, GroupMember, RbacRole, AclEntry } from '@qltb/domain'
import type {
    IOrgUnitRepo, IRbacUserRepo, IRbacGroupRepo, IRbacMembershipRepo,
    IRbacAclRepo, IRbacRoleRepo, IRbacPermissionRepo,
    OrgUnitCreateInput, OrgUnitUpdateInput,
    RbacUserCreateInput, RbacUserUpdateInput,
    RbacGroupCreateInput, RbacGroupUpdateInput,
    GroupMemberAddInput, AclAssignInput,
} from '@qltb/contracts'

interface RbacAdminDeps {
    ouRepo: IOrgUnitRepo
    userRepo: IRbacUserRepo
    groupRepo: IRbacGroupRepo
    membershipRepo: IRbacMembershipRepo
    aclRepo: IRbacAclRepo
    roleRepo: IRbacRoleRepo
    permissionRepo: IRbacPermissionRepo
}

interface AdminContext {
    actorUserId: string
    correlationId: string
}

interface AuditLogFn {
    (action: string, details: Record<string, unknown>): Promise<void>
}

export class RbacAdminService {
    constructor(
        private deps: RbacAdminDeps,
        private auditLog?: AuditLogFn
    ) { }

    // ─── OU CRUD ─────────────────────────────────────────────────────────

    async getOuTree(): Promise<OrgUnit[]> {
        return this.deps.ouRepo.getTree()
    }

    async createOu(input: OrgUnitCreateInput, ctx: AdminContext): Promise<OrgUnit> {
        let parentPath = '/'
        if (input.parentId) {
            const parent = await this.deps.ouRepo.getById(input.parentId)
            if (!parent) throw AppError.notFound(`Parent OU not found: ${input.parentId}`)
            parentPath = parent.path
        }

        // Check for duplicate path
        const newPath = buildOuPath(parentPath, input.name)
        const existing = await this.deps.ouRepo.getByPath(newPath)
        if (existing) throw AppError.conflict(`OU path already exists: ${newPath}`)

        const ou = await this.deps.ouRepo.create(input, parentPath)
        await this.audit('rbac.ou.created', { ouId: ou.id, name: ou.name, path: ou.path, actorUserId: ctx.actorUserId })
        return ou
    }

    async updateOu(id: string, input: OrgUnitUpdateInput, ctx: AdminContext): Promise<OrgUnit> {
        const ou = await this.deps.ouRepo.getById(id)
        if (!ou) throw AppError.notFound(`OU not found: ${id}`)
        const updated = await this.deps.ouRepo.update(id, input)
        await this.audit('rbac.ou.updated', { ouId: id, changes: input, actorUserId: ctx.actorUserId })
        return updated
    }

    async deleteOu(id: string, ctx: AdminContext): Promise<boolean> {
        const ou = await this.deps.ouRepo.getById(id)
        if (!ou) throw AppError.notFound(`OU not found: ${id}`)
        if (ou.path === '/') throw AppError.badRequest('Cannot delete root OU')

        // Check children OUs
        const children = await this.deps.ouRepo.getChildren(id)
        if (children.length > 0) throw AppError.conflict('Cannot delete OU with children. Move or delete children first.')

        // Handle users in this OU
        const users = await this.deps.userRepo.list({ ouId: id })
        if (ou.parentId) {
            // Move users up to the parent OU
            for (const user of users) {
                await this.deps.userRepo.moveToOu(user.id, ou.parentId)
            }
        } else {
            // Root-level OU — remove directory entries (rbac_users only, login accounts untouched)
            for (const user of users) {
                await this.deps.userRepo.delete(user.id)
            }
        }

        const result = await this.deps.ouRepo.delete(id)
        await this.audit('rbac.ou.deleted', {
            ouId: id, name: ou.name,
            usersHandled: users.length,
            action: ou.parentId ? 'moved_to_parent' : 'deleted',
            actorUserId: ctx.actorUserId
        })
        return result
    }

    // ─── User CRUD ───────────────────────────────────────────────────────

    async listUsers(filters?: { ouId?: string; search?: string }): Promise<RbacUser[]> {
        return this.deps.userRepo.list(filters)
    }

    async createUser(input: RbacUserCreateInput, ctx: AdminContext): Promise<RbacUser> {
        // Validate OU exists
        const ou = await this.deps.ouRepo.getById(input.ouId)
        if (!ou) throw AppError.notFound(`OU not found: ${input.ouId}`)

        const user = await this.deps.userRepo.create(input)
        await this.audit('rbac.user.created', { userId: user.id, username: user.username, ouId: input.ouId, actorUserId: ctx.actorUserId })
        return user
    }

    async updateUser(id: string, input: RbacUserUpdateInput, ctx: AdminContext): Promise<RbacUser> {
        const user = await this.deps.userRepo.getById(id)
        if (!user) throw AppError.notFound(`RBAC user not found: ${id}`)
        const updated = await this.deps.userRepo.update(id, input)
        await this.audit('rbac.user.updated', { userId: id, changes: input, actorUserId: ctx.actorUserId })
        return updated
    }

    async deleteUser(id: string, ctx: AdminContext): Promise<boolean> {
        const user = await this.deps.userRepo.getById(id)
        if (!user) throw AppError.notFound(`RBAC user not found: ${id}`)
        const result = await this.deps.userRepo.delete(id)
        await this.audit('rbac.user.deleted', { userId: id, username: user.username, actorUserId: ctx.actorUserId })
        return result
    }

    async moveUserToOu(userId: string, newOuId: string, ctx: AdminContext): Promise<RbacUser> {
        const ou = await this.deps.ouRepo.getById(newOuId)
        if (!ou) throw AppError.notFound(`OU not found: ${newOuId}`)
        const user = await this.deps.userRepo.moveToOu(userId, newOuId)
        await this.audit('rbac.user.moved', { userId, newOuId, actorUserId: ctx.actorUserId })
        return user
    }

    // ─── Group CRUD ──────────────────────────────────────────────────────

    async listGroups(filters?: { ouId?: string; search?: string }): Promise<RbacGroup[]> {
        return this.deps.groupRepo.list(filters)
    }

    async createGroup(input: RbacGroupCreateInput, ctx: AdminContext): Promise<RbacGroup> {
        const ou = await this.deps.ouRepo.getById(input.ouId)
        if (!ou) throw AppError.notFound(`OU not found: ${input.ouId}`)
        const group = await this.deps.groupRepo.create(input)
        await this.audit('rbac.group.created', { groupId: group.id, name: group.name, ouId: input.ouId, actorUserId: ctx.actorUserId })
        return group
    }

    async updateGroup(id: string, input: RbacGroupUpdateInput, ctx: AdminContext): Promise<RbacGroup> {
        const group = await this.deps.groupRepo.getById(id)
        if (!group) throw AppError.notFound(`RBAC group not found: ${id}`)
        const updated = await this.deps.groupRepo.update(id, input)
        await this.audit('rbac.group.updated', { groupId: id, changes: input, actorUserId: ctx.actorUserId })
        return updated
    }

    async deleteGroup(id: string, ctx: AdminContext): Promise<boolean> {
        const group = await this.deps.groupRepo.getById(id)
        if (!group) throw AppError.notFound(`RBAC group not found: ${id}`)
        const result = await this.deps.groupRepo.delete(id)
        await this.audit('rbac.group.deleted', { groupId: id, name: group.name, actorUserId: ctx.actorUserId })
        return result
    }

    // ─── Membership ──────────────────────────────────────────────────────

    async addMember(groupId: string, input: GroupMemberAddInput, ctx: AdminContext): Promise<GroupMember> {
        // Validate group exists
        const group = await this.deps.groupRepo.getById(groupId)
        if (!group) throw AppError.notFound(`Group not found: ${groupId}`)

        // If adding a GROUP member, check for cycles
        if (input.memberType === 'GROUP' && input.memberGroupId) {
            const allMembers = await this.deps.membershipRepo.listAll()
            // Simulate adding the new membership
            const simulated: GroupMember[] = [
                ...allMembers,
                {
                    id: 'temp',
                    groupId,
                    memberType: 'GROUP',
                    memberUserId: null,
                    memberGroupId: input.memberGroupId,
                    createdAt: new Date(),
                }
            ]
            const cycle = PermissionResolver.detectGroupCycle(simulated)
            if (cycle) {
                throw AppError.conflict(`Adding this group would create a cycle: ${cycle.join(' → ')}`)
            }
        }

        const member = await this.deps.membershipRepo.addMember(groupId, input)
        await this.audit('rbac.membership.added', {
            groupId,
            memberType: input.memberType,
            memberId: input.memberUserId ?? input.memberGroupId,
            actorUserId: ctx.actorUserId
        })
        return member
    }

    async removeMember(groupId: string, memberType: string, memberId: string, ctx: AdminContext): Promise<boolean> {
        const result = await this.deps.membershipRepo.removeMember(groupId, memberType as any, memberId)
        await this.audit('rbac.membership.removed', {
            groupId, memberType, memberId, actorUserId: ctx.actorUserId
        })
        return result
    }

    async listGroupMembers(groupId: string): Promise<GroupMember[]> {
        return this.deps.membershipRepo.listByGroup(groupId)
    }

    // ─── ACL Assignment ──────────────────────────────────────────────────

    async assignAcl(input: AclAssignInput, ctx: AdminContext): Promise<AclEntry> {
        // Validate role
        const role = await this.deps.roleRepo.getById(input.roleId)
        if (!role) throw AppError.notFound(`Role not found: ${input.roleId}`)

        // Validate scope OU
        if (input.scopeType === 'OU' && input.scopeOuId) {
            const ou = await this.deps.ouRepo.getById(input.scopeOuId)
            if (!ou) throw AppError.notFound(`Scope OU not found: ${input.scopeOuId}`)
        }

        const entry = await this.deps.aclRepo.create({ ...input, createdBy: ctx.actorUserId })
        await this.audit('rbac.acl.assigned', {
            aclId: entry.id,
            principalType: input.principalType,
            principalId: input.principalUserId ?? input.principalGroupId,
            roleKey: role.key,
            scopeType: input.scopeType,
            effect: input.effect,
            actorUserId: ctx.actorUserId,
        })
        return entry
    }

    async revokeAcl(aclId: string, ctx: AdminContext): Promise<boolean> {
        const entry = await this.deps.aclRepo.getById(aclId)
        if (!entry) throw AppError.notFound(`ACL entry not found: ${aclId}`)
        const result = await this.deps.aclRepo.delete(aclId)
        await this.audit('rbac.acl.revoked', { aclId, actorUserId: ctx.actorUserId })
        return result
    }

    async listAcl(filters?: { principalUserId?: string; principalGroupId?: string }): Promise<AclEntry[]> {
        return this.deps.aclRepo.list(filters)
    }

    // ─── Roles & Permissions ─────────────────────────────────────────────

    async listRoles(): Promise<RbacRole[]> {
        return this.deps.roleRepo.list()
    }

    async listPermissions() {
        return this.deps.permissionRepo.list()
    }

    async getRolePermissions(roleId: string) {
        return this.deps.permissionRepo.getRolePermissions(roleId)
    }

    async setRolePermissions(roleId: string, permissionIds: string[], ctx: AdminContext) {
        await this.deps.permissionRepo.setRolePermissions(roleId, permissionIds)
        await this.audit('rbac.role.permissions.updated', { roleId, permissionCount: permissionIds.length, actorUserId: ctx.actorUserId })
    }

    // ─── Audit helper ────────────────────────────────────────────────────
    private async audit(action: string, details: Record<string, unknown>): Promise<void> {
        try {
            await this.auditLog?.(action, details)
        } catch {
            // Never block main operation
        }
    }
}
