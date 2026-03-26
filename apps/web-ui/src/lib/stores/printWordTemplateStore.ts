import { writable } from 'svelte/store'
import mammoth from 'mammoth'
import {
    createDocumentTemplate,
    createDocumentTemplateVersion,
    getDocumentTemplateById,
    listDocumentTemplateVersions,
    listDocumentTemplates,
    publishDocumentTemplateVersion,
    rollbackDocumentTemplateVersion,
    updateDocumentTemplate,
    type DocumentTemplateSummary,
    type DocumentTemplateVersion,
} from '$lib/api/printTemplates'

export type PrintWordTemplate = {
    id: string
    name: string
    html: string
    fields: string[]
    sourceFileName?: string
    createdAt: string
    updatedAt: string
}

type PrintWordTemplateStoreState = {
    templates: PrintWordTemplate[]
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function extractFieldsFromContent(content: string): string[] {
    const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g
    const fields: string[] = []

    let match: RegExpExecArray | null = regex.exec(content)
    while (match) {
        fields.push(match[1])
        match = regex.exec(content)
    }

    return uniqueSorted(fields)
}

export function extractTemplateFields(html: string): string[] {
    const htmlFields = extractFieldsFromContent(html)
    const plainText = html.replace(/<[^>]+>/g, ' ')
    const textFields = extractFieldsFromContent(plainText)
    return uniqueSorted([...htmlFields, ...textFields])
}

function mapServerTemplate(template: DocumentTemplateSummary): PrintWordTemplate {
    const version = template.latestVersion ?? template.activeVersion
    return {
        id: template.id,
        name: template.name,
        html: version?.htmlContent ?? '',
        fields: version?.fields ?? [],
        sourceFileName: 'server',
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
    }
}

function createPrintWordTemplateStore() {
    const { subscribe, set } = writable<PrintWordTemplateStoreState>({ templates: [] })

    async function refreshFromServer(): Promise<PrintWordTemplate[]> {
        const templates = await listDocumentTemplates({ includeVersions: true, limit: 200 })
        const mapped = templates.map(mapServerTemplate)
        set({ templates: mapped })
        return mapped
    }

    return {
        subscribe,
        async init() {
            try {
                await refreshFromServer()
            } catch {
                set({ templates: [] })
            }
        },
        async reload() {
            await refreshFromServer()
        },
        async getById(id: string): Promise<PrintWordTemplate | null> {
            try {
                const template = await getDocumentTemplateById(id)
                return mapServerTemplate(template)
            } catch {
                return null
            }
        },
        async importDocx(file: File, name?: string): Promise<PrintWordTemplate> {
            const buffer = await file.arrayBuffer()
            const conversion = await mammoth.convertToHtml({ arrayBuffer: buffer })
            const html = conversion.value?.trim() ?? ''

            if (!html) {
                throw new Error('Cannot parse DOCX file to HTML template.')
            }

            const created = await createDocumentTemplate({
                name: (name || file.name.replace(/\.docx$/i, '') || 'Word template').trim(),
                module: 'general',
                htmlContent: html,
                fields: extractTemplateFields(html),
                title: 'Initial draft from DOCX import',
                changeNote: `Imported from ${file.name}`,
            })

            await refreshFromServer()
            const mapped = mapServerTemplate(created)
            mapped.sourceFileName = file.name
            return mapped
        },
        async createTemplate(name: string, html: string): Promise<PrintWordTemplate> {
            const templateName = name.trim() || 'Custom template'
            const templateHtml = html.trim()
            if (!templateHtml) {
                throw new Error('Template content is required.')
            }
            const created = await createDocumentTemplate({
                name: templateName,
                module: 'general',
                htmlContent: templateHtml,
                fields: extractTemplateFields(templateHtml),
                title: 'Initial draft',
            })
            await refreshFromServer()
            const mapped = mapServerTemplate(created)
            mapped.sourceFileName = 'designer'
            return mapped
        },
        async updateTemplateHtml(id: string, html: string): Promise<PrintWordTemplate> {
            const templateHtml = html.trim()
            if (!templateHtml) {
                throw new Error('Template content is required.')
            }

            const current = await getDocumentTemplateById(id)
            const draftVersion = await createDocumentTemplateVersion(id, {
                title: current.activeVersion?.title || current.latestVersion?.title || 'Draft update',
                htmlContent: templateHtml,
                fields: extractTemplateFields(templateHtml),
                changeNote: 'Update from print template designer',
            })
            await refreshFromServer()
            return {
                id,
                name: current.name,
                html: draftVersion.htmlContent,
                fields: draftVersion.fields,
                sourceFileName: 'designer',
                createdAt: current.createdAt,
                updatedAt: current.updatedAt,
            }
        },
        async publishVersion(id: string, versionId: string): Promise<PrintWordTemplate> {
            const published = await publishDocumentTemplateVersion(id, versionId)
            await refreshFromServer()
            return mapServerTemplate(published)
        },
        async rollback(id: string, versionId: string, changeNote?: string): Promise<PrintWordTemplate> {
            const rolledBack = await rollbackDocumentTemplateVersion(id, versionId, changeNote)
            await refreshFromServer()
            return mapServerTemplate(rolledBack)
        },
        async getVersions(id: string): Promise<DocumentTemplateVersion[]> {
            return listDocumentTemplateVersions(id)
        },
        async seedDefaults(): Promise<PrintWordTemplate[]> {
            const templates = await refreshFromServer()
            return templates
        },
        async remove(id: string) {
            await updateDocumentTemplate(id, { isActive: false })
            await refreshFromServer()
        },
        async rename(id: string, name: string) {
            const trimmed = name.trim()
            if (!trimmed) return
            await updateDocumentTemplate(id, { name: trimmed })
            await refreshFromServer()
        }
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

export function renderWordTemplate(html: string, values: Record<string, string>): string {
    return html.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_full, field: string) => {
        const value = values[field] ?? ''
        return escapeHtml(value).replaceAll('\n', '<br/>')
    })
}

export function encodeTemplateData(values: Record<string, string>): string {
    const json = JSON.stringify(values)
    if (typeof btoa === 'function') {
        const bytes = new TextEncoder().encode(json)
        let binary = ''
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte)
        })
        return btoa(binary)
    }

    return encodeURIComponent(json)
}

export function decodeTemplateData(raw: string | null): Record<string, string> {
    if (!raw) return {}

    try {
        if (typeof atob === 'function') {
            const binary = atob(raw)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i)
            }
            const json = new TextDecoder().decode(bytes)
            return JSON.parse(json) as Record<string, string>
        }

        const json = decodeURIComponent(raw)
        return JSON.parse(json) as Record<string, string>
    } catch {
        return {}
    }
}

export const printWordTemplates = createPrintWordTemplateStore()
