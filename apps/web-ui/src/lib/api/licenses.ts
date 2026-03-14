import { API_BASE, apiJson } from './httpClient'
import { getAssetHeaders } from './assets'

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

type ApiResponse<T> = { data: T }

export async function getLicensesByAsset(assetId: string): Promise<ApiResponse<LicenseWithAssetSeat[]>> {
    return apiJson<ApiResponse<LicenseWithAssetSeat[]>>(
        `${API_BASE}/v1/licenses/asset/${assetId}`,
        { headers: getAssetHeaders() }
    )
}
