/**
 * Security & Compliance API Client
 */
import { API_BASE, apiJson, authorizedFetch } from './httpClient'
import { getAssetHeaders, buildQuery } from './assets'

type ApiResponse<T> = { data: T; meta?: Record<string, unknown> }

export type Permission = {
    id: string
    code: string
    name: string
    description: string | null
    module: string
    action: string
}

export type AuditLog = {
    id: string
    userId: string
    action: string
    entityType: string
    entityId: string | null
    details: Record<string, unknown>
    ipAddress: string | null
    riskLevel: string
    createdAt: string
}

export type ComplianceFramework = {
    id: string
    code: string
    name: string
    version: string
    description: string | null
    isActive: boolean
    createdAt: string
}

export type ComplianceControl = {
    id: string
    frameworkId: string
    controlCode: string
    name: string
    description: string | null
    category: string | null
    severity: string
    createdAt: string
}

export type ComplianceAssessment = {
    id: string
    controlId: string
    assetId: string | null
    status: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed'
    evidence: string | null
    assessedBy: string
    assessedAt: string
    notes: string | null
    nextReviewDate: string | null
}

export type ComplianceSummary = {
    totalControls: number
    compliant: number
    nonCompliant: number
    partial: number
    notAssessed: number
    complianceRate: number
}

// Permissions
export async function listPermissions(): Promise<ApiResponse<Permission[]>> {
    return apiJson(`${API_BASE}/v1/security/permissions`, { headers: getAssetHeaders() })
}

export async function getRolePermissions(roleId: string): Promise<ApiResponse<Permission[]>> {
    return apiJson(`${API_BASE}/v1/security/roles/${roleId}/permissions`, { headers: getAssetHeaders() })
}

export async function assignPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await authorizedFetch(`${API_BASE}/v1/security/roles/${roleId}/permissions`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds })
    })
}

// Audit Logs
export async function getAuditLogs(params: {
    userId?: string
    action?: string
    entityType?: string
    riskLevel?: string
    limit?: number
    offset?: number
} = {}): Promise<ApiResponse<AuditLog[]>> {
    const query = buildQuery(params as Record<string, string | number | undefined>)
    return apiJson(`${API_BASE}/v1/security/audit-logs${query}`, { headers: getAssetHeaders() })
}

// Compliance Frameworks
export async function listFrameworks(): Promise<ApiResponse<ComplianceFramework[]>> {
    return apiJson(`${API_BASE}/v1/security/compliance/frameworks`, { headers: getAssetHeaders() })
}

export async function createFramework(input: Partial<ComplianceFramework>): Promise<ApiResponse<ComplianceFramework>> {
    return apiJson(`${API_BASE}/v1/security/compliance/frameworks`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

// Controls
export async function listControls(frameworkId: string): Promise<ApiResponse<ComplianceControl[]>> {
    return apiJson(`${API_BASE}/v1/security/compliance/frameworks/${frameworkId}/controls`, { headers: getAssetHeaders() })
}

export async function createControl(frameworkId: string, input: Partial<ComplianceControl>): Promise<ApiResponse<ComplianceControl>> {
    return apiJson(`${API_BASE}/v1/security/compliance/frameworks/${frameworkId}/controls`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

// Assessments
export async function listAssessments(params: { frameworkId?: string; status?: string } = {}): Promise<ApiResponse<ComplianceAssessment[]>> {
    const query = buildQuery(params)
    return apiJson(`${API_BASE}/v1/security/compliance/assessments${query}`, { headers: getAssetHeaders() })
}

export async function createAssessment(input: Partial<ComplianceAssessment>): Promise<ApiResponse<ComplianceAssessment>> {
    return apiJson(`${API_BASE}/v1/security/compliance/assessments`, {
        method: 'POST',
        headers: { ...getAssetHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })
}

// Summary
export async function getComplianceSummary(): Promise<ApiResponse<ComplianceSummary>> {
    return apiJson(`${API_BASE}/v1/security/compliance/summary`, { headers: getAssetHeaders() })
}
