// ============================================================================
// Infra-Postgres: RBAC AD Repositories
// All 7 repo interfaces implemented — IOrgUnitRepo, IRbacUserRepo,
// IRbacGroupRepo, IRbacMembershipRepo, IRbacRoleRepo, IRbacPermissionRepo, IRbacAclRepo
// ============================================================================

import type {
    IOrgUnitRepo, IRbacUserRepo, IRbacGroupRepo, IRbacMembershipRepo,
    IRbacRoleRepo, IRbacPermissionRepo, IRbacAclRepo,
    OrgUnitCreateInput, OrgUnitUpdateInput,
    RbacUserCreateInput, RbacUserUpdateInput,
    RbacGroupCreateInput, RbacGroupUpdateInput,
    GroupMemberAddInput, AclAssignInput, RbacRoleCreateInput,
} from '@qltb/contracts'
import type {
    OrgUnit, RbacUser, RbacGroup, GroupMember,
    RbacRole, RbacAdPermission, AclEntry,
    MemberType, ScopeType, AclEffect, RbacUserStatus,
} from '@qltb/domain'
import { buildOuPath } from '@qltb/domain'
import type { Queryable } from './types.js'

// ─── Row types (snake_case DB columns) ───────────────────────────────────────

type OrgUnitRow = {
    id: string; name: string; parent_id: string | null; path: string;
    depth: number; description: string | null; created_at: Date; updated_at: Date;
}

type RbacUserRow = {
    id: string; username: string; display_name: string; email: string | null;
    ou_id: string; linked_user_id: string | null; status: string;
    created_at: Date; updated_at: Date;
}

type RbacGroupRow = {
    id: string; name: string; description: string | null; ou_id: string;
    created_at: Date; updated_at: Date;
}

type GroupMemberRow = {
    id: string; group_id: string; member_type: string;
    member_user_id: string | null; member_group_id: string | null;
    created_at: Date;
}

type RbacRoleRow = {
    id: string; key: string; name: string; description: string | null;
    is_system: boolean; created_at: Date; updated_at: Date;
}

type RbacAdPermissionRow = {
    id: string; key: string; description: string | null; created_at: Date;
}

type AclRow = {
    id: string; principal_type: string; principal_user_id: string | null;
    principal_group_id: string | null; role_id: string; scope_type: string;
    scope_ou_id: string | null; scope_resource: string | null;
    effect: string; inherit: boolean; created_by: string | null;
    created_at: Date; updated_at: Date;
}

type RolePermRow = { role_id: string; permission_id: string }

// ─── Mappers ─────────────────────────────────────────────────────────────────

const mapOu = (r: OrgUnitRow): OrgUnit => ({
    id: r.id, name: r.name, parentId: r.parent_id, path: r.path,
    depth: r.depth, description: r.description,
    createdAt: r.created_at, updatedAt: r.updated_at,
})

const mapUser = (r: RbacUserRow): RbacUser => ({
    id: r.id, username: r.username, displayName: r.display_name,
    email: r.email, ouId: r.ou_id, linkedUserId: r.linked_user_id,
    status: r.status as RbacUserStatus,
    createdAt: r.created_at, updatedAt: r.updated_at,
})

const mapGroup = (r: RbacGroupRow): RbacGroup => ({
    id: r.id, name: r.name, description: r.description, ouId: r.ou_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
})

const mapMember = (r: GroupMemberRow): GroupMember => ({
    id: r.id, groupId: r.group_id, memberType: r.member_type as MemberType,
    memberUserId: r.member_user_id, memberGroupId: r.member_group_id,
    createdAt: r.created_at,
})

const mapRole = (r: RbacRoleRow): RbacRole => ({
    id: r.id, key: r.key, name: r.name, description: r.description,
    isSystem: r.is_system, createdAt: r.created_at, updatedAt: r.updated_at,
})

const mapPermission = (r: RbacAdPermissionRow): RbacAdPermission => ({
    id: r.id, key: r.key, description: r.description, createdAt: r.created_at,
})

