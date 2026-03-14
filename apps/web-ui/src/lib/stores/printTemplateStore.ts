import { browser } from '$app/environment'
import { writable } from 'svelte/store'

export type PrintFontFamily = 'times' | 'arial' | 'inter'

export type PrintTemplateConfig = {
    header: {
        showLogoPlaceholder: boolean
        logoText: string
        addressLabel: string
        phoneLabel: string
        taxLabel: string
        numberLabel: string
        codeLabel: string
        dateLabel: string
    }
    typography: {
        fontFamily: PrintFontFamily
        fontSizePt: number
        lineHeight: number
        titleSizePt: number
        tableFontSizePt: number
    }
    layout: {
        pagePaddingTopMm: number
        pagePaddingRightMm: number
        pagePaddingBottomMm: number
        pagePaddingLeftMm: number
    }
    signatures: {
        defaultTitleLine: string
        datePrefix: string
    }
    footer: {
        note: string
    }
}

const STORAGE_KEY = 'qltb_print_template_v1'

const DEFAULT_CONFIG: PrintTemplateConfig = {
    header: {
        showLogoPlaceholder: true,
        logoText: '[LOGO]',
        addressLabel: 'Dia chi',
        phoneLabel: 'Dien thoai',
        taxLabel: 'MST',
        numberLabel: 'So',
        codeLabel: 'Ma',
        dateLabel: 'Ngay'
    },
    typography: {
        fontFamily: 'times',
        fontSizePt: 12,
        lineHeight: 1.5,
        titleSizePt: 16,
        tableFontSizePt: 10
    },
    layout: {
        pagePaddingTopMm: 18,
        pagePaddingRightMm: 20,
        pagePaddingBottomMm: 18,
        pagePaddingLeftMm: 20
    },
    signatures: {
        defaultTitleLine: '(Ky, ghi ro ho ten)',
        datePrefix: 'Ngay'
    },
    footer: {
        note: ''
    }
}

function clamp(n: number, min: number, max: number): number {
    if (Number.isNaN(n)) return min
    return Math.min(max, Math.max(min, n))
}

function normalizeConfig(raw: Partial<PrintTemplateConfig> | null): PrintTemplateConfig {
    if (!raw) return { ...DEFAULT_CONFIG }

    return {
        header: {
            ...DEFAULT_CONFIG.header,
            ...(raw.header ?? {})
        },
        typography: {
            ...DEFAULT_CONFIG.typography,
            ...(raw.typography ?? {}),
            fontSizePt: clamp(Number(raw.typography?.fontSizePt ?? DEFAULT_CONFIG.typography.fontSizePt), 10, 14),
            lineHeight: clamp(Number(raw.typography?.lineHeight ?? DEFAULT_CONFIG.typography.lineHeight), 1.2, 1.9),
            titleSizePt: clamp(Number(raw.typography?.titleSizePt ?? DEFAULT_CONFIG.typography.titleSizePt), 13, 20),
            tableFontSizePt: clamp(Number(raw.typography?.tableFontSizePt ?? DEFAULT_CONFIG.typography.tableFontSizePt), 8, 12)
        },
        layout: {
            ...DEFAULT_CONFIG.layout,
            ...(raw.layout ?? {}),
            pagePaddingTopMm: clamp(Number(raw.layout?.pagePaddingTopMm ?? DEFAULT_CONFIG.layout.pagePaddingTopMm), 8, 25),
            pagePaddingRightMm: clamp(Number(raw.layout?.pagePaddingRightMm ?? DEFAULT_CONFIG.layout.pagePaddingRightMm), 8, 25),
            pagePaddingBottomMm: clamp(Number(raw.layout?.pagePaddingBottomMm ?? DEFAULT_CONFIG.layout.pagePaddingBottomMm), 8, 25),
            pagePaddingLeftMm: clamp(Number(raw.layout?.pagePaddingLeftMm ?? DEFAULT_CONFIG.layout.pagePaddingLeftMm), 8, 25)
        },
        signatures: {
            ...DEFAULT_CONFIG.signatures,
            ...(raw.signatures ?? {})
        },
        footer: {
            ...DEFAULT_CONFIG.footer,
            ...(raw.footer ?? {})
        }
    }
}

