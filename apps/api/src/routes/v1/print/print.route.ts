import type { FastifyInstance } from 'fastify'
import type { PrintService, DocxRenderService } from '@qltb/application'
import type { LabelsRepository } from '@qltb/infra-postgres'
import { z } from 'zod'
import { BuiltinDocxService, BUILTIN_PRINT_TYPES } from '../../../templates/BuiltinDocxService.js'

const autoMapFieldsSchema = z.object({
    docType: z.enum(['asset', 'warehouse_receipt', 'warehouse_issue', 'inventory', 'maintenance', 'repair_order']),
    sourceData: z.record(z.any()),
    templateFieldNames: z.array(z.string())
})

const suggestTemplateSchema = z.object({
    docType: z.enum(['asset', 'warehouse_receipt', 'warehouse_issue', 'inventory', 'maintenance', 'repair_order'])
})

const renderTemplateSchema = z.object({
    htmlContent: z.string(),
    fieldMappings: z.record(z.any())
})

const exportFileSchema = z.object({
    htmlContent: z.string(),
    fieldMappings: z.record(z.any()),
    format: z.enum(['pdf', 'excel', 'csv', 'docx', 'json']),
    options: z.record(z.any()).optional()
})

const EXT_BY_FORMAT: Record<'pdf' | 'excel' | 'csv' | 'docx' | 'json', string> = {
    pdf: 'pdf',
    excel: 'xls',
    csv: 'csv',
    docx: 'docx',
    json: 'json'
}

const MIME_BY_FORMAT: Record<'pdf' | 'excel' | 'csv' | 'docx' | 'json', string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.ms-excel; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    json: 'application/json; charset=utf-8'
}

