import { expect, test } from '@playwright/test'
import { apiHeaders } from '../fixtures/auth'

type ClassicRole = {
    id: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
}

type ClassicPermission = {
    id: string
    name: string
    resource: string
    action: string
}

type EffectiveResponse = {
    systemUserId: string
    linkedRbacUserId: string | null
    roleSlug: string | null
    sources: {
        classic: string[]
        directoryAllowed: string[]
        directoryDenied: string[]
        policyAllowed: string[]
        policyDenied: string[]
    }
    allowed: string[]
    denied: string[]
}

test.describe('API Permission Center', () => {
    test('GET unified roles and permissions', async ({ request }) => {
        const rolesResponse = await request.get('/api/v1/admin/permissions/roles', {
            headers: await apiHeaders('admin')
        })
        expect(rolesResponse.status()).toBe(200)

        const rolesBody = await rolesResponse.json()
        expect(Array.isArray(rolesBody.data.classic)).toBeTruthy()
        expect(Array.isArray(rolesBody.data.directory)).toBeTruthy()

        const permsResponse = await request.get('/api/v1/admin/permissions/permissions', {
            headers: await apiHeaders('admin')
        })
        expect(permsResponse.status()).toBe(200)

        const permsBody = await permsResponse.json()
        expect(Array.isArray(permsBody.data.classic)).toBeTruthy()
        expect(Array.isArray(permsBody.data.directory)).toBeTruthy()
    })

    test('classic role CRUD through unified namespace', async ({ request }) => {
        const timestamp = Date.now()
        const roleSlug = `e2e_pc_${timestamp}`
        let created = false

        try {
            const listPermissions = await request.get('/api/v1/admin/permissions/classic/permissions', {
                headers: await apiHeaders('admin')
            })
            expect(listPermissions.status()).toBe(200)
            const permissionBody = await listPermissions.json() as { data: ClassicPermission[] }
            expect(permissionBody.data.length).toBeGreaterThan(0)
            const permissionIds = permissionBody.data.slice(0, 2).map((p) => p.id)

            const createResponse = await request.post('/api/v1/admin/permissions/classic/roles', {
                headers: {
                    ...(await apiHeaders('admin')),
                    'content-type': 'application/json'
                },
                data: {
                    slug: roleSlug,
                    name: 'E2E Permission Center Role',
                    description: 'created by playwright'
                }
            })
            expect(createResponse.status()).toBe(201)
            created = true

            const setPerms = await request.put(`/api/v1/admin/permissions/classic/roles/${roleSlug}/permissions`, {
                headers: {
                    ...(await apiHeaders('admin')),
                    'content-type': 'application/json'
                },
                data: {
                    permissionIds
                }
            })
            expect(setPerms.status()).toBe(200)

            const getPerms = await request.get(`/api/v1/admin/permissions/classic/roles/${roleSlug}/permissions`, {
                headers: await apiHeaders('admin')
            })
            expect(getPerms.status()).toBe(200)
            const getPermsBody = await getPerms.json() as { data: Array<{ permission_id: string }> }
            const grantedIds = new Set(getPermsBody.data.map((p) => p.permission_id))
            expect(grantedIds.size).toBeGreaterThan(0)
            expect(grantedIds.has(permissionIds[0])).toBeTruthy()

            const updateResponse = await request.put(`/api/v1/admin/permissions/classic/roles/${roleSlug}`, {
                headers: {
                    ...(await apiHeaders('admin')),
                    'content-type': 'application/json'
                },
                data: {
                    name: 'E2E Permission Center Role Updated',
                    description: 'updated by playwright'
                }
            })
            expect(updateResponse.status()).toBe(200)

            const listRoles = await request.get('/api/v1/admin/permissions/classic/roles', {
                headers: await apiHeaders('admin')
            })
            expect(listRoles.status()).toBe(200)
            const listRolesBody = await listRoles.json() as { data: ClassicRole[] }
            const createdRole = listRolesBody.data.find((role) => role.slug === roleSlug)
            expect(createdRole).toBeTruthy()
            expect(createdRole?.name).toContain('Updated')

            const deleteResponse = await request.delete(`/api/v1/admin/permissions/classic/roles/${roleSlug}`, {
                headers: await apiHeaders('admin')
            })
            expect(deleteResponse.status()).toBe(200)
            created = false
        } finally {
            if (created) {
                await request.delete(`/api/v1/admin/permissions/classic/roles/${roleSlug}`, {
                    headers: await apiHeaders('admin')
                })
            }
        }
    })

    test('GET effective permissions for current user via unified endpoint', async ({ request }) => {
        const me = await request.get('/api/v1/auth/me', {
            headers: await apiHeaders('admin')
        })
        expect(me.status()).toBe(200)
        const meBody = await me.json() as { data: { id: string } }
        expect(meBody.data.id).toBeTruthy()

        const effective = await request.get(`/api/v1/admin/permissions/effective/system-users/${meBody.data.id}`, {
            headers: await apiHeaders('admin')
        })
        expect(effective.status()).toBe(200)

        const body = await effective.json() as { data: EffectiveResponse }
        expect(body.data.systemUserId).toBe(meBody.data.id)
        expect(Array.isArray(body.data.allowed)).toBeTruthy()
        expect(Array.isArray(body.data.denied)).toBeTruthy()
        expect(Array.isArray(body.data.sources.classic)).toBeTruthy()
        expect(Array.isArray(body.data.sources.directoryAllowed)).toBeTruthy()
        expect(Array.isArray(body.data.sources.directoryDenied)).toBeTruthy()
        expect(Array.isArray(body.data.sources.policyAllowed)).toBeTruthy()
        expect(Array.isArray(body.data.sources.policyDenied)).toBeTruthy()
    })

    test('permission center endpoints require auth', async ({ request }) => {
        const response = await request.get('/api/v1/admin/permissions/roles')
        expect(response.status()).toBe(401)
    })
})
