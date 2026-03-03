import { API_BASE, apiJson, authorizedFetch, requireAccessToken } from './httpClient'

export type DocumentType = 'sop' | 'howto' | 'policy' | 'template' | 'diagram' | 'report' | 'certificate' | 'other'

export type DocumentContentType = 'file' | 'markdown' | 'link'

export type DocumentVisibility = 'private' | 'team' | 'department' | 'org'

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type DocumentFile = {
  id: string
  storageKey: string
  filename: string
  sha256?: string | null
  size?: number | null
  mime?: string | null
  createdAt?: string
}

export type DocumentScope = {
  relatedAssets: string[]
  relatedModels: Array<{ vendor: string; model: string }>
  relatedSites: string[]
  relatedServices: string[]
}

export type DocumentApproval = {
  status: ApprovalStatus
  requestedBy?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  reason?: string | null
}

export type Document = {
  id: string
  parentId?: string | null
  type: DocumentType
  title: string
  summary?: string | null
  contentType: DocumentContentType
  markdown?: string | null
  externalUrl?: string | null
  files: DocumentFile[]
  scope: DocumentScope
  version: string
  visibility: DocumentVisibility
  approval: DocumentApproval
  tags: string[]
  createdBy?: string | null
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

export type DocumentListQuery = {
  type?: DocumentType
  tag?: string
  visibility?: DocumentVisibility
  status?: ApprovalStatus
  q?: string
  relatedAssetId?: string
  relatedModel?: string
  page?: number
  pageSize?: number
  sort?: 'updatedAt' | 'title' | 'type'
}

export type DocumentListResponse = {
  data: Document[]
  meta?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type CreateDocumentInput = {
  parentId?: string
  type?: DocumentType
  title: string
  summary?: string
  contentType?: DocumentContentType
  markdown?: string
  externalUrl?: string
  version?: string
  visibility?: DocumentVisibility
  tags?: string[]
  scope?: Partial<DocumentScope>
}

export type UpdateDocumentInput = Partial<CreateDocumentInput>

export type ApprovalActionInput = {
  reason?: string
  note?: string
}

export type BulkDocumentsAction = 'tag/add' | 'tag/remove' | 'setVisibility' | 'submitApproval' | 'delete'

export type BulkDocumentsInput = {
  action: BulkDocumentsAction
  ids: string[]
  tag?: string
  visibility?: DocumentVisibility
  reason?: string
}

const authJson = <T>(input: string, init?: RequestInit) => {
  requireAccessToken()
  return apiJson<T>(input, init)
}

async function authFetchOk(input: string, init?: RequestInit): Promise<Response> {
  requireAccessToken()
  const response = await authorizedFetch(input, init)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }
  return response
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function listDocuments(params: DocumentListQuery = {}): Promise<DocumentListResponse> {
  const query = buildQuery({
    type: params.type,
    tag: params.tag,
    visibility: params.visibility,
    status: params.status,
    q: params.q,
    relatedAssetId: params.relatedAssetId,
    relatedModel: params.relatedModel,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort
  })
  return authJson<DocumentListResponse>(`${API_BASE}/v1/docs${query}`)
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const payload = await authJson<{ data: Document }>(`${API_BASE}/v1/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function getDocument(id: string): Promise<Document> {
  const payload = await authJson<{ data: Document }>(`${API_BASE}/v1/docs/${id}`)
  return payload.data
}

export async function updateDocument(id: string, patch: UpdateDocumentInput): Promise<Document> {
  const payload = await authJson<{ data: Document }>(`${API_BASE}/v1/docs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  })
  return payload.data
}

export async function deleteDocument(id: string, reason?: string): Promise<void> {
  await authFetchOk(`${API_BASE}/v1/docs/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  })
}

export async function submitDocumentApproval(id: string): Promise<Document> {
  const payload = await authJson<{ data: Document }>(`${API_BASE}/v1/docs/${id}/submit-approval`, {
    method: 'POST'
  })
  return payload.data
}

export async function approveDocument(id: string, input: ApprovalActionInput): Promise<Document> {
  const payload = await authJson<{ data: Document }>(`${API_BASE}/v1/docs/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function rejectDocument(id: string, input: ApprovalActionInput): Promise<Document> {
  const payload = await authJson<{ data: Document }>(`${API_BASE}/v1/docs/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function bulkDocuments(input: BulkDocumentsInput): Promise<{ updated: number }> {
  const payload = await authJson<{ data: { updated: number } }>(`${API_BASE}/v1/docs/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function uploadDocumentFile(id: string, file: File): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  const response = await authFetchOk(`${API_BASE}/v1/docs/${id}/upload`, {
    method: 'POST',
    body: form
  })
  const json = (await response.json()) as { data: Document }
  return json.data
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = /filename="?([^";]+)"?/i.exec(header)
  return match?.[1] ?? null
}

export async function downloadDocumentFile(documentId: string, fileId: string): Promise<void> {
  const response = await authFetchOk(`${API_BASE}/v1/docs/${documentId}/download/${fileId}`)
  const blob = await response.blob()
  const filename =
    parseFilenameFromContentDisposition(response.headers.get('content-disposition')) ?? `document-${documentId}-${fileId}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
