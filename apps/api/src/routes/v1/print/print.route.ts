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
     * Phase 1: Returns HTML as base64 or file download ready
     * Phase 2: Implement actual PDF/Excel generation
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
                format: string
            }
            const { htmlContent, fieldMappings, format } = body

            try {
                // Render template first
                const html = printService.renderTemplate(htmlContent, fieldMappings)

                // Phase 2 TODO: Implement actual PDF/Excel/etc generation
                // For now, return HTML as base64 data URI
                const base64 = Buffer.from(html).toString('base64')

                return reply.send({
                    success: true,
                    data: {
                        format,
                        content: base64,
                        mimeType: 'text/html; charset=utf-8',
                        message: `Phase 1: HTML export ready. Full ${format.toUpperCase()} export coming in Phase 2.`
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
