export type {
    CiStatus,
    Environment,
    CmdbFieldType,
    SpecVersionStatus,
    RelationshipStatus,
    RelationshipDirection,
    CmdbChangeRisk,
    CmdbChangeStatus,
} from '@qltb/domain'
import type {
    CiStatus,
    Environment,
    CmdbFieldType,
    SpecVersionStatus,
    RelationshipStatus,
    CmdbChangeRisk,
    CmdbChangeStatus
} from '@qltb/domain'

export interface CiTypeRecord {
    id: string
    code: string
    name: string
    description?: string | null
    createdAt: string
}

export interface CiTypeVersionRecord {
    id: string
    typeId: string
    version: number
    status: SpecVersionStatus
    createdBy?: string | null
    createdAt: string
}

export interface CiAttrDefRecord {
    id: string
    versionId: string
    key: string
    label: string
    fieldType: CmdbFieldType
    required: boolean
    unit?: string | null
    enumValues?: string[] | null
    pattern?: string | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    minLen?: number | null
    maxLen?: number | null
    defaultValue?: unknown
    isSearchable: boolean
    isFilterable: boolean
    sortOrder: number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface CiAttrDefInput {
    key: string
    label: string
    fieldType: CmdbFieldType
    required?: boolean
    unit?: string | null
    enumValues?: string[] | null
    pattern?: string | null
    minValue?: number | null
    maxValue?: number | null
    stepValue?: number | null
    minLen?: number | null
    maxLen?: number | null
    defaultValue?: unknown
    isSearchable?: boolean
    isFilterable?: boolean
    sortOrder?: number
    isActive?: boolean
}

export interface CiAttrDefCreateInput extends CiAttrDefInput {
    versionId: string
}

export type CiAttrDefUpdatePatch = Partial<CiAttrDefInput>

export interface CiRecord {
    id: string
    typeId: string
    name: string
    ciCode: string
    status: CiStatus
    environment: Environment
    assetId?: string | null
    locationId?: string | null
    ownerTeam?: string | null
    notes?: string | null
    createdAt: string
    updatedAt: string
}

export interface CiAttrValueRecord {
    id: string
    ciId: string
    versionId: string
    key: string
    value?: unknown
    updatedAt: string
}

export interface CiCreateInput {
    typeId: string
    name: string
    ciCode: string
    status?: CiStatus
    environment?: Environment
    assetId?: string | null
    locationId?: string | null
    ownerTeam?: string | null
    notes?: string | null
}

export interface CiUpdatePatch {
    name?: string
    status?: CiStatus
    environment?: Environment
    assetId?: string | null
    locationId?: string | null
    ownerTeam?: string | null
    notes?: string | null
}

export interface CiAttrValueInput {
    key: string
    value?: unknown
}

export interface RelationshipTypeRecord {
    id: string
    code: string
    name: string
    reverseName?: string | null
    allowedFromTypeId?: string | null
    allowedToTypeId?: string | null
}

export interface RelationshipRecord {
    id: string
    relTypeId: string
    fromCiId: string
    toCiId: string
    status: RelationshipStatus
    sinceDate?: string | null
    note?: string | null
    createdAt: string
}

export interface CmdbServiceRecord {
    id: string
    code: string
    name: string
    description?: string | null
    criticality?: string | null
    owner?: string | null
    sla?: string | null
    status?: string | null
    createdAt: string
}

export interface CmdbServiceMemberRecord {
    id: string
    serviceId: string
    ciId: string
    role?: string | null
    createdAt: string
}

export interface CiListFilters {
    q?: string
    status?: CiStatus
    environment?: Environment
    typeId?: string
    page?: number
    limit?: number
}

export interface CiPage {
    items: CiRecord[]
    total: number
    page: number
    limit: number
}

export interface RelationshipFilters {
    ciId: string
}

export interface CmdbServiceFilters {
    q?: string
    page?: number
    limit?: number
}

export interface CmdbServicePage {
    items: CmdbServiceRecord[]
    total: number
    page: number
    limit: number
}

export interface CmdbChangeRecord {
    id: string
    code: string
    title: string
    description?: string | null
    status: CmdbChangeStatus
    risk: CmdbChangeRisk
    primaryCiId?: string | null
    impactSnapshot?: unknown
    implementationPlan?: string | null
    rollbackPlan?: string | null
    plannedStartAt?: string | null
    plannedEndAt?: string | null
    requestedBy?: string | null
    approvedBy?: string | null
    implementedBy?: string | null
    implementedAt?: string | null
    closedAt?: string | null
    metadata?: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

export interface CmdbChangeCreateInput {
    title: string
    description?: string | null
    risk?: CmdbChangeRisk
    primaryCiId?: string | null
    implementationPlan?: string | null
    rollbackPlan?: string | null
    plannedStartAt?: string | null
    plannedEndAt?: string | null
    metadata?: Record<string, unknown> | null
    requestedBy?: string | null
}

export interface CmdbChangeUpdatePatch {
    title?: string
    description?: string | null
    risk?: CmdbChangeRisk
    primaryCiId?: string | null
    implementationPlan?: string | null
    rollbackPlan?: string | null
    plannedStartAt?: string | null
    plannedEndAt?: string | null
    status?: CmdbChangeStatus
    impactSnapshot?: unknown
    approvedBy?: string | null
    implementedBy?: string | null
    implementedAt?: string | null
    closedAt?: string | null
    metadata?: Record<string, unknown> | null
}

export interface CmdbChangeListFilters {
    q?: string
    status?: CmdbChangeStatus
    risk?: CmdbChangeRisk
    primaryCiId?: string
    page?: number
    limit?: number
}

export interface CmdbChangePage {
    items: CmdbChangeRecord[]
    total: number
    page: number
    limit: number
}

// ── Config Files ──────────────────────────────────────────────────────────────

export type CmdbConfigFileType = 'config' | 'script' | 'template' | 'env' | 'other'

export interface CmdbConfigFileRecord {
    id: string
    ciId: string
    ciName?: string | null       // populated in list queries (JOIN with cmdb_cis)
    name: string
    fileType: CmdbConfigFileType
    language?: string | null
    description?: string | null
    filePath?: string | null
    content: string
    currentVersion: number
    isActive: boolean
    createdBy?: string | null
    updatedBy?: string | null
    createdAt: string
    updatedAt: string
}

export interface CmdbConfigFileVersionRecord {
    id: string
    configFileId: string
    version: number
    content: string
    changeSummary?: string | null
    createdBy?: string | null
    createdAt: string
}

export interface CmdbConfigFileCreateInput {
    ciId: string
    name: string
    fileType?: CmdbConfigFileType
    language?: string | null
    description?: string | null
    filePath?: string | null
    content: string
    changeSummary?: string | null
    createdBy?: string | null
}

export interface CmdbConfigFileUpdatePatch {
    name?: string
    fileType?: CmdbConfigFileType
    language?: string | null
    description?: string | null
    filePath?: string | null
    content?: string
    changeSummary?: string | null
    updatedBy?: string | null
}

export interface CmdbConfigFileListFilters {
    ciId?: string
    fileType?: CmdbConfigFileType
    q?: string
    page?: number
    limit?: number
}

export interface CmdbConfigFilePage {
    items: CmdbConfigFileRecord[]
    total: number
    page: number
    limit: number
}
