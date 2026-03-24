import { API_BASE, requireAccessToken } from './httpClient'

export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'double_declining' | 'sum_of_years' | 'units_of_production'
export type ScheduleStatus = 'active' | 'fully_depreciated' | 'stopped'
export type RunType = 'monthly' | 'adjustment' | 'closing'
export type RunStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DepreciationSchedule {
    id: string
    assetId: string
    depreciationMethod: DepreciationMethod
    originalCost: number
    salvageValue: number
    usefulLifeYears: number
    startDate: string
    endDate: string
    status: ScheduleStatus
    accumulatedDepreciation: number
    stoppedAt: string | null
    stoppedReason: string | null
    notes: string | null
    organizationId: string | null
    createdBy: string
    updatedBy: string | null
    createdAt: string
    updatedAt: string
    // With details
    assetTag?: string
    assetName?: string
    assetSerialNumber?: string
    categoryId?: string
    categoryName?: string
    currentBookValue?: number
    depreciationProgressPercent?: number
    monthlyDepreciation?: number
    remainingMonths?: number
}

export interface DepreciationEntry {
    id: string
    scheduleId: string
    runId: string | null
    periodYear: number
    periodMonth: number
    depreciationAmount: number
    beginningBookValue: number
    endingBookValue: number
    isPosted: boolean
    postedAt: string | null
    postedBy: string | null
    isAdjustment: boolean
    adjustmentReason: string | null
    createdAt: string
    updatedAt: string
    createdBy: string
    // With details
    assetId?: string
    assetTag?: string
    assetName?: string
    runCode?: string | null
    postedByName?: string | null
}

export interface DepreciationRun {
    id: string
    runCode: string
    runType: RunType
    periodYear: number
    periodMonth: number
    status: RunStatus
    totalAssets: number
    totalAmount: number
    errorMessage: string | null
    completedAt: string | null
    organizationId: string | null
    createdAt: string
    updatedAt: string
    createdBy: string
}

export interface DepreciationDashboard {
    activeSchedules: number
    fullyDepreciated: number
    stoppedSchedules: number
    totalOriginalCost: number
    totalAccumulatedDepreciation: number
    totalBookValue: number
    pendingEntriesCount: number
    thisMonthDepreciation: number
    endingSoonCount: number
}

export interface SchedulePreviewEntry {
    periodYear: number
    periodMonth: number
    depreciationAmount: number
    accumulatedDepreciation: number
    bookValue: number
}

export interface SchedulePreview {
    originalCost: number
    salvageValue: number
    depreciableAmount: number
    usefulLifeYears: number
    totalMonths: number
    monthlyDepreciation: number
    entries: SchedulePreviewEntry[]
}

export interface CreateScheduleInput {
    assetId: string
    depreciationMethod: DepreciationMethod
    originalCost: number
    salvageValue?: number
    usefulLifeYears: number
    startDate: string
    notes?: string
    organizationId?: string
}

