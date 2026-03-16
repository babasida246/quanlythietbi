import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

const BASE = '/api/v1/admin/permissions/policies'

type Policy = {
    id: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
    permissionCount: number
    createdAt: string
}

type PolicyAssignment = {
    id: string
    principalType: 'USER' | 'GROUP' | 'OU'
    principalId: string
    scopeType: 'GLOBAL' | 'OU' | 'RESOURCE'
    effect: 'ALLOW' | 'DENY'
    inherit: boolean
}

type Permission = {
    id: string
    name: string
    resource: string
    action: string
}

test.describe('API — Unified Policy System', () => {
    // ── Static catalog endpoints ─────────────────────────────────────────────

    test('GET /policies — list returns array', async ({ request }) => {
        const res = await request.get(BASE, { headers: await apiHeaders('admin') })
        expect(res.status()).toBe(200)
        const body = await res.json() as { data: Policy[] }
        expect(Array.isArray(body.data)).toBeTruthy()
        // Migrated policies from roles table should exist
        expect(body.data.length).toBeGreaterThan(0)
    })

    test('GET /policies/permission-catalog — returns permissions list', async ({ request }) => {
        const res = await request.get(`${BASE}/permission-catalog`, { headers: await apiHeaders('admin') })
        expect(res.status()).toBe(200)
        const body = await res.json() as { data: Permission[] }
        expect(Array.isArray(body.data)).toBeTruthy()
        expect(body.data.length).toBeGreaterThan(0)
        // Verify shape
        const first = body.data[0]
        expect(first).toHaveProperty('id')
        expect(first).toHaveProperty('name')
        expect(first).toHaveProperty('resource')
        expect(first).toHaveProperty('action')
    })

    test('GET /policies/principals — returns users/groups/ous', async ({ request }) => {
        const res = await request.get(`${BASE}/principals`, { headers: await apiHeaders('admin') })
        expect(res.status()).toBe(200)
        const body = await res.json() as { data: { users: unknown[]; groups: unknown[]; ous: unknown[] } }
        expect(Array.isArray(body.data.users)).toBeTruthy()
        expect(Array.isArray(body.data.groups)).toBeTruthy()
        expect(Array.isArray(body.data.ous)).toBeTruthy()
    })

    // ── Policy CRUD lifecycle ─────────────────────────────────────────────────

    test('Policy CRUD — create, set permissions, assignments, delete', async ({ request }) => {
        const ts = Date.now()
        const slug = `e2e_policy_${ts}`
        let policyId = ''

        try {
            // 1. Create policy
            const createRes = await request.post(BASE, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: { slug, name: 'E2E Test Policy', description: 'Created by Playwright' }
            })
            expect(createRes.status()).toBe(201)
            const createBody = await createRes.json() as { data: Policy }
            policyId = createBody.data.id
            expect(createBody.data.slug).toBe(slug)
            expect(createBody.data.isSystem).toBeFalsy()
            expect(createBody.data.permissionCount).toBe(0)

            // 2. Verify it appears in list
            const listRes = await request.get(BASE, { headers: await apiHeaders('admin') })
            const listBody = await listRes.json() as { data: Policy[] }
            const found = listBody.data.find(p => p.id === policyId)
            expect(found).toBeTruthy()

            // 3. Get permission catalog and assign 2 permissions
            const catalogRes = await request.get(`${BASE}/permission-catalog`, { headers: await apiHeaders('admin') })
            const catalog = (await catalogRes.json() as { data: Permission[] }).data
            const permIds = catalog.slice(0, 2).map(p => p.id)

            const setPermsRes = await request.put(`${BASE}/${policyId}/permissions`, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: { permissionIds: permIds }
            })
            expect(setPermsRes.status()).toBe(200)
            const setPermsBody = await setPermsRes.json() as { data: { success: boolean; permissionCount: number } }
            expect(setPermsBody.data.permissionCount).toBe(2)

            // 4. Verify GET policy permissions
            const getPermsRes = await request.get(`${BASE}/${policyId}/permissions`, {
                headers: await apiHeaders('admin')
            })
            expect(getPermsRes.status()).toBe(200)
            const getPermsBody = await getPermsRes.json() as { data: Array<{ permission_id: string }> }
            const grantedIds = new Set(getPermsBody.data.map(p => p.permission_id))
            expect(grantedIds.has(permIds[0])).toBeTruthy()
            expect(grantedIds.has(permIds[1])).toBeTruthy()

            // 5. Update policy metadata
            const updateRes = await request.put(`${BASE}/${policyId}`, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: { name: 'E2E Test Policy (Updated)', description: 'Updated by Playwright' }
            })
            expect(updateRes.status()).toBe(200)

            // 6. Add assignment — get admin user id first
            const meRes = await request.get('/api/v1/auth/me', { headers: await apiHeaders('admin') })
            const meBody = await meRes.json() as { data: { id: string } }
            const adminId = meBody.data.id

            const addAssignRes = await request.post(`${BASE}/${policyId}/assignments`, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: {
                    principalType: 'USER',
                    principalId: adminId,
                    scopeType: 'GLOBAL',
                    effect: 'ALLOW',
                    inherit: true,
                }
            })
            expect(addAssignRes.status()).toBe(201)
            const addAssignBody = await addAssignRes.json() as { data: { id: string } }
            const assignmentId = addAssignBody.data.id
            expect(assignmentId).toBeTruthy()

            // 7. List assignments
            const listAssignRes = await request.get(`${BASE}/${policyId}/assignments`, {
                headers: await apiHeaders('admin')
            })
            expect(listAssignRes.status()).toBe(200)
            const listAssignBody = await listAssignRes.json() as { data: PolicyAssignment[] }
            expect(listAssignBody.data.length).toBeGreaterThanOrEqual(1)
            const assignment = listAssignBody.data.find(a => a.id === assignmentId)
            expect(assignment).toBeTruthy()
            expect(assignment?.principalType).toBe('USER')
            expect(assignment?.effect).toBe('ALLOW')
            expect(assignment?.scopeType).toBe('GLOBAL')

            // 8. Remove assignment
            const removeAssignRes = await request.delete(`${BASE}/${policyId}/assignments/${assignmentId}`, {
                headers: await apiHeaders('admin')
            })
            expect(removeAssignRes.status()).toBe(200)

            // 9. Verify assignment removed
            const listAfterRemove = await request.get(`${BASE}/${policyId}/assignments`, {
                headers: await apiHeaders('admin')
            })
            const afterBody = await listAfterRemove.json() as { data: PolicyAssignment[] }
            expect(afterBody.data.find(a => a.id === assignmentId)).toBeFalsy()

        } finally {
            // Cleanup: delete policy (also cascades assignments + permissions)
            if (policyId) {
                await request.delete(`${BASE}/${policyId}`, { headers: await apiHeaders('admin') })
            }
        }
    })

    // ── DENY effect test ──────────────────────────────────────────────────────

    test('Policy DENY assignment is reflected in effective permissions', async ({ request }) => {
        const ts = Date.now()
        const slug = `e2e_deny_${ts}`
        let policyId = ''

        try {
            // Get admin user id
            const meRes = await request.get('/api/v1/auth/me', { headers: await apiHeaders('admin') })
            const meBody = await meRes.json() as { data: { id: string } }
            const adminId = meBody.data.id

            // Get a permission to deny
            const catalogRes = await request.get(`${BASE}/permission-catalog`, { headers: await apiHeaders('admin') })
            const catalog = (await catalogRes.json() as { data: Permission[] }).data
            // Pick a permission the admin definitely has via classic role
            const adminRoleRes = await request.get('/api/v1/admin/permissions/classic/roles/admin/permissions', {
                headers: await apiHeaders('admin')
            })
            const adminRolePerms = (await adminRoleRes.json() as { data: Array<{ permission_id: string; name: string }> }).data
            if (adminRolePerms.length === 0) return // skip if no perms on admin role

            const targetPermId = adminRolePerms[0].permission_id
            const targetPermName = adminRolePerms[0].name

            // Create DENY policy for that permission
            const createRes = await request.post(BASE, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: { slug, name: 'E2E DENY Policy' }
            })
            expect(createRes.status()).toBe(201)
            policyId = (await createRes.json() as { data: Policy }).data.id

            // Set the permission on the DENY policy
            await request.put(`${BASE}/${policyId}/permissions`, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: { permissionIds: [targetPermId] }
            })

            // Add DENY assignment for admin user
            await request.post(`${BASE}/${policyId}/assignments`, {
                headers: { ...(await apiHeaders('admin')), 'content-type': 'application/json' },
                data: { principalType: 'USER', principalId: adminId, scopeType: 'GLOBAL', effect: 'DENY', inherit: true }
            })

            // Check effective permissions — permission should now be DENIED
            const effectiveRes = await request.get(`/api/v1/admin/permissions/effective/system-users/${adminId}`, {
                headers: await apiHeaders('admin')
            })
            expect(effectiveRes.status()).toBe(200)
            const effectiveBody = await effectiveRes.json() as {
                data: {
                    allowed: string[]
                    denied: string[]
                    sources: { policyDenied?: string[] }
                }
            }
            expect(effectiveBody.data.denied).toContain(targetPermName)
            expect(effectiveBody.data.allowed).not.toContain(targetPermName)
            expect(effectiveBody.data.sources.policyDenied ?? []).toContain(targetPermName)

        } finally {
            if (policyId) {
                await request.delete(`${BASE}/${policyId}`, { headers: await apiHeaders('admin') })
            }
        }
    })

    // ── Guard: non-admin cannot access ───────────────────────────────────────

    test('Policy endpoints require admin:roles permission', async ({ request }) => {
        const res = await request.get(BASE)
        expect(res.status()).toBe(401)
    })

    // ── System policy cannot be deleted ──────────────────────────────────────

    test('System policies cannot be deleted', async ({ request }) => {
        // Find a system policy (migrated from roles — is_system=true)
        const listRes = await request.get(BASE, { headers: await apiHeaders('admin') })
        const policies = (await listRes.json() as { data: Policy[] }).data
        const systemPol = policies.find(p => p.isSystem)
        if (!systemPol) return // no system policies — skip

        const deleteRes = await request.delete(`${BASE}/${systemPol.id}`, {
            headers: await apiHeaders('admin')
        })
        expect(deleteRes.status()).toBe(403)
    })

    // ── Effective perms includes policyAllowed/policyDenied sources ───────────

    test('Effective perms response has policyAllowed and policyDenied in sources', async ({ request }) => {
        const meRes = await request.get('/api/v1/auth/me', { headers: await apiHeaders('admin') })
        const adminId = (await meRes.json() as { data: { id: string } }).data.id

        const effectiveRes = await request.get(`/api/v1/admin/permissions/effective/system-users/${adminId}`, {
            headers: await apiHeaders('admin')
        })
        expect(effectiveRes.status()).toBe(200)
        const body = await effectiveRes.json() as {
            data: { sources: Record<string, unknown> }
        }
        expect(body.data.sources).toHaveProperty('policyAllowed')
        expect(body.data.sources).toHaveProperty('policyDenied')
        expect(Array.isArray(body.data.sources['policyAllowed'])).toBeTruthy()
        expect(Array.isArray(body.data.sources['policyDenied'])).toBeTruthy()
    })
})
