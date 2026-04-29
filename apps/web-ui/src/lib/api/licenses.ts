import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders, buildQuery } from './assets'

export type LicenseStatus = 'draft' | 'active' | 'expired' | 'retired'
export type LicenseType = 'per_seat' | 'per_device' | 'per_user' | 'site_license' | 'unlimited'

export type LicenseWithAssetSeat = {
    licenseId: string
    licenseCode: string
    softwareName: string
    licenseType: LicenseType
    status: LicenseStatus
    expiryDate?: string | null
    seatId: string
    assignedAt: string
    assignedBy: string
    notes?: string | null
}

export type LicenseWithUsage = {
    id: string
    licenseCode: string
    softwareName: string
    supplierId?: string | null
    categoryId?: string | null
    licenseType: LicenseType
    seatCount: number
    unitPrice: number
    currency: string
    purchaseDate?: string | null
    expiryDate?: string | null
    warrantyDate?: string | null
    invoiceNumber?: string | null
    notes?: string | null
    status: LicenseStatus
    seatsUsed: number
    seatsAvailable: number
    usagePercentage: number
    supplierName?: string | null
    categoryName?: string | null
    createdAt: string
    updatedAt: string
}

export type LicenseSeatWithDetails = {
    id: string
    licenseId: string
    assignmentType: 'user' | 'asset'
    assignedUserId?: string | null
    assignedAssetId?: string | null
    assetCode?: string | null
    assetName?: string | null
    userEmail?: string | null
    userName?: string | null
    assignedAt: string
    assignedBy: string
    notes?: string | null
}

export type CreateLicenseInput = {
    softwareName: string
    licenseCode?: string
    licenseType?: LicenseType
    seatCount?: number
    unitPrice?: number
    currency?: string
    purchaseDate?: string
    expiryDate?: string
    notes?: string
}

type ApiResponse<T> = { data: T }
type PaginatedResponse<T> = { data: T[]; total: number; page: number; limit: number }

export async function getLicensesByAsset(assetId: string): Promise<ApiResponse<LicenseWithAssetSeat[]>> {
    return apiJson<ApiResponse<LicenseWithAssetSeat[]>>(
        `${API_BASE}/v1/licenses/asset/${assetId}`,
        { headers: getAssetHeaders() }
    )
}

export async function listLicenses(params: {
    page?: number
    limit?: number
    status?: string
    search?: string
} = {}): Promise<PaginatedResponse<LicenseWithUsage>> {
    const qs = buildQuery(params as Record<string, string | number | undefined>)
    return apiJson<PaginatedResponse<LicenseWithUsage>>(
        `${API_BASE}/v1/licenses${qs}`,
        { headers: getAssetHeaders() }
    )
}

export async function createLicense(input: CreateLicenseInput): Promise<LicenseWithUsage> {
    return apiJson<LicenseWithUsage>(`${API_BASE}/v1/licenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function updateLicense(id: string, input: Partial<CreateLicenseInput>): Promise<LicenseWithUsage> {
    return apiJson<LicenseWithUsage>(`${API_BASE}/v1/licenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function deleteLicense(id: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/licenses/${id}`, {
        method: 'DELETE',
        headers: getAssetHeaders()
    })
}

export async function activateLicense(id: string): Promise<LicenseWithUsage> {
    return apiJson<LicenseWithUsage>(`${API_BASE}/v1/licenses/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({})
    })
}

export async function retireLicense(id: string): Promise<LicenseWithUsage> {
    return apiJson<LicenseWithUsage>(`${API_BASE}/v1/licenses/${id}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({})
    })
}

export async function getSeats(licenseId: string): Promise<{ data: LicenseSeatWithDetails[]; total: number }> {
    return apiJson<{ data: LicenseSeatWithDetails[]; total: number }>(
        `${API_BASE}/v1/licenses/${licenseId}/seats`,
        { headers: getAssetHeaders() }
    )
}

export async function assignSeat(licenseId: string, input: {
    assignmentType: 'user' | 'asset'
    assignedUserId?: string
    assignedAssetId?: string
    notes?: string
}): Promise<LicenseSeatWithDetails> {
    return apiJson<LicenseSeatWithDetails>(`${API_BASE}/v1/licenses/${licenseId}/seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify(input)
    })
}

export async function revokeSeat(licenseId: string, seatId: string): Promise<void> {
    await apiJson<void>(`${API_BASE}/v1/licenses/${licenseId}/seats/${seatId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAssetHeaders() },
        body: JSON.stringify({})
    })
}
