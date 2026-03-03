import { describe, it, expect } from 'vitest'
import { CiType, CiTypeVersion, CiAttrDef } from './CiSchema.js'

describe('cmdb schema entities', () => {
    it('creates a CI type', () => {
        const type = new CiType({ id: 't1', code: 'SERVER', name: 'Server' })
        expect(type.code).toBe('SERVER')
    })

    it('validates version and status', () => {
        expect(() => new CiTypeVersion({
            id: 'v1',
            typeId: 't1',
            version: 0,
            status: 'draft'
        })).toThrow()
    })

    it('validates attribute definitions', () => {
        const def = new CiAttrDef({
            id: 'd1',
            versionId: 'v1',
            key: 'ipAddress',
            label: 'IP Address',
            fieldType: 'ip'
        })
        expect(def.fieldType).toBe('ip')
        expect(() => new CiAttrDef({
            id: 'd2',
            versionId: 'v1',
            key: 'roles',
            label: 'Roles',
            fieldType: 'enum'
        })).toThrow()
    })
})
