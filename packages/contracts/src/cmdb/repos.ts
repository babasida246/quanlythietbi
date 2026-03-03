import type {
    CiAttrDefCreateInput,
    CiAttrDefInput,
    CiAttrDefRecord,
    CiAttrDefUpdatePatch,
    CiAttrValueInput,
    CiAttrValueRecord,
    CiCreateInput,
    CiListFilters,
    CiPage,
    CiRecord,
    CiTypeRecord,
    CiTypeVersionRecord,
    CmdbServiceMemberRecord,
    CmdbServicePage,
    CmdbServiceRecord,
    CmdbChangeCreateInput,
    CmdbChangeListFilters,
    CmdbChangePage,
    CmdbChangeRecord,
    CmdbChangeUpdatePatch,
    RelationshipRecord,
    RelationshipTypeRecord
} from './types.js'
import type { SpecVersionStatus } from '@qltb/domain'

export interface CiSchemaTransactionContext {
    types: ICiTypeRepo
    versions: ICiTypeVersionRepo
    defs: ICiSchemaRepo
}

export interface ICiTypeRepo {
    create(input: { code: string; name: string; description?: string | null }): Promise<CiTypeRecord>
    getById(id: string): Promise<CiTypeRecord | null>
    list(): Promise<CiTypeRecord[]>
}

export interface ICiTypeVersionRepo {
    listByType(typeId: string): Promise<CiTypeVersionRecord[]>
    getActiveByType(typeId: string): Promise<CiTypeVersionRecord | null>
    getById(id: string): Promise<CiTypeVersionRecord | null>
    getLatestVersionNumber(typeId: string): Promise<number>
    create(typeId: string, version: number, status: SpecVersionStatus, createdBy?: string | null): Promise<CiTypeVersionRecord>
    updateStatus(id: string, status: SpecVersionStatus): Promise<CiTypeVersionRecord | null>
    retireOtherActive(typeId: string, keepId: string): Promise<number>
}

export interface ICiSchemaRepo {
    listByVersion(versionId: string): Promise<CiAttrDefRecord[]>
    bulkInsert(versionId: string, defs: CiAttrDefInput[]): Promise<CiAttrDefRecord[]>
    create(input: CiAttrDefCreateInput): Promise<CiAttrDefRecord>
    update(id: string, patch: CiAttrDefUpdatePatch): Promise<CiAttrDefRecord | null>
    softDelete(id: string): Promise<boolean>
    withTransaction<T>(handler: (context: CiSchemaTransactionContext) => Promise<T>): Promise<T>
}

export interface ICiRepo {
    create(input: CiCreateInput): Promise<CiRecord>
    update(id: string, patch: Partial<CiCreateInput>): Promise<CiRecord | null>
    getById(id: string): Promise<CiRecord | null>
    list(filters: CiListFilters): Promise<CiPage>
    getByAssetId(assetId: string): Promise<CiRecord | null>
}

export interface ICiAttrValueRepo {
    listByCi(ciId: string): Promise<CiAttrValueRecord[]>
    upsertMany(ciId: string, versionId: string, values: CiAttrValueInput[]): Promise<CiAttrValueRecord[]>
}

export interface IRelTypeRepo {
    create(input: { code: string; name: string; reverseName?: string | null; allowedFromTypeId?: string | null; allowedToTypeId?: string | null }): Promise<RelationshipTypeRecord>
    list(): Promise<RelationshipTypeRecord[]>
    getById(id: string): Promise<RelationshipTypeRecord | null>
    update(
        id: string,
        patch: Partial<{
            code: string
            name: string
            reverseName: string | null
            allowedFromTypeId: string | null
            allowedToTypeId: string | null
        }>
    ): Promise<RelationshipTypeRecord | null>
    delete(id: string): Promise<boolean>
}

export interface IRelRepo {
    create(input: { relTypeId: string; fromCiId: string; toCiId: string; sinceDate?: string | null; note?: string | null }): Promise<RelationshipRecord>
    retire(id: string): Promise<RelationshipRecord | null>
    listByCi(ciId: string): Promise<RelationshipRecord[]>
    list(): Promise<RelationshipRecord[]>
}

export interface ICmdbChangeRepo {
    create(input: CmdbChangeCreateInput): Promise<CmdbChangeRecord>
    update(id: string, patch: CmdbChangeUpdatePatch): Promise<CmdbChangeRecord | null>
    getById(id: string): Promise<CmdbChangeRecord | null>
    list(filters: CmdbChangeListFilters): Promise<CmdbChangePage>
}

export interface IServiceRepo {
    create(input: { code: string; name: string; criticality?: string | null; owner?: string | null; sla?: string | null; status?: string | null }): Promise<CmdbServiceRecord>
    update(id: string, patch: Partial<CmdbServiceRecord>): Promise<CmdbServiceRecord | null>
    getById(id: string): Promise<CmdbServiceRecord | null>
    list(filters: { q?: string; page?: number; limit?: number }): Promise<CmdbServicePage>
    addMember(serviceId: string, input: { ciId: string; role?: string | null }): Promise<CmdbServiceMemberRecord>
    removeMember(memberId: string): Promise<boolean>
    listMembers(serviceId: string): Promise<CmdbServiceMemberRecord[]>
}
