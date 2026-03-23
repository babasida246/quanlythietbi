import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders } from './assets'
import type {
    CiStatus, Environment, CmdbFieldType, SpecVersionStatus, CmdbChangeStatus, CmdbChangeRisk,
    CiTypeRecord, CiTypeVersionRecord, CiAttrDefRecord, CiRecord,
    RelationshipRecord, RelationshipTypeRecord,
    CmdbServiceRecord, CmdbServiceMemberRecord, CmdbChangeRecord,
    CmdbConfigFileRecord, CmdbConfigFileVersionRecord, CmdbConfigFileType
} from '@qltb/contracts'

export type { CiStatus, Environment, CmdbFieldType, SpecVersionStatus, CmdbChangeStatus, CmdbChangeRisk }
export type { CiRecord, RelationshipRecord, RelationshipTypeRecord, CmdbServiceRecord, CmdbChangeRecord }
export type { CmdbConfigFileRecord, CmdbConfigFileVersionRecord, CmdbConfigFileType }

// Aliases for legacy names used throughout the UI
export type CmdbType = CiTypeRecord
export type CmdbVersion = CiTypeVersionRecord
export type CmdbAttrDef = CiAttrDefRecord
export type CmdbServiceMember = CmdbServiceMemberRecord

export type CiDetail = {
    ci: CiRecord
    attributes: Array<{ key: string; value?: unknown }>
    schema: CmdbAttrDef[]
    version: CmdbVersion
}
export type CiGraph = { nodes: CiRecord[]; edges: RelationshipRecord[] }
export type CmdbRelationshipImportResult = {
    dryRun: boolean
    total: number
    created: RelationshipRecord[]
    errors: Array<{ index: number; message: string }>
}

type ApiResponse<T> = { data: T; meta?: { total?: number; page?: number; limit?: number; warnings?: unknown[]; defs?: CmdbAttrDef[] } }

export async function listCmdbTypes(): Promise<ApiResponse<CmdbType[]>> {
    return apiJson<ApiResponse<CmdbType[]>>(`${API_BASE}/v1/cmdb/types`, { headers: getAssetHeaders() })
}

