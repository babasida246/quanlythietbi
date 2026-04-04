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
    format: 'pdf' | 'excel' | 'csv' | 'docx' | 'json',
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

export type BuiltinPrintType =
    | 'phieu-nhap-kho'
    | 'phieu-xuat-kho'
    | 'bien-ban-ban-giao'
    | 'bien-ban-luan-chuyen'
    | 'bien-ban-thu-hoi'
    | 'lenh-sua-chua'
    | 'bien-ban-kiem-ke'
    | 'phieu-muon'
    | 'bien-ban-thanh-ly'
    | 'yeu-cau-mua-sam'
    | 'bao-cao-tai-san'

export interface RenderDocxResponse {
    content: string   // base64-encoded .docx
    mimeType: string
    fileName: string
}

/**
 * Render a .docx template (docxtemplater) with data.
 * The template must have been uploaded via POST /labels/document-templates/:id/versions/upload-docx.
 *
 * Template loop syntax for table rows (author writes in Word):
 *   {#lines}{i} | {partCode} | {partName} | {qty} | {unitCost} | {total}{/lines}
 *
 * @param templateId  - UUID of the document_templates row
 * @param versionId   - UUID of the document_template_versions row (must be a docx version)
 * @param data        - Data object whose keys match {placeholders} in the template
 * @param fileName    - Suggested download filename (without .docx extension)
 */
export async function renderDocx(
    templateId: string,
    versionId: string,
    data: Record<string, unknown>,
    fileName?: string
): Promise<{ success: boolean; data: RenderDocxResponse }> {
    const response = await fetch(`${API_BASE}/v1/print/render-docx`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ templateId, versionId, data, fileName })
    })
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: 'DOCX render failed' } }))
        throw new Error(err?.error?.message ?? 'DOCX render failed')
    }
    return response.json()
}

/**
 * Trigger a browser download for a base64-encoded .docx received from renderDocx().
 */
/**
 * Render một mẫu in có sẵn (built-in .docx) với dữ liệu.
 * Template được lưu tại apps/api/src/templates/docx/*.docx
 *
 * Luôn đưa orgInfo vào data:
 *   data.orgName, data.orgAddress, data.orgPhone, data.orgTaxCode
 *   data.sigDate  – ngày hiển thị ở cuối phiếu, vd: "Ngày 26 tháng 03 năm 2026"
 */
export async function renderBuiltinDocx(
    printType: BuiltinPrintType,
    data: Record<string, unknown>,
    fileName?: string
): Promise<{ success: boolean; data: RenderDocxResponse }> {
    const response = await fetch(`${API_BASE}/v1/print/render-builtin-docx`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ printType, data, fileName })
    })
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: 'Render failed' } }))
        throw new Error(err?.error?.message ?? 'Render built-in DOCX failed')
    }
    return response.json()
}

export function downloadDocxFromBase64(base64: string, fileName: string) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })
    downloadFile(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`)
}

/**
 * Upload a .docx template file as a new draft version of a document template.
 * Returns the created DocumentTemplateVersion.
 */
export async function uploadDocxTemplateVersion(
    templateId: string,
    file: File,
    options?: { title?: string; changeNote?: string }
): Promise<{ success: boolean; data: unknown }> {
    const token = requireAccessToken()
    const form = new FormData()
    form.append('file', file)
    if (options?.title) form.append('title', options.title)
    if (options?.changeNote) form.append('changeNote', options.changeNote)

    const response = await fetch(`${API_BASE}/v1/labels/document-templates/${templateId}/versions/upload-docx`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },  // no Content-Type — browser sets multipart boundary
        body: form
    })
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: { message: 'Upload failed' } }))
        throw new Error(err?.error?.message ?? 'Upload failed')
    }
    return response.json()
}
