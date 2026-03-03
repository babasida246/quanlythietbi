// ============================================================================
// Contracts: RBAC AD — DTOs, Repo Interfaces, Service Interfaces
// ============================================================================

import type {
    OrgUnit, RbacUser, RbacGroup, GroupMember,
    RbacRole, RbacAdPermission, AclEntry,
    MemberType, ScopeType, AclEffect, RbacUserStatus, EffectivePermissionResult,
} from '@qltb/domain'

// ─── Input / Patch DTOs ──────────────────────────────────────────────────────

// OU
export interface OrgUnitCreateInput {
    name: string
    parentId: string | null
    description?: string
}
export interface OrgUnitUpdateInput {
    name?: string
    description?: string
}

// User
export interface RbacUserCreateInput {
    username: string
    displayName: string
    email?: string
    ouId: string
    linkedUserId?: string
    status?: RbacUserStatus
}
export interface RbacUserUpdateInput {
    displayName?: string
    email?: string
    status?: RbacUserStatus
}

// Group
export interface RbacGroupCreateInput {
    name: string
    description?: string
    ouId: string
}
export interface RbacGroupUpdateInput {
    name?: string
    description?: string
}

// ACL assignment
export interface AclAssignInput {
    principalType: MemberType
    principalUserId?: string
    principalGroupId?: string
    roleId: string
    scopeType: ScopeType
    scopeOuId?: string
    scopeResource?: string
    effect: AclEffect
    inherit?: boolean
    createdBy?: string
}

// Membership
export interface GroupMemberAddInput {
    memberType: MemberType
    memberUserId?: string
    memberGroupId?: string
}

// Role
export interface RbacRoleCreateInput {
    key: string
    name: string
    description?: string
    isSystem?: boolean
}

// ─── Repository Interfaces ───────────────────────────────────────────────────

export interface IOrgUnitRepo {
    getTree(): Promise<OrgUnit[]>
    getById(id: string): Promise<OrgUnit | null>
    getByPath(path: string): Promise<OrgUnit | null>
    getChildren(parentId: string): Promise<OrgUnit[]>
    getAncestors(path: string): Promise<OrgUnit[]>
    create(input: OrgUnitCreateInput, parentPath: string): Promise<OrgUnit>
    update(id: string, input: OrgUnitUpdateInput): Promise<OrgUnit>
    delete(id: string): Promise<boolean>
    move(id: string, newParentId: string, newParentPath: string): Promise<OrgUnit>
}

export interface IRbacUserRepo {
    list(filters?: { ouId?: string; status?: RbacUserStatus; search?: string }): Promise<RbacUser[]>
    getById(id: string): Promise<RbacUser | null>
    getByUsername(username: string): Promise<RbacUser | null>
    getByLinkedUserId(linkedUserId: string): Promise<RbacUser | null>
    create(input: RbacUserCreateInput): Promise<RbacUser>
    update(id: string, input: RbacUserUpdateInput): Promise<RbacUser>
    delete(id: string): Promise<boolean>
    moveToOu(id: string, newOuId: string): Promise<RbacUser>
}

export interface IRbacGroupRepo {
    list(filters?: { ouId?: string; search?: string }): Promise<RbacGroup[]>
    getById(id: string): Promise<RbacGroup | null>
    create(input: RbacGroupCreateInput): Promise<RbacGroup>
    update(id: string, input: RbacGroupUpdateInput): Promise<RbacGroup>
    delete(id: string): Promise<boolean>
    moveToOu(id: string, newOuId: string): Promise<RbacGroup>
}

export interface IRbacMembershipRepo {
    listByGroup(groupId: string): Promise<GroupMember[]>
    listByUser(userId: string): Promise<GroupMember[]>
    listAll(): Promise<GroupMember[]>
    addMember(groupId: string, input: GroupMemberAddInput): Promise<GroupMember>
    removeMember(groupId: string, memberType: MemberType, memberId: string): Promise<boolean>
}

export interface IRbacRoleRepo {
    list(): Promise<RbacRole[]>
    getById(id: string): Promise<RbacRole | null>
    getByKey(key: string): Promise<RbacRole | null>
    create(input: RbacRoleCreateInput): Promise<RbacRole>
    update(id: string, input: Partial<RbacRoleCreateInput>): Promise<RbacRole>
    delete(id: string): Promise<boolean>
}

export interface IRbacPermissionRepo {
    list(): Promise<RbacAdPermission[]>
    getByKey(key: string): Promise<RbacAdPermission | null>
    getRolePermissions(roleId: string): Promise<RbacAdPermission[]>
    setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>
    getAllRolePermissionMappings(): Promise<Map<string, Set<string>>>
}

export interface IRbacAclRepo {
    list(filters?: { principalUserId?: string; principalGroupId?: string; roleId?: string; scopeOuId?: string }): Promise<AclEntry[]>
    listAll(): Promise<AclEntry[]>
    getById(id: string): Promise<AclEntry | null>
    create(input: AclAssignInput): Promise<AclEntry>
    delete(id: string): Promise<boolean>
}

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IAuthorizationService {
    /**
     * Check if userId has permissionKey in the given context.
     * Throws AppError.forbidden if denied.
     */
    check(userId: string, permissionKey: string, ctx?: { ouId?: string; resource?: string }): Promise<void>

    /**
     * Check without throwing — returns boolean.
     */
    has(userId: string, permissionKey: string, ctx?: { ouId?: string; resource?: string }): Promise<boolean>

    /**
     * List all effective permissions for a user.
     */
    listEffective(userId: string): Promise<EffectivePermissionResult>

    /**
     * Invalidate cached permissions for a user (call after ACL changes).
     */
    invalidateCache(userId: string): void
}