function loadConfig(): PrintTemplateConfig {
    if (!browser) return { ...DEFAULT_CONFIG }

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { ...DEFAULT_CONFIG }
        return normalizeConfig(JSON.parse(raw) as Partial<PrintTemplateConfig>)
    } catch {
        return { ...DEFAULT_CONFIG }
    }
}

function persistConfig(config: PrintTemplateConfig): void {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function printFontFamilyCss(family: PrintFontFamily): string {
    switch (family) {
        case 'arial':
            return 'Arial, Helvetica, sans-serif'
        case 'inter':
            return 'Inter, Arial, Helvetica, sans-serif'
        default:
            return "'Times New Roman', Times, serif"
    }
}

export function buildPrintCssVariables(config: PrintTemplateConfig): string {
    const padding = `${config.layout.pagePaddingTopMm}mm ${config.layout.pagePaddingRightMm}mm ${config.layout.pagePaddingBottomMm}mm ${config.layout.pagePaddingLeftMm}mm`

    return [
        `--print-font-family: ${printFontFamilyCss(config.typography.fontFamily)}`,
        `--print-font-size: ${config.typography.fontSizePt}pt`,
        `--print-line-height: ${config.typography.lineHeight}`,
        `--print-title-size: ${config.typography.titleSizePt}pt`,
        `--print-table-font-size: ${config.typography.tableFontSizePt}pt`,
        `--print-page-padding: ${padding}`
    ].join('; ')
}

function createPrintTemplateStore() {
    const { subscribe, set, update } = writable<PrintTemplateConfig>(loadConfig())

    return {
        subscribe,
        init() {
            set(loadConfig())
        },
        updateHeader<K extends keyof PrintTemplateConfig['header']>(key: K, value: PrintTemplateConfig['header'][K]) {
            update((current) => {
                const next = {
                    ...current,
                    header: {
                        ...current.header,
                        [key]: value
                    }
                }
                persistConfig(next)
                return next
            })
        },
        updateTypography<K extends keyof PrintTemplateConfig['typography']>(key: K, value: PrintTemplateConfig['typography'][K]) {
            update((current) => {
                const next = normalizeConfig({
                    ...current,
                    typography: {
                        ...current.typography,
                        [key]: value
                    }
                })
                persistConfig(next)
                return next
            })
        },
        updateLayout<K extends keyof PrintTemplateConfig['layout']>(key: K, value: PrintTemplateConfig['layout'][K]) {
            update((current) => {
                const next = normalizeConfig({
                    ...current,
                    layout: {
                        ...current.layout,
                        [key]: value
                    }
                })
                persistConfig(next)
                return next
            })
        },
        updateSignatures<K extends keyof PrintTemplateConfig['signatures']>(key: K, value: PrintTemplateConfig['signatures'][K]) {
            update((current) => {
                const next = {
                    ...current,
                    signatures: {
                        ...current.signatures,
                        [key]: value
                    }
                }
                persistConfig(next)
                return next
            })
        },
        updateFooter<K extends keyof PrintTemplateConfig['footer']>(key: K, value: PrintTemplateConfig['footer'][K]) {
            update((current) => {
                const next = {
                    ...current,
                    footer: {
                        ...current.footer,
                        [key]: value
                    }
                }
                persistConfig(next)
                return next
            })
        },
        reset() {
            const next = { ...DEFAULT_CONFIG }
            set(next)
            persistConfig(next)
        }
    }
}

export const printTemplate = createPrintTemplateStore()
export { DEFAULT_CONFIG as DEFAULT_PRINT_TEMPLATE_CONFIG }