const mapAcl = (r: AclRow): AclEntry => ({
    id: r.id, principalType: r.principal_type as MemberType,
    principalUserId: r.principal_user_id, principalGroupId: r.principal_group_id,
    roleId: r.role_id, scopeType: r.scope_type as ScopeType,
    scopeOuId: r.scope_ou_id, scopeResource: r.scope_resource,
    effect: r.effect as AclEffect, inherit: r.inherit,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
})

// ─── OrgUnit Repository ──────────────────────────────────────────────────────

export class PgOrgUnitRepo implements IOrgUnitRepo {
    constructor(private pg: Queryable) { }

    async getTree(): Promise<OrgUnit[]> {
        const result = await this.pg.query<OrgUnitRow>(
            `SELECT id, name, parent_id, path, depth, description, created_at, updated_at
             FROM org_units ORDER BY path ASC`
        )
        return result.rows.map(mapOu)
    }

    async getById(id: string): Promise<OrgUnit | null> {
        const result = await this.pg.query<OrgUnitRow>(
            `SELECT id, name, parent_id, path, depth, description, created_at, updated_at
             FROM org_units WHERE id = $1`, [id]
        )
        return result.rows[0] ? mapOu(result.rows[0]) : null
    }

    async getByPath(path: string): Promise<OrgUnit | null> {
        const result = await this.pg.query<OrgUnitRow>(
            `SELECT id, name, parent_id, path, depth, description, created_at, updated_at
             FROM org_units WHERE path = $1`, [path]
        )
        return result.rows[0] ? mapOu(result.rows[0]) : null
    }

    async getChildren(parentId: string): Promise<OrgUnit[]> {
        const result = await this.pg.query<OrgUnitRow>(
            `SELECT id, name, parent_id, path, depth, description, created_at, updated_at
             FROM org_units WHERE parent_id = $1 ORDER BY name ASC`, [parentId]
        )
        return result.rows.map(mapOu)
    }

    async getAncestors(path: string): Promise<OrgUnit[]> {
        // Build all ancestor paths and query them
        if (!path || path === '/') return []
        const parts = path.split('/').filter(Boolean)
        const ancestorPaths: string[] = ['/']
        let current = ''
        for (const part of parts) {
            current += '/' + part
            ancestorPaths.push(current)
        }
        const placeholders = ancestorPaths.map((_, i) => `$${i + 1}`).join(',')
        const result = await this.pg.query<OrgUnitRow>(
            `SELECT id, name, parent_id, path, depth, description, created_at, updated_at
             FROM org_units WHERE path IN (${placeholders}) ORDER BY depth ASC`, ancestorPaths
        )
        return result.rows.map(mapOu)
    }

    async create(input: OrgUnitCreateInput, parentPath: string): Promise<OrgUnit> {
        const newPath = buildOuPath(parentPath, input.name)
        const depth = newPath === '/' ? 0 : newPath.split('/').filter(Boolean).length
        const result = await this.pg.query<OrgUnitRow>(
            `INSERT INTO org_units (name, parent_id, path, depth, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, parent_id, path, depth, description, created_at, updated_at`,
            [input.name, input.parentId ?? null, newPath, depth, input.description ?? null]
        )
        return mapOu(result.rows[0])
    }

