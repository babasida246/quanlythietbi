// Print system contracts

export type DocType = 'asset' | 'warehouse_receipt' | 'warehouse_issue' | 'inventory' | 'maintenance' | 'repair_order'

export interface PrintFieldMapping {
    fieldName: string
    dataPath: string
    value: unknown
    format?: 'date' | 'currency' | 'phone' | 'percent'
    matchType?: 'exact' | 'partial' | 'normalized'
}

export interface AutoMapFieldsRequest {
    docType: DocType
    recordId: string
    templateId?: string
}

export interface AutoMapFieldsResponse {
    mappings: Record<string, unknown>
    detectedFields: PrintFieldMapping[]
    confidence: number // 0-1, how confident the auto-map is
}

export interface RenderTemplateRequest {
    templateId: string
    fieldMappings: Record<string, unknown>
}

export interface RenderTemplateResponse {
    html: string
}

export interface ExportFileRequest {
    templateId: string
    fieldMappings: Record<string, unknown>
    format: 'pdf' | 'excel' | 'csv' | 'word' | 'json'
    options?: {
        pageSize?: 'a4' | 'letter'
        orientation?: 'portrait' | 'landscape'
        sheetName?: string
        delimiter?: ',' | ';' | '\t'
    }
}

export interface PrintTemplate {
    id: string
    name: string
    docType: DocType
    fields: string[]
    htmlContent: string
    status: 'draft' | 'published'
}

export interface PrintDialogData {
    selectedTemplateId?: string
    fieldMappings: Record<string, unknown>
    format: 'pdf' | 'excel' | 'csv' | 'word' | 'json'
}