export async function createCmdbType(input: { code: string; name: string; description?: string | null }): Promise<ApiResponse<CmdbType>> {
    return apiJson<ApiResponse<CmdbType>>(`${API_BASE}/v1/cmdb/types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateCmdbType(id: string, patch: Partial<{ code: string; name: string; description?: string | null }>): Promise<ApiResponse<CmdbType>> {
    return apiJson<ApiResponse<CmdbType>>(`${API_BASE}/v1/cmdb/types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteCmdbType(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/cmdb/types/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listTypeVersions(typeId: string): Promise<ApiResponse<CmdbVersion[]>> {
    return apiJson<ApiResponse<CmdbVersion[]>>(`${API_BASE}/v1/cmdb/types/${typeId}/versions`, { headers: getAssetHeaders() })
}

export async function createTypeDraftVersion(typeId: string): Promise<ApiResponse<{ version: CmdbVersion; defs?: CmdbAttrDef[] }>> {
    return apiJson<ApiResponse<{ version: CmdbVersion; defs?: CmdbAttrDef[] }>>(`${API_BASE}/v1/cmdb/types/${typeId}/versions`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function publishTypeVersion(versionId: string): Promise<ApiResponse<{ version: CmdbVersion; warnings?: unknown[] }>> {
    return apiJson<ApiResponse<{ version: CmdbVersion; warnings?: unknown[] }>>(`${API_BASE}/v1/cmdb/versions/${versionId}/publish`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export async function listAttrDefs(versionId: string): Promise<ApiResponse<CmdbAttrDef[]>> {
    return apiJson<ApiResponse<CmdbAttrDef[]>>(`${API_BASE}/v1/cmdb/versions/${versionId}/attr-defs`, { headers: getAssetHeaders() })
}

export async function createAttrDef(versionId: string, input: Partial<CmdbAttrDef> & { key: string; label: string; fieldType: string }): Promise<ApiResponse<CmdbAttrDef>> {
    return apiJson<ApiResponse<CmdbAttrDef>>(`${API_BASE}/v1/cmdb/versions/${versionId}/attr-defs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateAttrDef(id: string, patch: Partial<CmdbAttrDef>): Promise<ApiResponse<CmdbAttrDef>> {
    return apiJson<ApiResponse<CmdbAttrDef>>(`${API_BASE}/v1/cmdb/attr-defs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteAttrDef(id: string): Promise<ApiResponse<{ id: string }>> {
    return apiJson<ApiResponse<{ id: string }>>(`${API_BASE}/v1/cmdb/attr-defs/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listCis(params: { q?: string; status?: string; environment?: string; typeId?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<CiRecord[]>> {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.environment) query.set('environment', params.environment)
    if (params.typeId) query.set('typeId', params.typeId)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CiRecord[]>>(`${API_BASE}/v1/cmdb/cis${suffix}`, { headers: getAssetHeaders() })
}

export async function createCi(input: {
    typeId: string
    name: string
    ciCode: string
    status?: string
    environment?: string
    assetId?: string | null
    locationId?: string | null
    ownerTeam?: string | null
    notes?: string | null
    attributes?: Record<string, unknown>
}): Promise<ApiResponse<CiDetail>> {
    return apiJson<ApiResponse<CiDetail>>(`${API_BASE}/v1/cmdb/cis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function getCiDetail(id: string): Promise<ApiResponse<CiDetail>> {
    return apiJson<ApiResponse<CiDetail>>(`${API_BASE}/v1/cmdb/cis/${id}`, { headers: getAssetHeaders() })
}

export async function updateCi(id: string, patch: Partial<{
    typeId: string
    name: string
    status: string
    environment: string
    assetId: string | null
    locationId: string | null
    ownerTeam: string | null
    notes: string | null
    attributes: Record<string, unknown>
}>): Promise<ApiResponse<CiDetail>> {
    return apiJson<ApiResponse<CiDetail>>(`${API_BASE}/v1/cmdb/cis/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteCi(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/cmdb/cis/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function getCiGraph(id: string, params?: { depth?: number; direction?: 'upstream' | 'downstream' | 'both' }): Promise<ApiResponse<CiGraph>> {
    const query = new URLSearchParams()
    if (params?.depth) query.set('depth', String(params.depth))
    if (params?.direction) query.set('direction', params.direction)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CiGraph>>(`${API_BASE}/v1/cmdb/cis/${id}/graph${suffix}`, { headers: getAssetHeaders() })
}

export async function createRelationship(input: { relTypeId: string; fromCiId: string; toCiId: string; note?: string | null }): Promise<ApiResponse<RelationshipRecord>> {
    return apiJson<ApiResponse<RelationshipRecord>>(`${API_BASE}/v1/cmdb/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function importRelationships(input: {
    dryRun?: boolean
    allowCycles?: boolean
    items: Array<{ relTypeId: string; fromCiId: string; toCiId: string; sinceDate?: string | null; note?: string | null }>
}): Promise<ApiResponse<CmdbRelationshipImportResult>> {
    return apiJson<ApiResponse<CmdbRelationshipImportResult>>(`${API_BASE}/v1/cmdb/relationships/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function listRelationships(): Promise<ApiResponse<RelationshipRecord[]>> {
    const graph = await getCmdbGraph({ depth: 5, direction: 'both' })
    return { data: graph.data?.edges ?? [], meta: graph.meta }
}

export async function updateRelationship(
    id: string,
    input: { relTypeId: string; fromCiId: string; toCiId: string; note?: string | null }
): Promise<ApiResponse<RelationshipRecord>> {
    await deleteRelationship(id)
    return createRelationship(input)
}

export async function listRelationshipTypes(): Promise<ApiResponse<RelationshipTypeRecord[]>> {
    return apiJson<ApiResponse<RelationshipTypeRecord[]>>(`${API_BASE}/v1/cmdb/relationship-types`, {
        headers: getAssetHeaders()
    })
}

export async function createRelationshipType(input: { code: string; name: string; reverseName?: string | null; allowedFromTypeId?: string | null; allowedToTypeId?: string | null }): Promise<ApiResponse<RelationshipTypeRecord>> {
    return apiJson<ApiResponse<RelationshipTypeRecord>>(`${API_BASE}/v1/cmdb/relationship-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateRelationshipType(id: string, input: Partial<RelationshipTypeRecord>): Promise<ApiResponse<RelationshipTypeRecord>> {
    return apiJson<ApiResponse<RelationshipTypeRecord>>(`${API_BASE}/v1/cmdb/relationship-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function deleteRelationshipType(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/cmdb/relationship-types/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listCiRelationships(ciId: string): Promise<ApiResponse<RelationshipRecord[]>> {
    return apiJson<ApiResponse<RelationshipRecord[]>>(`${API_BASE}/v1/cmdb/cis/${ciId}/relationships`, { headers: getAssetHeaders() })
}

export async function createCiRelationship(ciId: string, input: {
    relTypeId: string;
    toCiId: string;
    status?: string;
    sinceDate?: string | null;
    note?: string | null;
}): Promise<ApiResponse<RelationshipRecord>> {
    return apiJson<ApiResponse<RelationshipRecord>>(`${API_BASE}/v1/cmdb/cis/${ciId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function deleteRelationship(relationshipId: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/cmdb/relationships/${relationshipId}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listServices(params: { q?: string; page?: number; limit?: number }): Promise<ApiResponse<CmdbServiceRecord[]>> {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CmdbServiceRecord[]>>(`${API_BASE}/v1/cmdb/services${suffix}`, { headers: getAssetHeaders() })
}

export async function createService(input: {
    code: string
    name: string
    description?: string | null
    criticality?: string | null
    owner?: string | null
    sla?: string | null
    status?: string | null
}): Promise<ApiResponse<CmdbServiceRecord>> {
    return apiJson<ApiResponse<CmdbServiceRecord>>(`${API_BASE}/v1/cmdb/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function getServiceDetail(id: string): Promise<ApiResponse<{ service: CmdbServiceRecord; members: CmdbServiceMember[] }>> {
    return apiJson<ApiResponse<{ service: CmdbServiceRecord; members: CmdbServiceMember[] }>>(`${API_BASE}/v1/cmdb/services/${id}`, { headers: getAssetHeaders() })
}

export async function updateService(id: string, patch: Partial<CmdbServiceRecord>): Promise<ApiResponse<CmdbServiceRecord>> {
    return apiJson<ApiResponse<CmdbServiceRecord>>(`${API_BASE}/v1/cmdb/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteService(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/cmdb/services/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function addServiceMember(id: string, input: { ciId: string; role?: string | null }): Promise<ApiResponse<CmdbServiceMember>> {
    return apiJson<ApiResponse<CmdbServiceMember>>(`${API_BASE}/v1/cmdb/services/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function removeServiceMember(serviceId: string, memberId: string): Promise<ApiResponse<{ memberId: string }>> {
    return apiJson<ApiResponse<{ memberId: string }>>(`${API_BASE}/v1/cmdb/services/${serviceId}/members/${memberId}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function getServiceImpact(serviceId: string, params?: { depth?: number; direction?: 'upstream' | 'downstream' | 'both' }): Promise<ApiResponse<CiGraph>> {
    const query = new URLSearchParams()
    if (params?.depth) query.set('depth', String(params.depth))
    if (params?.direction) query.set('direction', params.direction)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CiGraph>>(`${API_BASE}/v1/cmdb/services/${serviceId}/impact${suffix}`, { headers: getAssetHeaders() })
}

export async function getCmdbGraph(params?: { depth?: number; direction?: 'upstream' | 'downstream' | 'both' }): Promise<ApiResponse<CiGraph>> {
    const query = new URLSearchParams()
    if (params?.depth) query.set('depth', String(params.depth))
    if (params?.direction) query.set('direction', params.direction)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CiGraph>>(`${API_BASE}/v1/cmdb/graph${suffix}`, { headers: getAssetHeaders() })
}

export async function getCiDependencyPath(ciId: string, direction: 'upstream' | 'downstream' = 'downstream'): Promise<ApiResponse<{ path: CiRecord[]; chain: string[] }>> {
    return apiJson<ApiResponse<{ path: CiRecord[]; chain: string[] }>>(`${API_BASE}/v1/cmdb/cis/${ciId}/dependency-path?direction=${direction}`, { headers: getAssetHeaders() })
}

export async function getCiImpact(ciId: string): Promise<ApiResponse<{ affected: CiRecord[]; count: number; depth: number }>> {
    return apiJson<ApiResponse<{ affected: CiRecord[]; count: number; depth: number }>>(`${API_BASE}/v1/cmdb/cis/${ciId}/impact`, { headers: getAssetHeaders() })
}

export async function listCmdbChanges(params: {
    q?: string
    status?: CmdbChangeRecord['status']
    risk?: CmdbChangeRecord['risk']
    primaryCiId?: string
    page?: number
    limit?: number
} = {}): Promise<ApiResponse<CmdbChangeRecord[]>> {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.status) query.set('status', params.status)
    if (params.risk) query.set('risk', params.risk)
    if (params.primaryCiId) query.set('primaryCiId', params.primaryCiId)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CmdbChangeRecord[]>>(`${API_BASE}/v1/cmdb/changes${suffix}`, { headers: getAssetHeaders() })
}

export async function createCmdbChange(input: {
    title: string
    description?: string | null
    risk?: CmdbChangeRecord['risk']
    primaryCiId?: string | null
    implementationPlan?: string | null
    rollbackPlan?: string | null
    plannedStartAt?: string | null
    plannedEndAt?: string | null
    metadata?: Record<string, unknown> | null
}): Promise<ApiResponse<CmdbChangeRecord>> {
    return apiJson<ApiResponse<CmdbChangeRecord>>(`${API_BASE}/v1/cmdb/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function getCmdbChange(id: string): Promise<ApiResponse<CmdbChangeRecord>> {
    return apiJson<ApiResponse<CmdbChangeRecord>>(`${API_BASE}/v1/cmdb/changes/${id}`, { headers: getAssetHeaders() })
}

export async function updateCmdbChange(id: string, patch: Partial<{
    title: string
    description: string | null
    risk: CmdbChangeRecord['risk']
    primaryCiId: string | null
    implementationPlan: string | null
    rollbackPlan: string | null
    plannedStartAt: string | null
    plannedEndAt: string | null
    metadata: Record<string, unknown> | null
}>): Promise<ApiResponse<CmdbChangeRecord>> {
    return apiJson<ApiResponse<CmdbChangeRecord>>(`${API_BASE}/v1/cmdb/changes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

async function postCmdbChangeAction(id: string, action: 'submit' | 'approve' | 'implement' | 'close' | 'cancel'): Promise<ApiResponse<CmdbChangeRecord>> {
    return apiJson<ApiResponse<CmdbChangeRecord>>(`${API_BASE}/v1/cmdb/changes/${id}/${action}`, {
        method: 'POST',
        headers: getAssetHeaders()
    })
}

export const submitCmdbChange = (id: string) => postCmdbChangeAction(id, 'submit')
export const approveCmdbChange = (id: string) => postCmdbChangeAction(id, 'approve')
export const implementCmdbChange = (id: string) => postCmdbChangeAction(id, 'implement')
export const closeCmdbChange = (id: string) => postCmdbChangeAction(id, 'close')
export const cancelCmdbChange = (id: string) => postCmdbChangeAction(id, 'cancel')

// ── Config Files ──────────────────────────────────────────────────────────────

export type ConfigFileCreateInput = {
    ciId: string
    name: string
    fileType?: CmdbConfigFileType
    language?: string | null
    description?: string | null
    filePath?: string | null
    content: string
    changeSummary?: string | null
}

export type ConfigFileUpdateInput = {
    name?: string
    fileType?: CmdbConfigFileType
    language?: string | null
    description?: string | null
    filePath?: string | null
    content?: string
    changeSummary?: string | null
}

export async function listConfigFiles(params: {
    ciId?: string
    fileType?: CmdbConfigFileType
    q?: string
    page?: number
    limit?: number
} = {}): Promise<ApiResponse<CmdbConfigFileRecord[]>> {
    const query = new URLSearchParams()
    if (params.ciId) query.set('ciId', params.ciId)
    if (params.fileType) query.set('fileType', params.fileType)
    if (params.q) query.set('q', params.q)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return apiJson<ApiResponse<CmdbConfigFileRecord[]>>(`${API_BASE}/v1/cmdb/config-files${suffix}`, { headers: getAssetHeaders() })
}

export async function createConfigFile(input: ConfigFileCreateInput): Promise<ApiResponse<CmdbConfigFileRecord>> {
    return apiJson<ApiResponse<CmdbConfigFileRecord>>(`${API_BASE}/v1/cmdb/config-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function getConfigFile(id: string): Promise<ApiResponse<CmdbConfigFileRecord>> {
    return apiJson<ApiResponse<CmdbConfigFileRecord>>(`${API_BASE}/v1/cmdb/config-files/${id}`, { headers: getAssetHeaders() })
}

export async function updateConfigFile(id: string, patch: ConfigFileUpdateInput): Promise<ApiResponse<CmdbConfigFileRecord>> {
    return apiJson<ApiResponse<CmdbConfigFileRecord>>(`${API_BASE}/v1/cmdb/config-files/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(patch)
    })
}

export async function deleteConfigFile(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/cmdb/config-files/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function listConfigFileVersions(id: string): Promise<ApiResponse<CmdbConfigFileVersionRecord[]>> {
    return apiJson<ApiResponse<CmdbConfigFileVersionRecord[]>>(`${API_BASE}/v1/cmdb/config-files/${id}/versions`, { headers: getAssetHeaders() })
}

export async function getConfigFileVersion(id: string, version: number): Promise<ApiResponse<CmdbConfigFileVersionRecord>> {
    return apiJson<ApiResponse<CmdbConfigFileVersionRecord>>(`${API_BASE}/v1/cmdb/config-files/${id}/versions/${version}`, { headers: getAssetHeaders() })
}
