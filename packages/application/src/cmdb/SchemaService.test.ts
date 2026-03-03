import { describe, it, expect } from 'vitest'
import { SchemaService } from './SchemaService.js'
import type {
    CiAttrDefCreateInput,
    CiAttrDefInput,
    CiAttrDefRecord,
    CiAttrDefUpdatePatch,
    CiAttrValueInput,
    CiAttrValueRecord,
    CiCreateInput,
    CiPage,
    CiRecord,
    CiTypeRecord,
    CiTypeVersionRecord,
    ICiAttrValueRepo,
    ICiRepo,
    ICiSchemaRepo,
    ICiTypeRepo,
    ICiTypeVersionRepo,
    IOpsEventRepo,
    OpsEventInput,
    OpsEventRecord
} from '@qltb/contracts'

class FakeOpsEvents implements IOpsEventRepo {
    events: OpsEventInput[] = []

    async append(event: OpsEventInput): Promise<OpsEventRecord> {
        this.events.push(event)
        return { id: `evt-${this.events.length}`, createdAt: new Date(), ...event }
    }

    async listByEntity(): Promise<OpsEventRecord[]> {
        return []
    }
}

class FakeTypeRepo implements ICiTypeRepo {
    items: CiTypeRecord[] = []
    async create(input: { code: string; name: string; description?: string | null }): Promise<CiTypeRecord> {
        const record: CiTypeRecord = { id: `type-${this.items.length + 1}`, createdAt: new Date(), ...input }
        this.items.push(record)
        return record
    }
    async getById(_id: string): Promise<CiTypeRecord | null> { return null }
    async list(): Promise<CiTypeRecord[]> { return this.items }
}

class FakeVersionRepo implements ICiTypeVersionRepo {
    versions: CiTypeVersionRecord[] = []
    async listByType(typeId: string): Promise<CiTypeVersionRecord[]> {
        return this.versions.filter(v => v.typeId === typeId)
    }
    async getActiveByType(typeId: string): Promise<CiTypeVersionRecord | null> {
        return this.versions.find(v => v.typeId === typeId && v.status === 'active') ?? null
    }
    async getById(id: string): Promise<CiTypeVersionRecord | null> {
        return this.versions.find(v => v.id === id) ?? null
    }
    async getLatestVersionNumber(typeId: string): Promise<number> {
        const list = this.versions.filter(v => v.typeId === typeId)
        return list.reduce((max, v) => Math.max(max, v.version), 0)
    }
    async create(typeId: string, version: number, status: CiTypeVersionRecord['status'], createdBy?: string | null): Promise<CiTypeVersionRecord> {
        const record: CiTypeVersionRecord = { id: `ver-${version}`, typeId, version, status, createdBy: createdBy ?? null, createdAt: new Date() }
        this.versions.push(record)
        return record
    }
    async updateStatus(id: string, status: CiTypeVersionRecord['status']): Promise<CiTypeVersionRecord | null> {
        const existing = await this.getById(id)
        if (!existing) return null
        const updated = { ...existing, status }
        this.versions = this.versions.map(v => v.id === id ? updated : v)
        return updated
    }
    async retireOtherActive(typeId: string, keepId: string): Promise<number> {
        let count = 0
        this.versions = this.versions.map(v => {
            if (v.typeId === typeId && v.status === 'active' && v.id !== keepId) {
                count += 1
                return { ...v, status: 'retired' }
            }
            return v
        })
        return count
    }
}

class FakeDefRepo implements ICiSchemaRepo {
    defs: CiAttrDefRecord[] = []
    constructor(private types: ICiTypeRepo, private versions: ICiTypeVersionRepo) { }
    async listByVersion(versionId: string): Promise<CiAttrDefRecord[]> {
        return this.defs.filter(def => def.versionId === versionId)
    }
    async bulkInsert(_versionId: string, _defs: CiAttrDefInput[]): Promise<CiAttrDefRecord[]> { return [] }
    async create(input: CiAttrDefCreateInput): Promise<CiAttrDefRecord> {
        return {
            id: 'def-created',
            versionId: input.versionId,
            key: input.key,
            label: input.label,
            fieldType: input.fieldType,
            required: input.required ?? false,
            unit: input.unit ?? null,
            enumValues: input.enumValues ?? null,
            pattern: input.pattern ?? null,
            minValue: input.minValue ?? null,
            maxValue: input.maxValue ?? null,
            stepValue: input.stepValue ?? null,
            minLen: input.minLen ?? null,
            maxLen: input.maxLen ?? null,
            defaultValue: input.defaultValue,
            isSearchable: input.isSearchable ?? false,
            isFilterable: input.isFilterable ?? false,
            sortOrder: input.sortOrder ?? 0,
            isActive: input.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    }
    async update(_id: string, _patch: CiAttrDefUpdatePatch): Promise<CiAttrDefRecord | null> { return null }
    async softDelete(_id: string): Promise<boolean> { return true }
    async withTransaction<T>(handler: (context: { types: ICiTypeRepo; versions: ICiTypeVersionRepo; defs: ICiSchemaRepo }) => Promise<T>): Promise<T> {
        return handler({ types: this.types, versions: this.versions, defs: this })
    }
}

class FakeCiRepo implements ICiRepo {
    async create(_input: CiCreateInput): Promise<CiRecord> { throw new Error('not used') }
    async update(_id: string, _patch: Partial<CiCreateInput>): Promise<CiRecord | null> { throw new Error('not used') }
    async getById(_id: string): Promise<CiRecord | null> { return null }
    async list(_filters: { typeId?: string; page?: number; limit?: number }): Promise<CiPage> {
        return {
            items: [{
                id: 'ci-1',
                typeId: 'type-1',
                name: 'CI 1',
                ciCode: 'CI-1',
                status: 'active',
                environment: 'prod',
                createdAt: new Date(),
                updatedAt: new Date()
            }],
            total: 1,
            page: 1,
            limit: 100
        }
    }
    async getByAssetId(_assetId: string): Promise<CiRecord | null> { return null }
}

class FakeAttrValues implements ICiAttrValueRepo {
    async listByCi(_ciId: string): Promise<CiAttrValueRecord[]> {
        return []
    }
    async upsertMany(_ciId: string, _versionId: string, _values: CiAttrValueInput[]): Promise<CiAttrValueRecord[]> {
        return []
    }
}

describe('SchemaService', () => {
    it('publishes versions and returns warnings', async () => {
        const types = new FakeTypeRepo()
        const versions = new FakeVersionRepo()
        const defs = new FakeDefRepo(types, versions)
        const cis = new FakeCiRepo()
        const attrValues = new FakeAttrValues()
        const ops = new FakeOpsEvents()
        const service = new SchemaService(types, versions, defs, cis, attrValues, ops)

        const type = await types.create({ code: 'APP', name: 'Application' })
        const version = await versions.create(type.id, 1, 'draft', 'admin')
        defs.defs = [{
            id: 'def-1',
            versionId: version.id,
            key: 'owner',
            label: 'Owner',
            fieldType: 'string',
            required: true,
            unit: null,
            enumValues: null,
            pattern: null,
            minValue: null,
            maxValue: null,
            stepValue: null,
            minLen: null,
            maxLen: null,
            defaultValue: null,
            isSearchable: false,
            isFilterable: false,
            sortOrder: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }]

        const result = await service.publishVersion(version.id, { userId: 'admin', correlationId: 'corr-1' })
        expect(result.version.status).toBe('active')
        expect(result.warnings.length).toBe(1)
        expect(ops.events.some(event => event.eventType === 'SPEC_VERSION_PUBLISHED')).toBe(true)
    })
})
