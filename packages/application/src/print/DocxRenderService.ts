/**
 * DocxRenderService — renders .docx templates with docxtemplater.
 *
 * Template syntax (author writes in Microsoft Word):
 *   {variable}             → simple value substitution
 *   {#array}...{/array}   → loop (table rows, list items)
 *   {^array}...{/array}   → inverse/empty block (renders when array is empty)
 *   {#flag}...{/flag}     → conditional (renders when flag is truthy)
 *
 * Table row loop example — in Word, insert a row with:
 *   | {#lines}{i} | {partCode} | {partName} | {qty} | {unitCost} | {total}{/lines} |
 * When rendered, the row is duplicated once per element in data.lines.
 *
 * Install note: this service is used by apps/api which has docxtemplater + pizzip installed.
 * packages/application does NOT list them as dependencies — the API layer imports this service
 * and the packages are resolved from apps/api/node_modules.
 *
 * If you move DocxRenderService into a package that runs standalone (e.g., a job worker),
 * add docxtemplater + pizzip to that package's dependencies.
 */

// Dynamic imports so packages/application can build even without docxtemplater installed.
// The API layer always has both packages available.

export interface DocxRenderOptions {
    /** Replace null/undefined with empty string instead of throwing. Default: true */
    nullToEmpty?: boolean
    /**
     * Allow {#tag} and {/tag} to be in the same paragraph as surrounding text.
     * Required for inline table-row loops. Default: true
     */
    paragraphLoop?: boolean
    /**
     * Convert \n in values to Word line breaks (<w:br/>).
     * Default: true
     */
    linebreaks?: boolean
}

export class DocxRenderService {
    /**
     * Render a .docx template buffer with data.
     *
     * @param templateBuffer - Raw bytes of the .docx template file
     * @param data           - Data object whose keys match {placeholders} in the template
     * @param options        - Optional rendering configuration
     * @returns Rendered .docx as a Buffer
     */
    async renderDocx(
        templateBuffer: Buffer,
        data: Record<string, unknown>,
        options: DocxRenderOptions = {}
    ): Promise<Buffer> {
        const {
            nullToEmpty = true,
            paragraphLoop = true,
            linebreaks = true,
        } = options

        // Dynamic imports — resolved from apps/api/node_modules at runtime.
        const [{ default: Docxtemplater }, { default: PizZip }] = await Promise.all([
            import('docxtemplater'),
            import('pizzip'),
        ])

        const zip = new PizZip(templateBuffer)
        const doc = new Docxtemplater(zip, {
            paragraphLoop,
            linebreaks,
            ...(nullToEmpty
                ? { nullGetter: () => '' }
                : {}),
        })

        doc.render(data)

        const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
        return out as Buffer
    }

    /**
     * Extract all {placeholder} names from a .docx template buffer.
     * Useful for building field-mapping UIs or validating data before render.
     */
    async extractPlaceholders(templateBuffer: Buffer): Promise<string[]> {
        const [{ default: Docxtemplater }, { default: PizZip }] = await Promise.all([
            import('docxtemplater'),
            import('pizzip'),
        ])

        const zip = new PizZip(templateBuffer)

        // Parse without rendering to collect tag names
        const collected: string[] = []
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            parser: (tag: string) => {
                collected.push(tag)
                return { get: () => '' }
            },
        })
        try { doc.render({}) } catch { /* ignore missing-value errors */ }

        // Deduplicate, filter out loop markers (#tag / /tag)
        const names = [...new Set(collected)]
            .filter((t) => !t.startsWith('#') && !t.startsWith('/') && !t.startsWith('^'))
        return names
    }
}
