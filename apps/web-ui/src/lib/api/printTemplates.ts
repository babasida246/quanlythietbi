import { API_BASE, apiJsonData, requireAccessToken } from './httpClient'

export type DocumentTemplateVersionStatus = 'draft' | 'published' | 'archived'
export type DocumentTemplateDataSourceKind = 'none' | 'function' | 'procedure'

export type DocumentTemplateVersion = {
    id: string
    templateId: string
    versionNo: number
    title?: string
    htmlContent: string
    /** 'html' or 'docx' — added in migration 20260326_002 */
    templateFormat?: 'html' | 'docx'
    fields: string[]
    changeNote?: string
    status: DocumentTemplateVersionStatus
    createdBy?: string
    publishedBy?: string
    createdAt: string
    publishedAt?: string
}

export type DocumentTemplateSummary = {
    id: string
    templateCode: string
    name: string
    description?: string
    module: string
    dataSourceKind: DocumentTemplateDataSourceKind
    dataSourceName?: string
    organizationId?: string
    activeVersionId?: string
    isActive: boolean
    createdBy?: string
    updatedBy?: string
    createdAt: string
    updatedAt: string
    activeVersion?: DocumentTemplateVersion
    latestVersion?: DocumentTemplateVersion
}

export type ListDocumentTemplatesQuery = {
    page?: number
    limit?: number
    module?: string
    organizationId?: string
    isActive?: boolean
    includeVersions?: boolean
    search?: string
}

export type CreateDocumentTemplateInput = {
    name: string
    description?: string
    module?: string
    dataSourceKind?: DocumentTemplateDataSourceKind
    dataSourceName?: string
    htmlContent?: string
    fields?: string[]
    title?: string
    changeNote?: string
    organizationId?: string
}

export type UpdateDocumentTemplateInput = {
    name?: string
    description?: string
    module?: string
    dataSourceKind?: DocumentTemplateDataSourceKind
    dataSourceName?: string
    isActive?: boolean
}

export type CreateDocumentTemplateVersionInput = {
    title?: string
    htmlContent: string
    fields?: string[]
    changeNote?: string
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === '') continue
        search.set(key, String(value))
    }
    const query = search.toString()
    return query ? `?${query}` : ''
}

export async function listDocumentTemplates(query: ListDocumentTemplatesQuery = {}): Promise<DocumentTemplateSummary[]> {
    requireAccessToken()
    const qs = buildQuery({
        page: query.page,
        limit: query.limit,
        module: query.module,
        organizationId: query.organizationId,
        isActive: query.isActive,
        includeVersions: query.includeVersions,
        search: query.search,
    })
    return apiJsonData<DocumentTemplateSummary[]>(`${API_BASE}/v1/labels/document-templates${qs}`)
}

export type SuggestTemplatesResult = {
    templates: DocumentTemplateSummary[]
    defaultTemplateId: string | null
}

export async function suggestTemplates(docType: string): Promise<SuggestTemplatesResult> {
    const token = requireAccessToken()
    const qs = `?docType=${encodeURIComponent(docType)}`
    const res = await fetch(`${API_BASE}/v1/print/suggest-template${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return {
        templates: json.data ?? [],
        defaultTemplateId: json.meta?.defaultTemplateId ?? null
    }
}

export async function getDocumentTemplateById(id: string): Promise<DocumentTemplateSummary> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateSummary>(`${API_BASE}/v1/labels/document-templates/${id}`)
}

export async function getPublishedDocumentTemplateVersion(id: string): Promise<DocumentTemplateVersion> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateVersion>(`${API_BASE}/v1/labels/document-templates/${id}/published`)
}

export async function listDocumentTemplateVersions(id: string): Promise<DocumentTemplateVersion[]> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateVersion[]>(`${API_BASE}/v1/labels/document-templates/${id}/versions`)
}

export async function createDocumentTemplate(input: CreateDocumentTemplateInput): Promise<DocumentTemplateSummary> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateSummary>(`${API_BASE}/v1/labels/document-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })
}

export async function updateDocumentTemplate(id: string, input: UpdateDocumentTemplateInput): Promise<DocumentTemplateSummary> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateSummary>(`${API_BASE}/v1/labels/document-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })
}

export async function createDocumentTemplateVersion(
    id: string,
    input: CreateDocumentTemplateVersionInput,
): Promise<DocumentTemplateVersion> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateVersion>(`${API_BASE}/v1/labels/document-templates/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    })
}

export async function publishDocumentTemplateVersion(id: string, versionId: string): Promise<DocumentTemplateSummary> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateSummary>(`${API_BASE}/v1/labels/document-templates/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
    })
}

export async function deleteDocumentTemplate(id: string): Promise<void> {
    const token = requireAccessToken()
    const res = await fetch(`${API_BASE}/v1/labels/document-templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok && res.status !== 204) throw new Error(await res.text())
}

export async function rollbackDocumentTemplateVersion(
    id: string,
    versionId: string,
    changeNote?: string,
): Promise<DocumentTemplateSummary> {
    requireAccessToken()
    return apiJsonData<DocumentTemplateSummary>(`${API_BASE}/v1/labels/document-templates/${id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId, changeNote }),
    })
}

export async function upsertLabelSetting(key: string, value: string, updatedBy: string): Promise<void> {
    const token = requireAccessToken()
    const res = await fetch(`${API_BASE}/v1/labels/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settingValue: value, updatedBy }),
    })
    if (!res.ok) throw new Error(await res.text())
}

export async function getLabelSetting(key: string): Promise<string | null> {
    const token = requireAccessToken()
    const res = await fetch(`${API_BASE}/v1/labels/settings/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await res.text())
    const json = await res.json()
    return json.data?.value ?? null
}
