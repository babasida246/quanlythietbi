import { describe, it, expect } from 'vitest'
import {
    cmdbChangeCreateSchema,
    cmdbCiCreateSchema,
    cmdbRelationshipCreateSchema,
    cmdbRelationshipImportSchema,
    cmdbServiceCreateSchema,
    cmdbTypeCreateSchema
} from './cmdb.schemas.js'

describe('cmdb schemas', () => {
    it('validates cmdb type create', () => {
        const parsed = cmdbTypeCreateSchema.parse({ code: 'APP', name: 'Application' })
        expect(parsed.code).toBe('APP')
    })

    it('validates cmdb ci create with attributes', () => {
        const parsed = cmdbCiCreateSchema.parse({
            typeId: '123e4567-e89b-12d3-a456-426614174000',
            name: 'App',
            ciCode: 'APP-1',
            attributes: { owner: 'team' }
        })
        expect(parsed.attributes?.owner).toBe('team')
    })

    it('validates relationship create payload', () => {
        const parsed = cmdbRelationshipCreateSchema.parse({
            relTypeId: '123e4567-e89b-12d3-a456-426614174001',
            fromCiId: '123e4567-e89b-12d3-a456-426614174002',
            toCiId: '123e4567-e89b-12d3-a456-426614174003'
        })
        expect(parsed.fromCiId).toBeDefined()
    })

    it('validates service create payload', () => {
        const parsed = cmdbServiceCreateSchema.parse({ code: 'SVC', name: 'Service' })
        expect(parsed.name).toBe('Service')
    })

    it('validates relationship import payload', () => {
        const parsed = cmdbRelationshipImportSchema.parse({
            dryRun: true,
            items: [{
                relTypeId: '123e4567-e89b-12d3-a456-426614174001',
                fromCiId: '123e4567-e89b-12d3-a456-426614174002',
                toCiId: '123e4567-e89b-12d3-a456-426614174003'
            }]
        })
        expect(parsed.items).toHaveLength(1)
        expect(parsed.dryRun).toBe(true)
    })

    it('validates cmdb change create payload', () => {
        const parsed = cmdbChangeCreateSchema.parse({
            title: 'Deploy patch',
            risk: 'high',
            primaryCiId: '123e4567-e89b-12d3-a456-426614174003',
            plannedStartAt: '2026-02-24T10:00:00.000Z',
            plannedEndAt: '2026-02-24T11:00:00.000Z'
        })
        expect(parsed.risk).toBe('high')
    })
})
