import { API_BASE } from './httpClient'

const SETUP_BASE = `${API_BASE}/setup`
const API_ROOT = API_BASE.replace(/\/api\/?$/, '')

export type SetupStatusResponse = {
    initialized: boolean
    version: string
    api: { ok: boolean; build?: string }
    db: { ok: boolean }
    migrations: { applied: number; pending: number; ok: boolean; total: number }
    seed: { ok: boolean; lastRunAt?: string }
    adminExists: boolean
}

export type SetupJobResponse = {
    id: string
    kind: 'migrate' | 'seed'
    status: 'running' | 'success' | 'failed'
    logs: string[]
    createdAt: string
    updatedAt: string
    result?: unknown
    error?: string
}

export type SetupJobStartResponse = {
    jobId: string
    status: 'running' | 'success' | 'failed'
}

export type SetupAdminPayload = {
    fullName: string
    email: string
    username?: string
    password: string
    locale?: 'vi' | 'en'
}

export type SetupAdminResult = {
    userId: string
    email: string
    username: string | null
    role: 'admin'
}

export type SetupFinalizePayload = {
    allowSkipSeed?: boolean
}

export type SetupFinalizeResult = {
    completedAt: string
    completedBy: string
    version: string
}

export type OrgInfoPayload = {
    name: string
    shortName: string
    address?: string
    phone?: string
    taxCode?: string
    website?: string
}

export type OrgInfoResult = {
    name: string
    shortName: string
    address?: string
    phone?: string
    taxCode?: string
    website?: string
}

export class SetupApiError extends Error {
    status: number
    details?: unknown

    constructor(message: string, status: number, details?: unknown) {
        super(message)
        this.name = 'SetupApiError'
        this.status = status
        this.details = details
    }
}

type ApiEnvelope<T> = {
    success?: boolean
    data?: T
    error?: {
        code?: string
        message?: string
        details?: unknown
    }
}

async function requestSetup<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${SETUP_BASE}${path}`, init)
    const text = await response.text()
    let payload: ApiEnvelope<T> | T | null = null

    if (text) {
        try {
            payload = JSON.parse(text) as ApiEnvelope<T> | T
        } catch {
            payload = null
        }
    }

    if (!response.ok) {
        const errorMessage =
            (payload as ApiEnvelope<T> | null)?.error?.message ??
            (typeof payload === 'string' ? payload : null) ??
            `HTTP ${response.status}`
        const details = (payload as ApiEnvelope<T> | null)?.error?.details
        throw new SetupApiError(errorMessage, response.status, details)
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data as T
    }
    return payload as T
}

export async function getSetupStatus(): Promise<SetupStatusResponse> {
    return requestSetup<SetupStatusResponse>('/status')
}

export async function runSetupMigrate(): Promise<SetupJobStartResponse> {
    return requestSetup<SetupJobStartResponse>('/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    })
}

export async function runSetupSeed(): Promise<SetupJobStartResponse> {
    return requestSetup<SetupJobStartResponse>('/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    })
}

export async function getSetupJob(jobId: string): Promise<SetupJobResponse> {
    return requestSetup<SetupJobResponse>(`/jobs/${jobId}`)
}

export async function createSetupAdmin(payload: SetupAdminPayload): Promise<SetupAdminResult> {
    return requestSetup<SetupAdminResult>('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
}

export async function finalizeSetup(payload: SetupFinalizePayload = {}): Promise<SetupFinalizeResult> {
    return requestSetup<SetupFinalizeResult>('/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
}

export async function getApiHealth(): Promise<{ ok: boolean; raw?: unknown }> {
    try {
        const response = await fetch(`${API_ROOT}/health`)
        if (!response.ok) {
            return { ok: false }
        }
        const payload = await response.json()
        return { ok: true, raw: payload }
    } catch {
        return { ok: false }
    }
}

export async function saveSetupOrgInfo(payload: OrgInfoPayload): Promise<OrgInfoResult> {
    return requestSetup<OrgInfoResult>('/org-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
}

export async function getSetupOrgInfo(): Promise<OrgInfoResult | null> {
    return requestSetup<OrgInfoResult | null>('/org')
}
