/**
 * Labels Module - Type Definitions
 */

// Label type enum
export type LabelType = 'barcode' | 'qrcode' | 'combined';

// Size preset enum
export type SizePreset = 'small' | 'medium' | 'large' | 'custom';

// Barcode type enum
export type BarcodeType = 'code128' | 'code39' | 'qrcode' | 'datamatrix' | 'ean13';

// Print job status enum
export type PrintJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Print job item status enum
export type PrintJobItemStatus = 'pending' | 'generated' | 'failed';

// Output type enum
export type OutputType = 'pdf' | 'direct' | 'preview';

// Label field IDs
export type LabelFieldId =
    | 'asset_tag'
    | 'serial'
    | 'name'
    | 'company_name'
    | 'company_logo'
    | 'barcode'
    | 'qrcode'
    | 'purchase_date'
    | 'category'
    | 'location'
    | 'assigned_to'
    | string; // Allow custom fields

// Layout element types
export interface LayoutElement {
    type: 'text' | 'barcode' | 'qrcode' | 'image' | 'line' | 'rectangle';
    field?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    color?: string;
    rotation?: number;
}

// Layout definition
export interface LabelLayout {
    elements: LayoutElement[];
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    padding?: number;
}

// Label template entity
export interface LabelTemplate {
    id: string;
    templateCode: string;
    name: string;
    description?: string;
    labelType: LabelType;
    sizePreset: SizePreset;
    widthMm: number;
    heightMm: number;
    layout: LabelLayout;
    fields: LabelFieldId[];
    barcodeType: BarcodeType;
    includeLogo: boolean;
    includeCompanyName: boolean;
    fontFamily: string;
    fontSize: number;
    isDefault: boolean;
    isActive: boolean;
    organizationId?: string;
    createdBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Label template with usage stats
export interface LabelTemplateWithUsage extends LabelTemplate {
    createdByName?: string;
    usageCount: number;
}

// Print job entity
export interface PrintJob {
    id: string;
    jobCode: string;
    templateId: string;
    assetIds: string[];
    assetCount: number;
    copiesPerAsset: number;
    totalLabels: number;
    printerName?: string;
    paperSize?: string;
    status: PrintJobStatus;
    errorMessage?: string;
    outputType: OutputType;
    outputUrl?: string;
    startedAt?: Date;
    completedAt?: Date;
    organizationId?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

// Print job with details
export interface PrintJobWithDetails extends PrintJob {
    templateName: string;
    labelType: LabelType;
    sizePreset: SizePreset;
    createdByName: string;
    createdByEmail: string;
    durationSeconds?: number;
}

// Print job item entity
export interface PrintJobItem {
    id: string;
    printJobId: string;
    assetId: string;
    copyNumber: number;
    status: PrintJobItemStatus;
    errorMessage?: string;
    labelData?: Record<string, unknown>;
    createdAt: Date;
}

// Print job item with asset details
export interface PrintJobItemWithDetails extends PrintJobItem {
    assetTag: string;
    assetName: string;
    serialNumber?: string;
    categoryName?: string;
    locationName?: string;
    assignedToName?: string;
}

// Label settings entity
export interface LabelSetting {
    id: string;
    settingKey: string;
    settingValue?: string;
    valueType: 'string' | 'boolean' | 'number' | 'json';
    description?: string;
    organizationId?: string;
    updatedBy?: string;
    updatedAt: Date;
}

// ==================== DTOs ====================

// Create template DTO
export interface CreateTemplateDto {
    name: string;
    description?: string;
    labelType: LabelType;
    sizePreset: SizePreset;
    widthMm: number;
    heightMm: number;
    layout?: LabelLayout;
    fields: LabelFieldId[];
    barcodeType?: BarcodeType;
    includeLogo?: boolean;
    includeCompanyName?: boolean;
    fontFamily?: string;
    fontSize?: number;
    isDefault?: boolean;
    organizationId?: string;
    createdBy: string;
}

// Update template DTO
export interface UpdateTemplateDto {
    name?: string;
    description?: string;
    labelType?: LabelType;
    sizePreset?: SizePreset;
    widthMm?: number;
    heightMm?: number;
    layout?: LabelLayout;
    fields?: LabelFieldId[];
    barcodeType?: BarcodeType;
    includeLogo?: boolean;
    includeCompanyName?: boolean;
    fontFamily?: string;
    fontSize?: number;
    isDefault?: boolean;
    isActive?: boolean;
    updatedBy: string;
}

// Create print job DTO
export interface CreatePrintJobDto {
    templateId: string;
    assetIds: string[];
    copiesPerAsset?: number;
    printerName?: string;
    paperSize?: string;
    outputType?: OutputType;
    organizationId?: string;
    createdBy: string;
}

// Update print job status DTO
export interface UpdatePrintJobStatusDto {
    status: PrintJobStatus;
    errorMessage?: string;
    outputUrl?: string;
}

// Update setting DTO
export interface UpdateSettingDto {
    settingValue: string;
    updatedBy: string;
}

// ==================== Query Interfaces ====================

// Template list query
export interface TemplateListQuery {
    page?: number;
    limit?: number;
    search?: string;
    labelType?: LabelType;
    isActive?: boolean;
    organizationId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Print job list query
export interface PrintJobListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: PrintJobStatus;
    templateId?: string;
    createdBy?: string;
    dateFrom?: string;
    dateTo?: string;
    organizationId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ==================== Result Types ====================

// Template result
export interface TemplateResult {
    success: boolean;
    template?: LabelTemplate;
    error?: string;
}

// Print job result
export interface PrintJobResult {
    success: boolean;
    job?: PrintJob;
    error?: string;
}

// Label generation result
export interface LabelGenerationResult {
    success: boolean;
    jobId?: string;
    outputUrl?: string;
    labelsGenerated?: number;
    error?: string;
}

// Label preview data
export interface LabelPreviewData {
    assetTag: string;
    assetName: string;
    serialNumber?: string;
    companyName?: string;
    companyLogoUrl?: string;
    purchaseDate?: string;
    category?: string;
    location?: string;
    assignedTo?: string;
    barcodeValue: string;
    qrcodeValue: string;
    customFields?: Record<string, string>;
}

// Field validation result
export interface FieldValidationResult {
    assetId: string;
    assetTag: string;
    missingFields: string[];
    emptyFields: string[];
}

// Batch validation result
export interface BatchValidationResult {
    valid: number;
    warnings: number;
    assets: FieldValidationResult[];
}

// Pagination wrapper
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
