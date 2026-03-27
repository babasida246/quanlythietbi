import type { FastifyInstance } from 'fastify'
import type { PrintService } from '@qltb/application'
import { z } from 'zod'

const autoMapFieldsSchema = z.object({
    docType: z.enum(['asset', 'warehouse_receipt', 'warehouse_issue', 'inventory', 'maintenance', 'repair_order']),
    sourceData: z.record(z.any()),
    templateFieldNames: z.array(z.string())
})

const renderTemplateSchema = z.object({
    htmlContent: z.string(),
    fieldMappings: z.record(z.any())
})

const exportFileSchema = z.object({
    htmlContent: z.string(),
    fieldMappings: z.record(z.any()),
    format: z.enum(['pdf', 'excel', 'csv', 'word', 'json']),
    options: z.record(z.any()).optional()
})

const EXT_BY_FORMAT: Record<'pdf' | 'excel' | 'csv' | 'word' | 'json', string> = {
    pdf: 'pdf',
    excel: 'xls',
    csv: 'csv',
    word: 'doc',
    json: 'json'
}

const MIME_BY_FORMAT: Record<'pdf' | 'excel' | 'csv' | 'word' | 'json', string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.ms-excel; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    word: 'application/msword; charset=utf-8',
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
    format: 'pdf' | 'excel' | 'csv' | 'word' | 'json',
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
    if (format === 'word') {
        const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
        return Buffer.from(docHtml, 'utf-8')
    }
    return Buffer.from(JSON.stringify({ ...payloadMeta, mappings: fieldMappings, renderedHtml: html }, null, 2), 'utf-8')
}

export async function printRoute(fastify: FastifyInstance, opts: { printService: PrintService }) {
    const { printService } = opts

    /**
     * POST /api/v1/print/auto-map-fields
     * Auto-detect and map fields from source data to template placeholders
     */
    fastify.post(
        '/print/auto-map-fields',
        {
            schema: { body: autoMapFieldsSchema }
        },
        async (request, reply) => {
            const body = request.body as { docType: string; sourceData: Record<string, unknown>; templateFieldNames: string[] }
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
        {
            schema: { body: renderTemplateSchema }
        },
        async (request, reply) => {
            const body = request.body as { htmlContent: string; fieldMappings: Record<string, unknown> }
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
        {
            schema: { body: exportFileSchema }
        },
        async (request, reply) => {
            const body = request.body as {
                htmlContent: string
                fieldMappings: Record<string, unknown>
                format: 'pdf' | 'excel' | 'csv' | 'word' | 'json'
                options?: Record<string, unknown>
            }
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
}
