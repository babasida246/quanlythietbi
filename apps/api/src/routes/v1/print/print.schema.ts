import { z } from 'zod'

export const autoMapFieldsSchema = z.object({
    docType: z.enum(['asset', 'warehouse_receipt', 'warehouse_issue', 'inventory', 'maintenance', 'repair_order']),
    sourceData: z.record(z.any()).describe('Source data object to extract fields from'),
    templateFieldNames: z.array(z.string()).describe('Array of field names to find in source data')
})

export const renderTemplateSchema = z.object({
    htmlContent: z.string().describe('HTML template content with {{fieldName}} placeholders'),
    fieldMappings: z.record(z.any()).describe('Object mapping field names to actual values')
})

export const exportFileSchema = z.object({
    htmlContent: z.string().describe('HTML template content'),
    fieldMappings: z.record(z.any()).describe('Field mappings for template rendering'),
    format: z.enum(['pdf', 'excel', 'csv', 'docx', 'json']).describe('Export format'),
    options: z.record(z.any()).optional().describe('Format-specific options')
})

export type AutoMapFieldsRequest = z.infer<typeof autoMapFieldsSchema>
export type RenderTemplateRequest = z.infer<typeof renderTemplateSchema>
export type ExportFileRequest = z.infer<typeof exportFileSchema>