export function stripHtml(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

export function toCsv(fieldMappings: Record<string, unknown>): string {
    const escape = (value: unknown) => {
        const text = String(value ?? '')
        return `"${text.replace(/"/g, '""')}"`
    }

    const rows = [['field', 'value']]
    for (const [key, value] of Object.entries(fieldMappings)) {
        rows.push([key, String(value ?? '')])
    }
    return rows.map((row) => row.map(escape).join(',')).join('\n')
}

export function toExcelXml(fieldMappings: Record<string, unknown>): string {
    const esc = (input: string) => input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

    const rows = Object.entries(fieldMappings)
        .map(([key, value]) => `<Row><Cell><Data ss:Type="String">${esc(key)}</Data></Cell><Cell><Data ss:Type="String">${esc(String(value ?? ''))}</Data></Cell></Row>`)
        .join('')

    return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="PrintData">
    <Table>
      <Row><Cell><Data ss:Type="String">Field</Data></Cell><Cell><Data ss:Type="String">Value</Data></Cell></Row>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`
}

export async function toPdfBuffer(html: string): Promise<Buffer> {
    const moduleRef = await import('pdfkit')
    const PDFDocument = (moduleRef.default ?? moduleRef) as any

    return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        const doc = new PDFDocument({ size: 'A4', margin: 36 })

        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        doc.fontSize(11)
        doc.text(stripHtml(html), {
            width: 523,
            lineGap: 2
        })
        doc.end()
    })
}

export async function buildExportBuffer(
    format: 'pdf' | 'excel' | 'csv' | 'docx' | 'json',
    html: string,
    fieldMappings: Record<string, unknown>,
    payloadMeta: Record<string, unknown>
): Promise<Buffer> {
    if (format === 'pdf') {
        return await toPdfBuffer(html)
    }
    if (format === 'excel') {
        return Buffer.from(toExcelXml(fieldMappings), 'utf-8')
    }
    if (format === 'csv') {
        return Buffer.from(toCsv(fieldMappings), 'utf-8')
    }
    if (format === 'docx') {
        throw new Error('DOCX export requires a DOCX template. Use /api/v1/print/render-docx.')
    }
    return Buffer.from(JSON.stringify({ ...payloadMeta, mappings: fieldMappings, renderedHtml: html }, null, 2), 'utf-8')
}

const renderDocxSchema = z.object({
    templateId: z.string().uuid(),
    versionId: z.string().uuid(),
    data: z.record(z.any()).describe('Data object to render into the .docx template'),
    fileName: z.string().optional().describe('Suggested download filename (without extension)'),
})

type SqlDataSourceKind = 'function' | 'procedure'

const routineNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/

const registerSqlDataSourceSchema = z.object({
    templateId: z.string().uuid(),
    kind: z.enum(['function', 'procedure']),
    routineName: z.string().min(1).max(200).regex(routineNameRegex),
    definitionSql: z.string().min(20).max(100000),
    samplePayload: z.record(z.any()).optional().default({}),
    sampleLimit: z.coerce.number().int().positive().max(200).optional().default(30)
})

const sandboxSqlDataSourceSchema = z.object({
    templateId: z.string().uuid().optional(),
    kind: z.enum(['function', 'procedure']).optional(),
    routineName: z.string().min(1).max(200).regex(routineNameRegex).optional(),
    payload: z.record(z.any()).optional().default({}),
    limit: z.coerce.number().int().positive().max(200).optional().default(30)
}).refine((value) => Boolean(value.templateId || (value.kind && value.routineName)), {
    message: 'Either templateId or (kind + routineName) is required'
})

const resolveTemplateDataSourceSchema = z.object({
    templateId: z.string().uuid(),
    payload: z.record(z.any()).optional().default({}),
    limit: z.coerce.number().int().positive().max(200).optional().default(30)
})

const FORBIDDEN_SQL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\binsert\b/i, reason: 'INSERT is not allowed in print routines' },
    { pattern: /\bupdate\b/i, reason: 'UPDATE is not allowed in print routines' },
    { pattern: /\bdelete\b/i, reason: 'DELETE is not allowed in print routines' },
    { pattern: /\bmerge\b/i, reason: 'MERGE is not allowed in print routines' },
    { pattern: /\btruncate\b/i, reason: 'TRUNCATE is not allowed in print routines' },
    { pattern: /\balter\b/i, reason: 'ALTER is not allowed in print routines' },
    { pattern: /\bdrop\b/i, reason: 'DROP is not allowed in print routines' },
    { pattern: /\bgrant\b/i, reason: 'GRANT is not allowed in print routines' },
    { pattern: /\brevoke\b/i, reason: 'REVOKE is not allowed in print routines' },
    { pattern: /\bcopy\b/i, reason: 'COPY is not allowed in print routines' },
    { pattern: /\brefresh\s+materialized\b/i, reason: 'REFRESH MATERIALIZED is not allowed in print routines' },
    { pattern: /\bvacuum\b/i, reason: 'VACUUM is not allowed in print routines' },
    { pattern: /\banalyze\b/i, reason: 'ANALYZE is not allowed in print routines' },
    { pattern: /\bset\s+role\b/i, reason: 'SET ROLE is not allowed in print routines' },
    { pattern: /\bset\s+session_authorization\b/i, reason: 'SET SESSION AUTHORIZATION is not allowed' },
    { pattern: /\bpg_terminate_backend\b/i, reason: 'Terminating backend sessions is not allowed' },
    { pattern: /\bpg_sleep\b/i, reason: 'Long-running sleep calls are not allowed' },
]

function stripSqlComments(sql: string): string {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function assertReadOnlyRoutineSql(kind: SqlDataSourceKind, definitionSql: string): void {
    const normalized = stripSqlComments(definitionSql)
    const startPattern = kind === 'function'
        ? /^create\s+or\s+replace\s+function\b/i
        : /^create\s+or\s+replace\s+procedure\b/i

    if (!startPattern.test(normalized)) {
        throw new Error(`SQL must start with CREATE OR REPLACE ${kind.toUpperCase()}`)
    }

    for (const rule of FORBIDDEN_SQL_PATTERNS) {
        if (rule.pattern.test(normalized)) {
            throw new Error(rule.reason)
        }
    }
}

function toDataObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }
    return value as Record<string, unknown>
}

function resolveRoutineDataObject(rows: Record<string, unknown>[]): Record<string, unknown> {
    if (!rows || rows.length === 0) {
        return {}
    }

    if (rows.length === 1) {
        const row = rows[0] ?? {}
        const values = Object.values(row)

        if (values.length === 1 && values[0] && typeof values[0] === 'object') {
            if (Array.isArray(values[0])) {
                return { rows: values[0] as unknown[] }
            }
            return toDataObject(values[0])
        }

        return row
    }

    return { rows }
}

function collectFieldPaths(value: unknown, prefix: string, out: Set<string>): void {
    if (value === null || value === undefined) {
        if (prefix) out.add(prefix)
        return
    }

    if (Array.isArray(value)) {
        if (prefix) out.add(`${prefix}[]`)
        if (value.length > 0) {
            collectFieldPaths(value[0], prefix ? `${prefix}.0` : '0', out)
        }
        return
    }

    if (typeof value !== 'object') {
        if (prefix) out.add(prefix)
        return
    }

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0 && prefix) {
        out.add(prefix)
        return
    }

    for (const [key, child] of entries) {
        const next = prefix ? `${prefix}.${key}` : key
        collectFieldPaths(child, next, out)
    }
}

function inferAvailableFields(data: Record<string, unknown>): string[] {
    const set = new Set<string>()
    collectFieldPaths(data, '', set)
    return [...set].sort((a, b) => a.localeCompare(b))
}

export async function printRoute(fastify: FastifyInstance, opts: { printService: PrintService; docxRenderService: DocxRenderService; labelsRepo: LabelsRepository }) {
    const { printService, docxRenderService, labelsRepo } = opts

    async function resolveRoutineConfig(input: {
        templateId?: string
        kind?: SqlDataSourceKind
        routineName?: string
    }): Promise<{ kind: SqlDataSourceKind; routineName: string; templateId?: string }> {
        if (input.templateId) {
            const template = await labelsRepo.findDocumentTemplateById(input.templateId)
            if (!template) {
                throw new Error('Document template not found')
            }
            if (!template.dataSourceKind || template.dataSourceKind === 'none' || !template.dataSourceName) {
                throw new Error('Template has no SQL data source configured')
            }
            return {
                kind: template.dataSourceKind,
                routineName: template.dataSourceName,
                templateId: template.id
            }
        }

        if (!input.kind || !input.routineName) {
            throw new Error('Either templateId or kind + routineName is required')
        }

        return {
            kind: input.kind,
            routineName: input.routineName
        }
    }

    /**
     * GET /api/v1/print/suggest-template
     * Find and suggest document templates by docType (module matching)
     * Returns active templates first, sorted by most recently updated
     */
    fastify.get(
        '/print/suggest-template',
        async (request, reply) => {
            const query = suggestTemplateSchema.parse(request.query)
            const { docType } = query

            try {
                const [result, defaultSetting] = await Promise.all([
                    labelsRepo.findAllDocumentTemplates({
                        module: docType,
                        isActive: true,
                        limit: 50,
                        page: 1,
                        includeVersions: true
                    }),
                    labelsRepo.findSettingByKey(`print.defaultTemplateId.${docType}`)
                ])

                const defaultTemplateId = defaultSetting?.settingValue ?? null

                // Sort default template first if configured and present
                let templates = result.data
                if (defaultTemplateId) {
                    const idx = templates.findIndex((t: { id: string }) => t.id === defaultTemplateId)
                    if (idx > 0) {
                        const [def] = templates.splice(idx, 1)
                        templates = [def, ...templates]
                    }
                }

                return reply.send({
                    success: true,
                    data: templates,
                    meta: {
                        total: result.total,
                        module: docType,
                        defaultTemplateId,
                        description: `Available templates for document type '${docType}'`
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'SUGGEST_TEMPLATE_FAILED',
                        message: error instanceof Error ? error.message : 'Failed to suggest templates'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/sql-datasource/register
     * Create or replace a read-only SQL function/procedure and bind it to a template.
     */
    fastify.post(
        '/print/sql-datasource/register',
        async (request, reply) => {
            const actorId = request.user?.id
            if (!actorId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Unauthorized'
                    }
                })
            }

            const body = registerSqlDataSourceSchema.parse(request.body)

            try {
                assertReadOnlyRoutineSql(body.kind, body.definitionSql)

                const routine = await labelsRepo.createOrReplacePrintDataSourceRoutine(
                    body.kind,
                    body.routineName,
                    body.definitionSql,
                )

                await labelsRepo.bindDocumentTemplateDataSource(
                    body.templateId,
                    body.kind,
                    routine.qualifiedName,
                    actorId,
                )

                const rows = await labelsRepo.sandboxPrintDataSourceRoutine(
                    body.kind,
                    routine.qualifiedName,
                    body.samplePayload ?? {},
                    body.sampleLimit,
                )

                const sampleData = resolveRoutineDataObject(rows)
                const availableFields = inferAvailableFields(sampleData)

                const template = await labelsRepo.findDocumentTemplateById(body.templateId)

                return reply.send({
                    success: true,
                    data: {
                        routine,
                        template,
                        sampleRows: rows,
                        sampleData,
                        availableFields,
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'REGISTER_SQL_DATASOURCE_FAILED',
                        message: error instanceof Error ? error.message : 'Failed to register SQL data source'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/sql-datasource/sandbox
     * Run linked routine in read-only mode and return preview rows + detected field paths.
     */
    fastify.post(
        '/print/sql-datasource/sandbox',
        async (request, reply) => {
            const body = sandboxSqlDataSourceSchema.parse(request.body)

            try {
                const config = await resolveRoutineConfig({
                    templateId: body.templateId,
                    kind: body.kind,
                    routineName: body.routineName,
                })

                const rows = await labelsRepo.sandboxPrintDataSourceRoutine(
                    config.kind,
                    config.routineName,
                    body.payload ?? {},
                    body.limit,
                )

                const resolvedData = resolveRoutineDataObject(rows)
                const fields = inferAvailableFields(resolvedData)

                return reply.send({
                    success: true,
                    data: {
                        templateId: config.templateId ?? null,
                        kind: config.kind,
                        routineName: config.routineName,
                        rows,
                        resolvedData,
                        fields,
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'SQL_DATASOURCE_SANDBOX_FAILED',
                        message: error instanceof Error ? error.message : 'SQL data source sandbox failed'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/sql-datasource/introspect
     * Return placeholder candidate field paths from routine output.
     */
    fastify.post(
        '/print/sql-datasource/introspect',
        async (request, reply) => {
            const body = sandboxSqlDataSourceSchema.parse(request.body)

            try {
                const config = await resolveRoutineConfig({
                    templateId: body.templateId,
                    kind: body.kind,
                    routineName: body.routineName,
                })

                const rows = await labelsRepo.sandboxPrintDataSourceRoutine(
                    config.kind,
                    config.routineName,
                    body.payload ?? {},
                    body.limit,
                )

                const resolvedData = resolveRoutineDataObject(rows)
                const fields = inferAvailableFields(resolvedData)

                return reply.send({
                    success: true,
                    data: {
                        templateId: config.templateId ?? null,
                        kind: config.kind,
                        routineName: config.routineName,
                        fields,
                        sampleData: resolvedData,
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'SQL_DATASOURCE_INTROSPECT_FAILED',
                        message: error instanceof Error ? error.message : 'SQL data source introspection failed'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/data-source/resolve-template
     * Resolve source data for a template by executing linked routine in read-only mode.
     */
    fastify.post(
        '/print/data-source/resolve-template',
        async (request, reply) => {
            const body = resolveTemplateDataSourceSchema.parse(request.body)

            try {
                const config = await resolveRoutineConfig({ templateId: body.templateId })
                const rows = await labelsRepo.sandboxPrintDataSourceRoutine(
                    config.kind,
                    config.routineName,
                    body.payload ?? {},
                    body.limit,
                )
                const resolvedData = resolveRoutineDataObject(rows)

                return reply.send({
                    success: true,
                    data: {
                        templateId: body.templateId,
                        kind: config.kind,
                        routineName: config.routineName,
                        resolvedData,
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'SQL_DATASOURCE_RESOLVE_FAILED',
                        message: error instanceof Error ? error.message : 'Failed to resolve template data source'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/auto-map-fields
     * Auto-detect and map fields from source data to template placeholders
     */
    fastify.post(
        '/print/auto-map-fields',
        async (request, reply) => {
            const body = autoMapFieldsSchema.parse(request.body)
            const { docType, sourceData, templateFieldNames } = body

            try {
                const result = printService.autoMapFields(
                    docType as any,
                    sourceData,
                    templateFieldNames
                )

                return reply.send({
                    success: true,
                    data: result
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'AUTO_MAP_FAILED',
                        message: error instanceof Error ? error.message : 'Auto-mapping failed'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/render
     * Render template HTML with field mappings
     */
    fastify.post(
        '/print/render',
        async (request, reply) => {
            const body = renderTemplateSchema.parse(request.body)
            const { htmlContent, fieldMappings } = body

            try {
                const html = printService.renderTemplate(htmlContent, fieldMappings)

                return reply.send({
                    success: true,
                    data: { html }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'RENDER_FAILED',
                        message: error instanceof Error ? error.message : 'Template rendering failed'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/export-file
     * Export rendered template to PDF, Excel, or other formats
     */
    fastify.post(
        '/print/export-file',
        async (request, reply) => {
            const body = exportFileSchema.parse(request.body)
            const { htmlContent, fieldMappings, format, options } = body

            try {
                const html = printService.renderTemplate(htmlContent, fieldMappings)
                const safeName = String(options?.fileName ?? 'print').trim().replace(/[^a-zA-Z0-9-_]+/g, '_') || 'print'
                const payloadMeta = {
                    docType: options?.docType,
                    templateId: options?.templateId,
                    templateName: options?.templateName,
                    recordId: options?.recordId,
                    confidence: options?.confidence
                }
                const buffer = await buildExportBuffer(format, html, fieldMappings, payloadMeta)
                const base64 = buffer.toString('base64')

                return reply.send({
                    success: true,
                    data: {
                        format,
                        content: base64,
                        mimeType: MIME_BY_FORMAT[format],
                        fileName: `${safeName}.${EXT_BY_FORMAT[format]}`,
                        message: `${format.toUpperCase()} export generated successfully.`
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'EXPORT_FAILED',
                        message: error instanceof Error ? error.message : 'File export failed'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/render-docx
     *
     * Render a .docx template (uploaded via document templates) with provided data.
     * Returns base64-encoded .docx content ready for download.
     *
     * Template syntax (design in Microsoft Word):
     *   {fieldName}           – simple substitution
     *   {#lines}...{/lines}   – loop for table rows; repeat one row per element in data.lines
     *   {^lines}Trống{/lines} – rendered only when data.lines is empty
     *   {#flag}...{/flag}     – conditional block
     *
     * Example data for a warehouse receipt:
     *   {
     *     orgName: 'Công ty ABC',
     *     code: 'NK-2026-001',
     *     date: '01/01/2026',
     *     warehouseName: 'Kho A',
     *     lines: [
     *       { i: 1, partCode: 'TB001', partName: 'Laptop Dell', qty: 2, unitCost: '15.000.000 đ', total: '30.000.000 đ' }
     *     ]
     *   }
     */
    fastify.post(
        '/print/render-docx',
        async (request, reply) => {
            const body = renderDocxSchema.parse(request.body)
            const { templateId, versionId, data, fileName } = body

            try {
                const content = await labelsRepo.getDocumentTemplateVersionBinary(templateId, versionId)
                if (!content) {
                    return reply.status(404).send({
                        success: false,
                        error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template version not found' }
                    })
                }
                if (content.format !== 'docx' || !content.binaryContent) {
                    return reply.status(400).send({
                        success: false,
                        error: { code: 'NOT_DOCX_TEMPLATE', message: 'Template is not a DOCX template. Upload a .docx file first.' }
                    })
                }

                const rendered = await docxRenderService.renderDocx(content.binaryContent, data)
                const base64 = rendered.toString('base64')
                const safeName = String(fileName ?? 'document').trim().replace(/[^a-zA-Z0-9-_]+/g, '_') || 'document'

                return reply.send({
                    success: true,
                    data: {
                        content: base64,
                        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        fileName: `${safeName}.docx`,
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'DOCX_RENDER_FAILED',
                        message: error instanceof Error ? error.message : 'DOCX rendering failed'
                    }
                })
            }
        }
    )

    /**
     * POST /api/v1/print/extract-docx-placeholders
     *
     * Parse a .docx template and return all {placeholder} names found.
     * Useful for building field-mapping UIs before rendering.
     */
    fastify.post(
        '/print/extract-docx-placeholders',
        async (request, reply) => {
            const body = z.object({
                templateId: z.string().uuid(),
                versionId: z.string().uuid(),
            }).parse(request.body)

            try {
                const content = await labelsRepo.getDocumentTemplateVersionBinary(body.templateId, body.versionId)
                if (!content || content.format !== 'docx' || !content.binaryContent) {
                    return reply.status(404).send({
                        success: false,
                        error: { code: 'TEMPLATE_NOT_FOUND', message: 'DOCX template version not found' }
                    })
                }

                const { simpleFields, loopFields } = await docxRenderService.extractPlaceholders(content.binaryContent)
                return reply.send({ success: true, data: { simpleFields, loopFields, placeholders: simpleFields } })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'EXTRACT_FAILED',
                        message: error instanceof Error ? error.message : 'Placeholder extraction failed'
                    }
                })
            }
        }
    )

    const builtinDocxService = new BuiltinDocxService()

    /**
     * POST /api/v1/print/render-builtin-docx
     *
     * Render một trong 11 mẫu in có sẵn (.docx) với dữ liệu.
     * Template files nằm tại apps/api/src/templates/docx/*.docx.
     * Tạo lại bằng: node scripts/generate-docx-templates.mjs
     *
     * Body:
     *   printType  – một trong BUILTIN_PRINT_TYPES
     *   data       – object dữ liệu (keys tương ứng {placeholder} trong template)
     *                  Luôn bao gồm orgInfo: { orgName, orgAddress, orgPhone, orgTaxCode }
     *   fileName   – tên file download (không có .docx, tùy chọn)
     *
     * Cấu trúc data ví dụ cho phieu-nhap-kho:
     *   {
     *     orgName, orgAddress, orgPhone, orgTaxCode,
     *     code, date, warehouseName, supplier, reference, note,
     *     lines: [{ i, partCode, partName, uom, qty, unitCost, total, serialNo, lineNote }],
     *     totalQty, totalAmount,
     *     preparedBy, receivedBy, approvedBy,
     *     sigDate
     *   }
     */
    fastify.post(
        '/print/render-builtin-docx',
        async (request, reply) => {
            const body = z.object({
                printType: z.enum(BUILTIN_PRINT_TYPES as [string, ...string[]]),
                data: z.record(z.any()),
                fileName: z.string().optional(),
            }).parse(request.body)

            try {
                const rendered = await builtinDocxService.render(body.printType, body.data)
                const base64 = rendered.toString('base64')
                const safeName = String(body.fileName ?? body.printType)
                    .trim().replace(/[^a-zA-Z0-9-_]+/g, '_') || body.printType

                return reply.send({
                    success: true,
                    data: {
                        content: base64,
                        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        fileName: `${safeName}.docx`,
                    }
                })
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'BUILTIN_RENDER_FAILED',
                        message: error instanceof Error ? error.message : 'Render failed',
                    }
                })
            }
        }
    )

    /**
     * GET /api/v1/print/builtin-types
     * Trả về danh sách các loại mẫu in có sẵn.
     */
    fastify.get('/print/builtin-types', async (_request, reply) => {
        return reply.send({ success: true, data: BUILTIN_PRINT_TYPES })
    })
}