export interface ScheduleListQuery {
    page?: number
    limit?: number
    search?: string
    status?: ScheduleStatus
    method?: DepreciationMethod
    endingSoon?: boolean
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = requireAccessToken()
    const res = await fetch(`${API_BASE}/v1${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers ?? {})
        }
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export async function listSchedules(query?: ScheduleListQuery): Promise<{ data: DepreciationSchedule[]; total: number }> {
    const qs = new URLSearchParams()
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
        }
    }
    const resp = await apiFetch<{ data: DepreciationSchedule[]; total: number; meta?: { total: number } }>(
        `/depreciation/schedules${qs.toString() ? '?' + qs : ''}`
    )
    return { data: resp.data ?? [], total: resp.total ?? resp.meta?.total ?? 0 }
}

export async function getScheduleByAsset(assetId: string): Promise<DepreciationSchedule | null> {
    try {
        const resp = await apiFetch<{ data: DepreciationSchedule }>(`/depreciation/assets/${assetId}/schedule`)
        return resp.data ?? null
    } catch {
        return null
    }
}

export async function createSchedule(input: CreateScheduleInput): Promise<DepreciationSchedule> {
    const resp = await apiFetch<{ data: DepreciationSchedule; schedule?: DepreciationSchedule }>('/depreciation/schedules', {
        method: 'POST',
        body: JSON.stringify(input)
    })
    return resp.data ?? (resp as unknown as { schedule: DepreciationSchedule }).schedule
}

export async function stopSchedule(scheduleId: string, stoppedReason?: string): Promise<DepreciationSchedule> {
    const resp = await apiFetch<{ data: DepreciationSchedule }>(`/depreciation/schedules/${scheduleId}/stop`, {
        method: 'POST',
        body: JSON.stringify({ stoppedReason, stoppedAt: new Date().toISOString() })
    })
    return resp.data
}

export async function previewSchedule(params: {
    depreciationMethod: DepreciationMethod
    originalCost: number
    salvageValue?: number
    usefulLifeYears: number
    startDate: string
}): Promise<SchedulePreview> {
    const resp = await apiFetch<{ data: SchedulePreview }>('/depreciation/schedules/preview', {
        method: 'POST',
        body: JSON.stringify(params)
    })
    return resp.data
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function listEntriesBySchedule(scheduleId: string): Promise<DepreciationEntry[]> {
    const resp = await apiFetch<{ data: DepreciationEntry[] }>(`/depreciation/schedules/${scheduleId}/entries`)
    return resp.data ?? []
}

export async function getPendingEntries(): Promise<DepreciationEntry[]> {
    const resp = await apiFetch<{ data: DepreciationEntry[] }>('/depreciation/entries/pending')
    return resp.data ?? []
}

export async function postEntries(entryIds: string[]): Promise<{ postedCount: number }> {
    const resp = await apiFetch<{ data: { postedCount: number } }>('/depreciation/entries/post', {
        method: 'POST',
        body: JSON.stringify({ entryIds })
    })
    return resp.data
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function runMonthlyDepreciation(periodYear: number, periodMonth: number): Promise<DepreciationRun> {
    const resp = await apiFetch<{ data: DepreciationRun; run?: DepreciationRun }>('/depreciation/runs', {
        method: 'POST',
        body: JSON.stringify({ periodYear, periodMonth, runType: 'monthly' })
    })
    return resp.data ?? (resp as unknown as { run: DepreciationRun }).run
}

// ── Runs list ─────────────────────────────────────────────────────────────────

export interface RunListQuery {
    page?: number
    limit?: number
    periodYear?: number
    status?: RunStatus
}

export async function listRuns(query?: RunListQuery): Promise<{ data: DepreciationRun[]; total: number }> {
    const qs = new URLSearchParams()
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
        }
    }
    const resp = await apiFetch<{ data: DepreciationRun[]; total: number; meta?: { total: number } }>(
        `/depreciation/runs${qs.toString() ? '?' + qs : ''}`
    )
    return { data: resp.data ?? [], total: resp.total ?? resp.meta?.total ?? 0 }
}

// ── Entries list ──────────────────────────────────────────────────────────────

export interface EntryListQuery {
    page?: number
    limit?: number
    scheduleId?: string
    assetId?: string
    isPosted?: boolean
    periodYear?: number
    periodMonth?: number
}

export async function listEntries(query?: EntryListQuery): Promise<{ data: DepreciationEntry[]; total: number }> {
    const qs = new URLSearchParams()
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
        }
    }
    const resp = await apiFetch<{ data: DepreciationEntry[]; total: number; meta?: { total: number } }>(
        `/depreciation/entries${qs.toString() ? '?' + qs : ''}`
    )
    return { data: resp.data ?? [], total: resp.total ?? resp.meta?.total ?? 0 }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDepreciationDashboard(): Promise<DepreciationDashboard> {
    const resp = await apiFetch<{ data: DepreciationDashboard }>('/depreciation/dashboard')
    return resp.data
}
