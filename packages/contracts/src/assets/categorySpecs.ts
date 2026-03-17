export type { NormalizeMode, SpecFieldType, SpecVersionStatus } from '@qltb/domain'
import type { NormalizeMode, SpecFieldType, SpecVersionStatus } from '@qltb/domain'
import type { ICatalogRepo } from './catalogs.js'

export interface CategorySpecVersionRecord {
    id: string
    categoryId: string
    version: number
    status: SpecVersionStatus
    createdBy?: string | null
    createdAt: Date
}

export interface CategorySpecDefRecord {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: SpecFieldType
    unit?: string | null
    required: boolean
    enumValues?: string[] | null
    pattern?: string | null
    minLen?: number | null
    maxLen?: number | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    precision?: number | null
    scale?: number | null
    normalize?: NormalizeMode | null
    defaultValue?: unknown
    helpText?: string | null
    sortOrder: number
    isActive: boolean
    isReadonly: boolean
    computedExpr?: string | null
    isSearchable: boolean
    isFilterable: boolean
    createdAt: Date
    updatedAt: Date
}

export interface CategorySpecDefInput {
    key: string
    label: string
    fieldType: SpecFieldType
    unit?: string | null
    required?: boolean
    enumValues?: string[] | null
    pattern?: string | null
    minLen?: number | null
    maxLen?: number | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    precision?: number | null
    scale?: number | null
    normalize?: NormalizeMode | null
    defaultValue?: unknown
    helpText?: string | null
    sortOrder?: number
    isActive?: boolean
    isReadonly?: boolean
    computedExpr?: string | null
    isSearchable?: boolean
    isFilterable?: boolean
}

export interface CategorySpecDefCreateInput extends CategorySpecDefInput {
    versionId: string
}

export type CategorySpecDefUpdatePatch = Partial<CategorySpecDefInput>

export interface CategorySpecTransactionContext {
    catalogs: ICatalogRepo
    specs: ICategorySpecRepo
    versions: ICategorySpecVersionRepo
}

export interface ICategorySpecVersionRepo {
    listByCategory(categoryId: string): Promise<CategorySpecVersionRecord[]>
    getActiveByCategory(categoryId: string): Promise<CategorySpecVersionRecord | null>
    getById(id: string): Promise<CategorySpecVersionRecord | null>
    getLatestVersionNumber(categoryId: string): Promise<number>
    create(categoryId: string, version: number, status: SpecVersionStatus, createdBy?: string | null): Promise<CategorySpecVersionRecord>
    updateStatus(id: string, status: SpecVersionStatus): Promise<CategorySpecVersionRecord | null>
    retireOtherActive(categoryId: string, keepId: string): Promise<number>
}

export interface ICategorySpecRepo {
    listByCategory(categoryId: string): Promise<CategorySpecDefRecord[]>
    listByVersion(versionId: string): Promise<CategorySpecDefRecord[]>
    bulkInsert(versionId: string, defs: CategorySpecDefInput[]): Promise<CategorySpecDefRecord[]>
    create(input: CategorySpecDefCreateInput): Promise<CategorySpecDefRecord>
    update(id: string, patch: CategorySpecDefUpdatePatch): Promise<CategorySpecDefRecord | null>
    softDelete(id: string): Promise<boolean>
    withTransaction<T>(handler: (context: CategorySpecTransactionContext) => Promise<T>): Promise<T>
}