    async update(id: string, input: OrgUnitUpdateInput): Promise<OrgUnit> {
        const sets: string[] = ['updated_at = NOW()']
        const params: any[] = []
        let idx = 1

        if (input.name !== undefined) { sets.push(`name = $${idx}`); params.push(input.name); idx++ }
        if (input.description !== undefined) { sets.push(`description = $${idx}`); params.push(input.description); idx++ }

        params.push(id)
        const result = await this.pg.query<OrgUnitRow>(
            `UPDATE org_units SET ${sets.join(', ')} WHERE id = $${idx}
             RETURNING id, name, parent_id, path, depth, description, created_at, updated_at`,
            params
        )
        return mapOu(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM org_units WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    async move(id: string, newParentId: string, newParentPath: string): Promise<OrgUnit> {
        // First, get current OU to compute old and new paths
        const current = await this.getById(id)
        if (!current) throw new Error(`OU not found: ${id}`)

        const newPath = buildOuPath(newParentPath, current.name)
        const newDepth = newPath.split('/').filter(Boolean).length

        // Update this OU
        const result = await this.pg.query<OrgUnitRow>(
            `UPDATE org_units
             SET parent_id = $1, path = $2, depth = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING id, name, parent_id, path, depth, description, created_at, updated_at`,
            [newParentId, newPath, newDepth, id]
        )

        // Update all descendants' paths
        const oldPath = current.path
        await this.pg.query(
            `UPDATE org_units
             SET path = $1 || SUBSTRING(path FROM $3),
                 depth = depth + ($4 - $5),
                 updated_at = NOW()
             WHERE path LIKE $2 AND id != $6`,
            [newPath, oldPath + '/%', (oldPath.length + 1).toString(), newDepth, current.depth, id]
        )

        return mapOu(result.rows[0])
    }
}

// ─── RBAC User Repository ────────────────────────────────────────────────────

export class PgRbacUserRepo implements IRbacUserRepo {
    constructor(private pg: Queryable) { }

    private readonly cols = `id, username, display_name, email, ou_id, linked_user_id, status, created_at, updated_at`

    async list(filters?: { ouId?: string; status?: string; search?: string }): Promise<RbacUser[]> {
        const conditions: string[] = ['1=1']
        const params: any[] = []
        let idx = 1

        if (filters?.ouId) { conditions.push(`ou_id = $${idx}`); params.push(filters.ouId); idx++ }
        if (filters?.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++ }
        if (filters?.search) {
            conditions.push(`(username ILIKE $${idx} OR display_name ILIKE $${idx})`)
            params.push(`%${filters.search}%`); idx++
        }

        const result = await this.pg.query<RbacUserRow>(
            `SELECT ${this.cols} FROM rbac_users WHERE ${conditions.join(' AND ')} ORDER BY display_name ASC`,
            params
        )
        return result.rows.map(mapUser)
    }

    async getById(id: string): Promise<RbacUser | null> {
        const result = await this.pg.query<RbacUserRow>(
            `SELECT ${this.cols} FROM rbac_users WHERE id = $1`, [id]
        )
        return result.rows[0] ? mapUser(result.rows[0]) : null
    }

    async getByUsername(username: string): Promise<RbacUser | null> {
        const result = await this.pg.query<RbacUserRow>(
            `SELECT ${this.cols} FROM rbac_users WHERE username = $1`, [username]
        )
        return result.rows[0] ? mapUser(result.rows[0]) : null
    }

    async getByLinkedUserId(linkedUserId: string): Promise<RbacUser | null> {
        const result = await this.pg.query<RbacUserRow>(
            `SELECT ${this.cols} FROM rbac_users WHERE linked_user_id = $1`, [linkedUserId]
        )
        return result.rows[0] ? mapUser(result.rows[0]) : null
    }

    async create(input: RbacUserCreateInput): Promise<RbacUser> {
        const result = await this.pg.query<RbacUserRow>(
            `INSERT INTO rbac_users (username, display_name, email, ou_id, linked_user_id, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${this.cols}`,
            [input.username, input.displayName, input.email ?? null,
            input.ouId, input.linkedUserId ?? null, input.status ?? 'active']
        )
        return mapUser(result.rows[0])
    }

    async update(id: string, input: RbacUserUpdateInput): Promise<RbacUser> {
        const sets: string[] = ['updated_at = NOW()']
        const params: any[] = []
        let idx = 1

        if (input.displayName !== undefined) { sets.push(`display_name = $${idx}`); params.push(input.displayName); idx++ }
        if (input.email !== undefined) { sets.push(`email = $${idx}`); params.push(input.email); idx++ }
        if (input.status !== undefined) { sets.push(`status = $${idx}`); params.push(input.status); idx++ }
        if ('linkedUserId' in input) { sets.push(`linked_user_id = $${idx}`); params.push(input.linkedUserId ?? null); idx++ }

        params.push(id)
        const result = await this.pg.query<RbacUserRow>(
            `UPDATE rbac_users SET ${sets.join(', ')} WHERE id = $${idx}
             RETURNING ${this.cols}`,
            params
        )
        return mapUser(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM rbac_users WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    async moveToOu(id: string, newOuId: string): Promise<RbacUser> {
        const result = await this.pg.query<RbacUserRow>(
            `UPDATE rbac_users SET ou_id = $1, updated_at = NOW() WHERE id = $2
             RETURNING ${this.cols}`,
            [newOuId, id]
        )
        return mapUser(result.rows[0])
    }
}

// ─── RBAC Group Repository ───────────────────────────────────────────────────

export class PgRbacGroupRepo implements IRbacGroupRepo {
    constructor(private pg: Queryable) { }

    private readonly cols = `id, name, description, ou_id, created_at, updated_at`

    async list(filters?: { ouId?: string; search?: string }): Promise<RbacGroup[]> {
        const conditions: string[] = ['1=1']
        const params: any[] = []
        let idx = 1

        if (filters?.ouId) { conditions.push(`ou_id = $${idx}`); params.push(filters.ouId); idx++ }
        if (filters?.search) {
            conditions.push(`name ILIKE $${idx}`)
            params.push(`%${filters.search}%`); idx++
        }

        const result = await this.pg.query<RbacGroupRow>(
            `SELECT ${this.cols} FROM rbac_groups WHERE ${conditions.join(' AND ')} ORDER BY name ASC`,
            params
        )
        return result.rows.map(mapGroup)
    }

    async getById(id: string): Promise<RbacGroup | null> {
        const result = await this.pg.query<RbacGroupRow>(
            `SELECT ${this.cols} FROM rbac_groups WHERE id = $1`, [id]
        )
        return result.rows[0] ? mapGroup(result.rows[0]) : null
    }

    async create(input: RbacGroupCreateInput): Promise<RbacGroup> {
        const result = await this.pg.query<RbacGroupRow>(
            `INSERT INTO rbac_groups (name, description, ou_id)
             VALUES ($1, $2, $3)
             RETURNING ${this.cols}`,
            [input.name, input.description ?? null, input.ouId]
        )
        return mapGroup(result.rows[0])
    }

    async update(id: string, input: RbacGroupUpdateInput): Promise<RbacGroup> {
        const sets: string[] = ['updated_at = NOW()']
        const params: any[] = []
        let idx = 1

        if (input.name !== undefined) { sets.push(`name = $${idx}`); params.push(input.name); idx++ }
        if (input.description !== undefined) { sets.push(`description = $${idx}`); params.push(input.description); idx++ }

        params.push(id)
        const result = await this.pg.query<RbacGroupRow>(
            `UPDATE rbac_groups SET ${sets.join(', ')} WHERE id = $${idx}
             RETURNING ${this.cols}`,
            params
        )
        return mapGroup(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM rbac_groups WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    async moveToOu(id: string, newOuId: string): Promise<RbacGroup> {
        const result = await this.pg.query<RbacGroupRow>(
            `UPDATE rbac_groups SET ou_id = $1, updated_at = NOW() WHERE id = $2
             RETURNING ${this.cols}`,
            [newOuId, id]
        )
        return mapGroup(result.rows[0])
    }
}

// ─── Membership Repository ───────────────────────────────────────────────────

export class PgRbacMembershipRepo implements IRbacMembershipRepo {
    constructor(private pg: Queryable) { }

    private readonly cols = `id, group_id, member_type, member_user_id, member_group_id, created_at`

    async listByGroup(groupId: string): Promise<GroupMember[]> {
        const result = await this.pg.query<GroupMemberRow>(
            `SELECT ${this.cols} FROM rbac_group_members WHERE group_id = $1 ORDER BY created_at ASC`,
            [groupId]
        )
        return result.rows.map(mapMember)
    }

    async listByUser(userId: string): Promise<GroupMember[]> {
        const result = await this.pg.query<GroupMemberRow>(
            `SELECT ${this.cols} FROM rbac_group_members WHERE member_user_id = $1`,
            [userId]
        )
        return result.rows.map(mapMember)
    }

    async listAll(): Promise<GroupMember[]> {
        const result = await this.pg.query<GroupMemberRow>(
            `SELECT ${this.cols} FROM rbac_group_members`
        )
        return result.rows.map(mapMember)
    }

    async addMember(groupId: string, input: GroupMemberAddInput): Promise<GroupMember> {
        const result = await this.pg.query<GroupMemberRow>(
            `INSERT INTO rbac_group_members (group_id, member_type, member_user_id, member_group_id)
             VALUES ($1, $2, $3, $4)
             RETURNING ${this.cols}`,
            [groupId, input.memberType, input.memberUserId ?? null, input.memberGroupId ?? null]
        )
        return mapMember(result.rows[0])
    }

    async removeMember(groupId: string, memberType: MemberType, memberId: string): Promise<boolean> {
        const col = memberType === 'USER' ? 'member_user_id' : 'member_group_id'
        const result = await this.pg.query(
            `DELETE FROM rbac_group_members WHERE group_id = $1 AND ${col} = $2`,
            [groupId, memberId]
        )
        return (result.rowCount ?? 0) > 0
    }
}

// ─── Role Repository ─────────────────────────────────────────────────────────

export class PgRbacAdRoleRepo implements IRbacRoleRepo {
    constructor(private pg: Queryable) { }

    private readonly cols = `id, key, name, description, is_system, created_at, updated_at`

    async list(): Promise<RbacRole[]> {
        const result = await this.pg.query<RbacRoleRow>(
            `SELECT ${this.cols} FROM rbac_roles ORDER BY name ASC`
        )
        return result.rows.map(mapRole)
    }

    async getById(id: string): Promise<RbacRole | null> {
        const result = await this.pg.query<RbacRoleRow>(
            `SELECT ${this.cols} FROM rbac_roles WHERE id = $1`, [id]
        )
        return result.rows[0] ? mapRole(result.rows[0]) : null
    }

    async getByKey(key: string): Promise<RbacRole | null> {
        const result = await this.pg.query<RbacRoleRow>(
            `SELECT ${this.cols} FROM rbac_roles WHERE key = $1`, [key]
        )
        return result.rows[0] ? mapRole(result.rows[0]) : null
    }

    async create(input: RbacRoleCreateInput): Promise<RbacRole> {
        const result = await this.pg.query<RbacRoleRow>(
            `INSERT INTO rbac_roles (key, name, description, is_system)
             VALUES ($1, $2, $3, $4)
             RETURNING ${this.cols}`,
            [input.key, input.name, input.description ?? null, input.isSystem ?? false]
        )
        return mapRole(result.rows[0])
    }

    async update(id: string, input: Partial<RbacRoleCreateInput>): Promise<RbacRole> {
        const sets: string[] = ['updated_at = NOW()']
        const params: any[] = []
        let idx = 1

        if (input.key !== undefined) { sets.push(`key = $${idx}`); params.push(input.key); idx++ }
        if (input.name !== undefined) { sets.push(`name = $${idx}`); params.push(input.name); idx++ }
        if (input.description !== undefined) { sets.push(`description = $${idx}`); params.push(input.description); idx++ }
        if (input.isSystem !== undefined) { sets.push(`is_system = $${idx}`); params.push(input.isSystem); idx++ }

        params.push(id)
        const result = await this.pg.query<RbacRoleRow>(
            `UPDATE rbac_roles SET ${sets.join(', ')} WHERE id = $${idx}
             RETURNING ${this.cols}`,
            params
        )
        return mapRole(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM rbac_roles WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }
}

// ─── Permission Repository ───────────────────────────────────────────────────

export class PgRbacAdPermissionRepo implements IRbacPermissionRepo {
    constructor(private pg: Queryable) { }

    async list(): Promise<RbacAdPermission[]> {
        const result = await this.pg.query<RbacAdPermissionRow>(
            `SELECT id, key, description, created_at FROM rbac_ad_permissions ORDER BY key ASC`
        )
        return result.rows.map(mapPermission)
    }

    async getByKey(key: string): Promise<RbacAdPermission | null> {
        const result = await this.pg.query<RbacAdPermissionRow>(
            `SELECT id, key, description, created_at FROM rbac_ad_permissions WHERE key = $1`, [key]
        )
        return result.rows[0] ? mapPermission(result.rows[0]) : null
    }

    async getRolePermissions(roleId: string): Promise<RbacAdPermission[]> {
        const result = await this.pg.query<RbacAdPermissionRow>(
            `SELECT p.id, p.key, p.description, p.created_at
             FROM rbac_ad_permissions p
             JOIN rbac_role_ad_permissions rp ON rp.permission_id = p.id
             WHERE rp.role_id = $1
             ORDER BY p.key ASC`,
            [roleId]
        )
        return result.rows.map(mapPermission)
    }

    async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
        // Delete existing mappings
        await this.pg.query(`DELETE FROM rbac_role_ad_permissions WHERE role_id = $1`, [roleId])

        if (permissionIds.length === 0) return

        // Insert new mappings
        const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ')
        await this.pg.query(
            `INSERT INTO rbac_role_ad_permissions (role_id, permission_id) VALUES ${values}
             ON CONFLICT DO NOTHING`,
            [roleId, ...permissionIds]
        )
    }

    async getAllRolePermissionMappings(): Promise<Map<string, Set<string>>> {
        const result = await this.pg.query<RolePermRow & { permission_key: string }>(
            `SELECT rp.role_id, p.key AS permission_key
             FROM rbac_role_ad_permissions rp
             JOIN rbac_ad_permissions p ON p.id = rp.permission_id`
        )

        const map = new Map<string, Set<string>>()
        for (const row of result.rows) {
            let set = map.get(row.role_id)
            if (!set) { set = new Set(); map.set(row.role_id, set) }
            set.add(row.permission_key)
        }
        return map
    }
}

// ─── ACL Repository ──────────────────────────────────────────────────────────

export class PgRbacAclRepo implements IRbacAclRepo {
    constructor(private pg: Queryable) { }

    private readonly cols = `id, principal_type, principal_user_id, principal_group_id,
        role_id, scope_type, scope_ou_id, scope_resource,
        effect, inherit, created_by, created_at, updated_at`

    async list(filters?: { principalUserId?: string; principalGroupId?: string; roleId?: string; scopeOuId?: string }): Promise<AclEntry[]> {
        const conditions: string[] = ['1=1']
        const params: any[] = []
        let idx = 1

        if (filters?.principalUserId) { conditions.push(`principal_user_id = $${idx}`); params.push(filters.principalUserId); idx++ }
        if (filters?.principalGroupId) { conditions.push(`principal_group_id = $${idx}`); params.push(filters.principalGroupId); idx++ }
        if (filters?.roleId) { conditions.push(`role_id = $${idx}`); params.push(filters.roleId); idx++ }
        if (filters?.scopeOuId) { conditions.push(`scope_ou_id = $${idx}`); params.push(filters.scopeOuId); idx++ }

        const result = await this.pg.query<AclRow>(
            `SELECT ${this.cols} FROM rbac_acl WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
            params
        )
        return result.rows.map(mapAcl)
    }

    async listAll(): Promise<AclEntry[]> {
        const result = await this.pg.query<AclRow>(
            `SELECT ${this.cols} FROM rbac_acl`
        )
        return result.rows.map(mapAcl)
    }

    async getById(id: string): Promise<AclEntry | null> {
        const result = await this.pg.query<AclRow>(
            `SELECT ${this.cols} FROM rbac_acl WHERE id = $1`, [id]
        )
        return result.rows[0] ? mapAcl(result.rows[0]) : null
    }

    async create(input: AclAssignInput): Promise<AclEntry> {
        const result = await this.pg.query<AclRow>(
            `INSERT INTO rbac_acl (
                principal_type, principal_user_id, principal_group_id,
                role_id, scope_type, scope_ou_id, scope_resource,
                effect, inherit, created_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING ${this.cols}`,
            [
                input.principalType,
                input.principalUserId ?? null,
                input.principalGroupId ?? null,
                input.roleId,
                input.scopeType,
                input.scopeOuId ?? null,
                input.scopeResource ?? null,
                input.effect,
                input.inherit ?? true,
                input.createdBy ?? null,
            ]
        )
        return mapAcl(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(`DELETE FROM rbac_acl WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }
}
