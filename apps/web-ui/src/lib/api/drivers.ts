import { API_BASE, apiJson, authorizedFetch, requireAccessToken } from './httpClient'

export type DriverDeviceType =
  | 'workstation'
  | 'laptop'
  | 'printer'
  | 'switch'
  | 'router'
  | 'server'
  | 'peripheral'
  | 'other'

export type DriverComponent =
  | 'chipset'
  | 'lan'
  | 'wifi'
  | 'gpu'
  | 'audio'
  | 'storage'
  | 'bios'
  | 'firmware'
  | 'other'

export type DriverOs = 'win10' | 'win11' | 'server2019' | 'server2022' | 'ubuntu' | 'debian' | 'rhel' | 'other'

export type DriverArch = 'x64' | 'arm64' | 'x86'

export type DriverSupportStatus = 'supported' | 'deprecated' | 'blocked'

export type DriverRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export type DriverFile = {
  storageKey: string
  filename: string
  size: number
  mime?: string | null
  sha256?: string | null
  sha1?: string | null
  signed: boolean
  signatureInfo?: Record<string, unknown> | null
}

export type DriverInstall = {
  silentInstallCmd?: string | null
  silentUninstallCmd?: string | null
  detectRules?: Record<string, unknown> | null
}

export type DriverApproval = {
  status: ApprovalStatus
  requestedBy?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  reason?: string | null
}

export type DriverPackage = {
  id: string
  parentId?: string | null
  vendor: string
  deviceType: DriverDeviceType
  model: string
  component: DriverComponent
  os: DriverOs
  osVersion?: string | null
  arch: DriverArch
  version: string
  releaseDate?: string | null
  supportStatus: DriverSupportStatus
  riskLevel: DriverRiskLevel
  compatibilityNotes?: string | null
  file?: DriverFile | null
  install?: DriverInstall | null
  approval: DriverApproval
  tags: string[]
  links?: {
    vendorUrl?: string | null
    releaseNotesUrl?: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export type DriverListQuery = {
  vendor?: string
  model?: string
  os?: DriverOs
  arch?: DriverArch
  component?: DriverComponent
  status?: ApprovalStatus
  supportStatus?: DriverSupportStatus
  riskLevel?: DriverRiskLevel
  tag?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: 'updatedAt' | 'releaseDate' | 'vendor' | 'model' | 'version'
}

export type DriverListResponse = {
  data: DriverPackage[]
  meta?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type CreateDriverInput = {
  parentId?: string
  vendor: string
  deviceType?: DriverDeviceType
  model: string
  component?: DriverComponent
  os?: DriverOs
  osVersion?: string
  arch?: DriverArch
  version: string
  releaseDate?: string
  supportStatus?: DriverSupportStatus
  riskLevel?: DriverRiskLevel
  compatibilityNotes?: string
  install?: DriverInstall
  tags?: string[]
  links?: {
    vendorUrl?: string | null
    releaseNotesUrl?: string | null
  }
}

export type UpdateDriverInput = Partial<CreateDriverInput>

export type ApprovalActionInput = {
  reason?: string
  note?: string
}

export type BulkDriversAction = 'tag/add' | 'tag/remove' | 'setRisk' | 'submitApproval' | 'block' | 'unblock' | 'delete'

export type BulkDriversInput = {
  action: BulkDriversAction
  ids: string[]
  tag?: string
  riskLevel?: DriverRiskLevel
  reason?: string
}

export type DriverRecommendation = {
  driver: DriverPackage
  score: number
  explain: string[]
}

export type DriverRecommendationsResponse = { data: DriverRecommendation[] }

export type UploadRequestResponse = {
  data: {
    storageKey: string
    uploadUrl: string
    method: 'PUT'
    expiresAt: string
  }
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

export async function listDrivers(params: DriverListQuery = {}): Promise<DriverListResponse> {
  const query = buildQuery({
    vendor: params.vendor,
    model: params.model,
    os: params.os,
    arch: params.arch,
    component: params.component,
    status: params.status,
    supportStatus: params.supportStatus,
    riskLevel: params.riskLevel,
    tag: params.tag,
    q: params.q,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort
  })
  return authJson<DriverListResponse>(`${API_BASE}/v1/drivers${query}`)
}

export async function createDriver(input: CreateDriverInput): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function getDriver(id: string): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}`)
  return payload.data
}

export async function updateDriver(id: string, patch: UpdateDriverInput): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  })
  return payload.data
}

export async function deleteDriver(id: string, reason?: string): Promise<void> {
  await authFetchOk(`${API_BASE}/v1/drivers/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  })
}

export async function submitDriverApproval(id: string): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}/submit-approval`, {
    method: 'POST'
  })
  return payload.data
}

export async function approveDriver(id: string, input: ApprovalActionInput): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function rejectDriver(id: string, input: ApprovalActionInput): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function blockDriver(id: string, reason: string): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  })
  return payload.data
}

export async function unblockDriver(id: string, reason: string): Promise<DriverPackage> {
  const payload = await authJson<{ data: DriverPackage }>(`${API_BASE}/v1/drivers/${id}/unblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  })
  return payload.data
}

export async function bulkDrivers(input: BulkDriversInput): Promise<{ updated: number }> {
  const payload = await authJson<{ data: { updated: number } }>(`${API_BASE}/v1/drivers/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  return payload.data
}

export async function uploadDriverFile(id: string, file: File): Promise<DriverPackage> {
  const form = new FormData()
  form.append('file', file)
  const response = await authFetchOk(`${API_BASE}/v1/drivers/${id}/upload`, {
    method: 'POST',
    body: form
  })
  const json = (await response.json()) as { data: DriverPackage }
  return json.data
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = /filename="?([^";]+)"?/i.exec(header)
  return match?.[1] ?? null
}

export async function downloadDriverFile(id: string): Promise<void> {
  const response = await authFetchOk(`${API_BASE}/v1/drivers/${id}/download`)
  const blob = await response.blob()
  const filename = parseFilenameFromContentDisposition(response.headers.get('content-disposition')) ?? `driver-${id}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function requestDriverUploadUrl(id: string, filename: string, mimeType?: string): Promise<UploadRequestResponse['data']> {
  const payload = await authJson<UploadRequestResponse>(`${API_BASE}/v1/drivers/${id}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, mimeType })
  })
  return payload.data
}

export async function recommendDrivers(params: { assetId?: string; vendor?: string; model?: string; os?: DriverOs; arch?: DriverArch; component?: DriverComponent } = {}): Promise<DriverRecommendation[]> {
  const query = buildQuery({
    assetId: params.assetId,
    vendor: params.vendor,
    model: params.model,
    os: params.os,
    arch: params.arch,
    component: params.component
  })
  const payload = await authJson<DriverRecommendationsResponse>(`${API_BASE}/v1/drivers/recommendations${query}`)
  return payload.data
}
