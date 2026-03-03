import { expect, test } from '@playwright/test'
import jwt from 'jsonwebtoken'
import pg from 'pg'

type JwtIdentity = {
    userId: string
    email: string
    role: string
}

type DbUserRow = {
    id: string
    email: string
    role: string
}

type ApiEnvelope<T> = {
    data: T
    meta?: { total?: number; page?: number; limit?: number }
}

type CiRecord = {
    id: string
    ciCode: string
    name: string
}

type RelationshipType = {
    id: string
    code: string
    name: string
}

type CmdbChange = {
    id: string
    code: string
    title: string
    status: 'draft' | 'submitted' | 'approved' | 'implemented' | 'closed' | 'canceled'
    primaryCiId?: string | null
    approvedBy?: string | null
    implementedAt?: string | null
    closedAt?: string | null
    impactSnapshot?: unknown
}

type RelationshipImportResult = {
    dryRun: boolean
    total: number
    created: Array<{
        id: string
        relTypeId: string
        fromCiId: string
        toCiId: string
        note?: string | null
    }>
    errors: Array<{ index: number; message: string }>
}

function bearerHeaders(identity: JwtIdentity): Record<string, string> {
    const token = jwt.sign(
        {
            userId: identity.userId,
            email: identity.email,
            role: identity.role
        },
        process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key',
        { expiresIn: '15m' }
    )

    return {
        authorization: `Bearer ${token}`
    }
}

async function loadPrivilegedUsers(limit = 2): Promise<JwtIdentity[]> {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'
    const client = new pg.Client({ connectionString })
    await client.connect()
    try {
        const result = await client.query<DbUserRow>(
            `
            SELECT id::text, email, role
            FROM users
            WHERE COALESCE(is_active, true) = true
              AND COALESCE(status, 'active') = 'active'
              AND role IN ('admin', 'super_admin', 'it_asset_manager', 'manager')
            ORDER BY CASE
                WHEN role IN ('super_admin', 'admin') THEN 0
                WHEN role IN ('it_asset_manager', 'manager') THEN 1
                ELSE 9
            END, created_at ASC
            LIMIT $1
            `,
            [limit]
        )

        return result.rows.map((row) => ({
            userId: row.id,
            email: row.email,
            role: row.role
        }))
    } finally {
        await client.end().catch(() => undefined)
    }
}

async function json<T>(response: import('@playwright/test').APIResponse): Promise<T> {
    return (await response.json()) as T
}

