import { API_BASE, requireAccessToken } from './httpClient'

export interface AutoMapResponse {
    mappings: Record<string, unknown>
    detectedFields: Array<{ fieldName: string; value: unknown; format?: string }>
    confidence: number
}

export interface RenderResponse {
    html: string
}

export interface ExportResponse {
    format: string
    content: string
    mimeType: string
    fileName?: string
    message?: string
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireAccessToken()}`
    }
}

/**
 * Auto-map fields from source data to template placeholders
 */
export async function autoMapFields(
    docType: string,
    sourceData: Record<string, unknown>,
    templateFieldNames: string[]
) {
    const response = await fetch(`${API_BASE}/v1/print/auto-map-fields`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ docType, sourceData, templateFieldNames })
    })

    if (!response.ok) throw new Error('Auto-mapping failed')
    return (await response.json()) as { success: boolean; data: AutoMapResponse }
}

/**
 * Render template HTML with field mappings
 */
export async function renderTemplate(
    htmlContent: string,
    fieldMappings: Record<string, unknown>
) {
    const response = await fetch(`${API_BASE}/v1/print/render`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ htmlContent, fieldMappings })
    })

    if (!response.ok) throw new Error('Render failed')
    return (await response.json()) as { success: boolean; data: RenderResponse }
}

/**
 * Export rendered template to file (PDF, Excel, etc)
 */
export async function exportFile(
    htmlContent: string,
    fieldMappings: Record<string, unknown>,
    format: 'pdf' | 'excel' | 'csv' | 'word' | 'json',
    options?: Record<string, unknown>
) {
    const response = await fetch(`${API_BASE}/v1/print/export-file`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ htmlContent, fieldMappings, format, options })
    })

    if (!response.ok) throw new Error(`Export to ${format} failed`)
    return (await response.json()) as { success: boolean; data: ExportResponse }
}

/**
 * Download file from response blob
 */
export async function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
