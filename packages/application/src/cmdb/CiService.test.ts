import { describe, it, expect } from 'vitest'
import { CiService } from './CiService.js'
import type {
    CiAttrDefInput,
    CiAttrDefRecord,
    CiAttrValueRecord,
    CiCreateInput,
    CiSchemaTransactionContext,
    CiListFilters,
    CiPage,
    CiRecord,
    ICiTypeRepo,
    CiTypeVersionRecord,
    ICiAttrValueRepo,
    ICiRepo,
    ICiSchemaRepo,
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
    async listByEntity(): Promise<OpsEventRecord[]> { return [] }
}

class FakeCiRepo implements ICiRepo {
    private items: CiRecord[] = []
    async create(input: CiCreateInput): Promise<CiRecord> {
        const record: CiRecord = {
            id: `ci-${this.items.length + 1}`,
            typeId: input.typeId,
            name: input.name,
            ciCode: input.ciCode,
            status: input.status ?? 'active',
            environment: input.environment ?? 'prod',
            assetId: input.assetId ?? null,
            locationId: input.locationId ?? null,
            ownerTeam: input.ownerTeam ?? null,
            notes: input.notes ?? null,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        this.items.push(record)
        return record
    }
    async update(id: string, patch: Partial<CiCreateInput>): Promise<CiRecord | null> {
        const existing = await this.getById(id)
        if (!existing) return null
        const updated: CiRecord = { ...existing, ...patch, updatedAt: new Date() }
        this.items = this.items.map(item => item.id === id ? updated : item)
        return updated
    }
    async getById(id: string): Promise<CiRecord | null> {
        return this.items.find(item => item.id === id) ?? null
    }
    async list(_filters: CiListFilters): Promise<CiPage> {
        return { items: [...this.items], total: this.items.length, page: 1, limit: 20 }
    }
    async getByAssetId(_assetId: string): Promise<CiRecord | null> { return null }
}

class FakeVersions implements ICiTypeVersionRepo {
    async listByType(_typeId: string): Promise<CiTypeVersionRecord[]> { return [] }
    async getActiveByType(_typeId: string): Promise<CiTypeVersionRecord | null> {
        return { id: 'ver-1', typeId: 'type-1', version: 1, status: 'active', createdAt: new Date() }
    }
    async getById(_id: string): Promise<CiTypeVersionRecord | null> { return null }
    async getLatestVersionNumber(_typeId: string): Promise<number> { return 1 }
    async create(_typeId: string, _version: number, _status: 'draft' | 'active' | 'retired', _createdBy?: string | null): Promise<CiTypeVersionRecord> {
        return { id: 'ver-1', typeId: 'type-1', version: 1, status: 'draft', createdAt: new Date() }
    }
    async updateStatus(_id: string, _status: 'draft' | 'active' | 'retired'): Promise<CiTypeVersionRecord | null> { return null }
    async retireOtherActive(_typeId: string, _keepId: string): Promise<number> { return 0 }
}

class FakeDefs implements ICiSchemaRepo {
    defs: CiAttrDefRecord[] = [{
        id: 'def-1',
        versionId: 'ver-1',
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
    async listByVersion(_versionId: string): Promise<CiAttrDefRecord[]> { return this.defs }
    async bulkInsert(_versionId: string, _defs: CiAttrDefInput[]): Promise<CiAttrDefRecord[]> { return [] }
    async create(_input: { versionId: string; key: string; label: string; fieldType: string }): Promise<CiAttrDefRecord> { return this.defs[0] }
    async update(_id: string, _patch: { key?: string }): Promise<CiAttrDefRecord | null> { return this.defs[0] }
    async softDelete(_id: string): Promise<boolean> { return true }
    async withTransaction<T>(handler: (context: CiSchemaTransactionContext) => Promise<T>): Promise<T> {
        const types: ICiTypeRepo = {
            create: async (_input: { code: string; name: string; description?: string | null }) => ({ id: 'type-1', code: 'APP', name: 'Application', createdAt: new Date() }),
            getById: async (_id: string) => null,
            list: async () => []
        }
        const versions: ICiTypeVersionRepo = {
            listByType: async (_typeId: string) => [],
            getActiveByType: async (_typeId: string) => null,
            getById: async (_id: string) => null,
            getLatestVersionNumber: async (_typeId: string) => 0,
            create: async (_typeId: string, _version: number, _status: 'draft' | 'active' | 'retired', _createdBy?: string | null) => ({ id: 'ver-1', typeId: 'type-1', version: 1, status: 'draft', createdAt: new Date() }),
            updateStatus: async (_id: string, _status: 'draft' | 'active' | 'retired') => null,
            retireOtherActive: async (_typeId: string, _keepId: string) => 0
        }
        return handler({ types, versions, defs: this })
    }
}

class FakeValues implements ICiAttrValueRepo {
    async listByCi(_ciId: string): Promise<CiAttrValueRecord[]> { return [] }
    async upsertMany(_ciId: string, _versionId: string, _values: Array<{ key: string; value?: unknown }>): Promise<CiAttrValueRecord[]> {
        return []
    }
}

describe('CiService', () => {
    it('validates attributes against active schema', async () => {
        const service = new CiService(new FakeCiRepo(), new FakeVersions(), new FakeDefs(), new FakeValues(), new FakeOpsEvents())

        await expect(service.createCi(
            { typeId: 'type-1', name: 'App', ciCode: 'APP-1' },
            {},
            { userId: 'user-1', correlationId: 'corr-1' }
        )).rejects.toThrow()
    })
})