test.describe('API CMDB P4', () => {
    test('cmdb change workflow and relationship import dry-run work via HTTP', async ({ request }) => {
        test.slow()

        const privilegedUsers = await loadPrivilegedUsers(2)
        expect(privilegedUsers.length).toBeGreaterThan(1)
        const requester = privilegedUsers[0]
        const approver = privilegedUsers[1]

        const cisResponse = await request.get('/api/v1/cmdb/cis?limit=20', {
            headers: bearerHeaders(requester)
        })
        expect(cisResponse.status()).toBe(200)
        const cisBody = await json<ApiEnvelope<CiRecord[]>>(cisResponse)
        const cis = cisBody.data ?? []
        expect(cis.length).toBeGreaterThan(1)
        const ciA = cis[0]
        const ciB = cis.find((item) => item.id !== ciA.id)
        expect(ciB, 'Need two distinct CIs for P4 verification').toBeTruthy()

        let relTypesResponse = await request.get('/api/v1/cmdb/relationship-types', {
            headers: bearerHeaders(requester)
        })
        expect(relTypesResponse.status()).toBe(200)
        let relTypesBody = await json<ApiEnvelope<RelationshipType[]>>(relTypesResponse)
        let relTypes = relTypesBody.data ?? []
        if (relTypes.length === 0) {
            const createRelType = await request.post('/api/v1/cmdb/relationship-types', {
                headers: {
                    ...bearerHeaders(requester),
                    'content-type': 'application/json'
                },
                data: {
                    code: `E2E_REL_${Date.now()}`,
                    name: 'e2e_depends_on',
                    reverseName: 'e2e_supports'
                }
            })
            expect(createRelType.status()).toBe(201)
            relTypesResponse = await request.get('/api/v1/cmdb/relationship-types', {
                headers: bearerHeaders(requester)
            })
            relTypesBody = await json<ApiEnvelope<RelationshipType[]>>(relTypesResponse)
            relTypes = relTypesBody.data ?? []
        }
        expect(relTypes.length).toBeGreaterThan(0)
        const relType = relTypes[0]

        const unique = Date.now()
        const draftTitle = `P4 API Change ${unique}`
        const updatedTitle = `${draftTitle} Updated`

        const createResponse = await request.post('/api/v1/cmdb/changes', {
            headers: {
                ...bearerHeaders(requester),
                'content-type': 'application/json'
            },
            data: {
                title: draftTitle,
                description: 'Playwright API verify P4',
                risk: 'medium',
                primaryCiId: ciA.id,
                implementationPlan: 'Apply planned change',
                rollbackPlan: 'Rollback if impact occurs',
                metadata: {
                    source: 'playwright-api',
                    run: unique
                }
            }
        })
        expect(createResponse.status()).toBe(201)
        const created = await json<ApiEnvelope<CmdbChange>>(createResponse)
        expect(created.data.id).toBeTruthy()
        expect(created.data.status).toBe('draft')

        const listResponse = await request.get(`/api/v1/cmdb/changes?q=${encodeURIComponent(draftTitle)}&primaryCiId=${ciA.id}`, {
            headers: bearerHeaders(requester)
        })
        expect(listResponse.status()).toBe(200)
        const listBody = await json<ApiEnvelope<CmdbChange[]>>(listResponse)
        expect(listBody.data.some((item) => item.id === created.data.id)).toBeTruthy()

        const detailResponse = await request.get(`/api/v1/cmdb/changes/${created.data.id}`, {
            headers: bearerHeaders(requester)
        })
        expect(detailResponse.status()).toBe(200)
        const detailBody = await json<ApiEnvelope<CmdbChange>>(detailResponse)
        expect(detailBody.data.id).toBe(created.data.id)
        expect(detailBody.data.primaryCiId).toBe(ciA.id)

        const updateResponse = await request.put(`/api/v1/cmdb/changes/${created.data.id}`, {
            headers: {
                ...bearerHeaders(requester),
                'content-type': 'application/json'
            },
            data: {
                title: updatedTitle,
                risk: 'high',
                description: 'Updated before submit',
                implementationPlan: 'Updated plan',
                rollbackPlan: 'Updated rollback'
            }
        })
        expect(updateResponse.status()).toBe(200)
        const updated = await json<ApiEnvelope<CmdbChange>>(updateResponse)
        expect(updated.data.status).toBe('draft')
        expect(updated.data.title).toBe(updatedTitle)

        const submitResponse = await request.post(`/api/v1/cmdb/changes/${created.data.id}/submit`, {
            headers: bearerHeaders(requester)
        })
        expect(submitResponse.status()).toBe(200)
        const submitted = await json<ApiEnvelope<CmdbChange>>(submitResponse)
        expect(submitted.data.status).toBe('submitted')
        expect(submitted.data.impactSnapshot).toBeTruthy()

        const approveResponse = await request.post(`/api/v1/cmdb/changes/${created.data.id}/approve`, {
            headers: bearerHeaders(approver)
        })
        expect(approveResponse.status()).toBe(200)
        const approved = await json<ApiEnvelope<CmdbChange>>(approveResponse)
        expect(approved.data.status).toBe('approved')
        expect(approved.data.approvedBy).toBe(approver.userId)

        const implementResponse = await request.post(`/api/v1/cmdb/changes/${created.data.id}/implement`, {
            headers: bearerHeaders(requester)
        })
        expect(implementResponse.status()).toBe(200)
        const implemented = await json<ApiEnvelope<CmdbChange>>(implementResponse)
        expect(implemented.data.status).toBe('implemented')
        expect(implemented.data.implementedAt).toBeTruthy()

        const closeResponse = await request.post(`/api/v1/cmdb/changes/${created.data.id}/close`, {
            headers: bearerHeaders(requester)
        })
        expect(closeResponse.status()).toBe(200)
        const closed = await json<ApiEnvelope<CmdbChange>>(closeResponse)
        expect(closed.data.status).toBe('closed')
        expect(closed.data.closedAt).toBeTruthy()

        const ciRelationshipsResponse = await request.get(`/api/v1/cmdb/cis/${ciA.id}/relationships`, {
            headers: bearerHeaders(requester)
        })
        expect(ciRelationshipsResponse.status()).toBe(200)
        const ciRelationshipsBody = await json<ApiEnvelope<unknown[]>>(ciRelationshipsResponse)
        expect(Array.isArray(ciRelationshipsBody.data)).toBeTruthy()

        const dryRunResponse = await request.post('/api/v1/cmdb/relationships/import', {
            headers: {
                ...bearerHeaders(requester),
                'content-type': 'application/json'
            },
            data: {
                dryRun: true,
                allowCycles: false,
                items: [
                    {
                        relTypeId: relType.id,
                        fromCiId: ciA.id,
                        toCiId: ciB!.id,
                        note: 'playwright-api-p4-dry-run'
                    }
                ]
            }
        })
        expect([200, 400]).toContain(dryRunResponse.status())
        const dryRunBody = await json<ApiEnvelope<RelationshipImportResult>>(dryRunResponse)
        expect(dryRunBody.data.dryRun).toBe(true)
        expect(dryRunBody.data.total).toBe(1)
    })
})
