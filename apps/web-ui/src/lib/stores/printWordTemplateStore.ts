import { browser } from '$app/environment'
import { writable } from 'svelte/store'
import mammoth from 'mammoth'

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

const STORAGE_KEY = 'qltb_print_word_templates_v1'

function createId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

function loadState(): PrintWordTemplateStoreState {
    if (!browser) return { templates: [] }

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { templates: [] }
        const parsed = JSON.parse(raw) as Partial<PrintWordTemplateStoreState>
        const templates = (parsed.templates ?? []).filter((item) =>
            Boolean(item?.id && item?.name && item?.html)
        )
        return { templates }
    } catch {
        return { templates: [] }
    }
}

function persistState(state: PrintWordTemplateStoreState): void {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function createPrintWordTemplateStore() {
    const { subscribe, set, update } = writable<PrintWordTemplateStoreState>(loadState())

    return {
        subscribe,
        init() {
            set(loadState())
        },
        getById(id: string): PrintWordTemplate | null {
            const state = loadState()
            return state.templates.find((template) => template.id === id) ?? null
        },
        async importDocx(file: File, name?: string): Promise<PrintWordTemplate> {
            const buffer = await file.arrayBuffer()
            const conversion = await mammoth.convertToHtml({ arrayBuffer: buffer })
            const html = conversion.value?.trim() ?? ''

            if (!html) {
                throw new Error('Cannot parse DOCX file to HTML template.')
            }

            const now = new Date().toISOString()
            const template: PrintWordTemplate = {
                id: createId(),
                name: (name || file.name.replace(/\.docx$/i, '') || 'Word template').trim(),
                html,
                fields: extractTemplateFields(html),
                sourceFileName: file.name,
                createdAt: now,
                updatedAt: now
            }

            update((current) => {
                const next = {
                    templates: [template, ...current.templates]
                }
                persistState(next)
                return next
            })

            return template
        },
        remove(id: string) {
            update((current) => {
                const next = {
                    templates: current.templates.filter((template) => template.id !== id)
                }
                persistState(next)
                return next
            })
        },
        rename(id: string, name: string) {
            update((current) => {
                const trimmed = name.trim()
                if (!trimmed) return current

                const next = {
                    templates: current.templates.map((template) =>
                        template.id === id
                            ? {
                                ...template,
                                name: trimmed,
                                updatedAt: new Date().toISOString()
                            }
                            : template
                    )
                }
                persistState(next)
                return next
            })
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
