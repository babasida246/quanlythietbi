/**
 * Labels Module - Service Layer
 */

import { LabelsRepository } from './labels.repository.js';
import {
    LabelTemplate,
    LabelTemplateWithUsage,
    PrintJob,
    PrintJobWithDetails,
    PrintJobItemWithDetails,
    LabelSetting,
    CreateTemplateDto,
    UpdateTemplateDto,
    CreatePrintJobDto,
    TemplateListQuery,
    PrintJobListQuery,
    TemplateResult,
    PrintJobResult,
    LabelGenerationResult,
    LabelPreviewData,
    BatchValidationResult,
    PaginatedResult,
} from './labels.types.js';

export class LabelsService {
    constructor(private repository: LabelsRepository) { }

    // ==================== Template Operations ====================

    /**
     * Create a new label template
     * LBL-R02: At least one template must be active
     * LBL-R03: Template dimensions must be positive
     */
    async createTemplate(dto: CreateTemplateDto): Promise<TemplateResult> {
        // LBL-R03: Validate dimensions
        if (dto.widthMm <= 0 || dto.heightMm <= 0) {
            return { success: false, error: 'Template dimensions must be positive' };
        }

        // Validate fields array
        if (!dto.fields || dto.fields.length === 0) {
            return { success: false, error: 'At least one field is required' };
        }

        try {
            const template = await this.repository.createTemplate(dto);
            return { success: true, template };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Get template by ID
     */
    async getTemplateById(id: string): Promise<LabelTemplate | null> {
        return this.repository.findTemplateById(id);
    }

    /**
     * Get template by code
     */
    async getTemplateByCode(code: string): Promise<LabelTemplate | null> {
        return this.repository.findTemplateByCode(code);
    }

    /**
     * Get default template
     */
    async getDefaultTemplate(organizationId?: string): Promise<LabelTemplate | null> {
        return this.repository.findDefaultTemplate(organizationId);
    }

    /**
     * Update template
     */
    async updateTemplate(id: string, dto: UpdateTemplateDto): Promise<TemplateResult> {
        const existing = await this.repository.findTemplateById(id);
        if (!existing) {
            return { success: false, error: 'Template not found' };
        }

        // Validate dimensions if provided
        if ((dto.widthMm !== undefined && dto.widthMm <= 0) ||
            (dto.heightMm !== undefined && dto.heightMm <= 0)) {
            return { success: false, error: 'Template dimensions must be positive' };
        }

        try {
            const template = await this.repository.updateTemplate(id, dto);
            return { success: true, template: template || undefined };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Delete template
     * LBL-R02: Must have at least one active template
     */
    async deleteTemplate(id: string): Promise<TemplateResult> {
        const existing = await this.repository.findTemplateById(id);
        if (!existing) {
            return { success: false, error: 'Template not found' };
        }

        // Check if this is the only active template
        if (existing.isActive) {
            const hasOtherActive = await this.repository.hasActiveTemplates();
            // We need to check if there are other active templates besides this one
            const templates = await this.repository.findAllTemplates({ isActive: true, limit: 2 });
            if (templates.total <= 1) {
                return { success: false, error: 'Cannot delete the only active template' };
            }
        }

        const deleted = await this.repository.deleteTemplate(id);
        return { success: deleted };
    }

    /**
     * List templates with pagination
     */
    async getTemplates(query: TemplateListQuery): Promise<PaginatedResult<LabelTemplateWithUsage>> {
        const { page = 1, limit = 20 } = query;
        const result = await this.repository.findAllTemplates(query);

        return {
            data: result.data,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    /**
     * Set template as default
     */
    async setDefaultTemplate(id: string, organizationId?: string): Promise<TemplateResult> {
        const template = await this.repository.findTemplateById(id);
        if (!template) {
            return { success: false, error: 'Template not found' };
        }

        if (!template.isActive) {
            return { success: false, error: 'Cannot set inactive template as default' };
        }

        const success = await this.repository.setDefaultTemplate(id, organizationId);
        return { success };
    }

    /**
     * Clone template
     */
    async cloneTemplate(id: string, newName: string, createdBy: string): Promise<TemplateResult> {
        const existing = await this.repository.findTemplateById(id);
        if (!existing) {
            return { success: false, error: 'Template not found' };
        }

        const template = await this.repository.cloneTemplate(id, newName, createdBy);
        return { success: !!template, template: template || undefined };
    }

    /**
     * Activate/Deactivate template
     */
    async setTemplateActive(id: string, isActive: boolean, updatedBy: string): Promise<TemplateResult> {
        const existing = await this.repository.findTemplateById(id);
        if (!existing) {
            return { success: false, error: 'Template not found' };
        }

        // LBL-R02: Check if deactivating the only active template
        if (!isActive && existing.isActive) {
            const templates = await this.repository.findAllTemplates({ isActive: true, limit: 2 });
            if (templates.total <= 1) {
                return { success: false, error: 'Cannot deactivate the only active template' };
            }
        }

        const template = await this.repository.updateTemplate(id, { isActive, updatedBy });
        return { success: true, template: template || undefined };
    }

    // ==================== Print Job Operations ====================

    /**
     * Create and start a print job
     * LBL-R05: Print log required
     */
    async createPrintJob(dto: CreatePrintJobDto): Promise<PrintJobResult> {
        // Validate template exists and is active
        const template = await this.repository.findTemplateById(dto.templateId);
        if (!template) {
            return { success: false, error: 'Template not found' };
        }
        if (!template.isActive) {
            return { success: false, error: 'Template is not active' };
        }

        // Validate assets exist
        if (dto.assetIds.length === 0) {
            return { success: false, error: 'At least one asset is required' };
        }

        // Check batch size limit
        const maxBatchSize = await this.getSettingValue('max_batch_size', dto.organizationId);
        const maxSize = parseInt(maxBatchSize || '500', 10);
        if (dto.assetIds.length > maxSize) {
            return { success: false, error: `Maximum ${maxSize} assets per job` };
        }

        try {
            const job = await this.repository.withTransaction(async (client) => {
                // Create the job
                const printJob = await this.repository.createPrintJob(dto, client);

                // Create individual job items
                await this.repository.createPrintJobItems(
                    printJob.id,
                    dto.assetIds,
                    dto.copiesPerAsset || 1
                );

                return printJob;
            });

            return { success: true, job };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Get print job by ID
     */
    async getPrintJobById(id: string): Promise<PrintJob | null> {
        return this.repository.findPrintJobById(id);
    }

    /**
     * Get print job with details
     */
    async getPrintJobDetail(id: string): Promise<PrintJobWithDetails | null> {
        return this.repository.findPrintJobWithDetails(id);
    }

    /**
     * List print jobs with pagination
     */
    async getPrintJobs(query: PrintJobListQuery): Promise<PaginatedResult<PrintJobWithDetails>> {
        const { page = 1, limit = 20 } = query;
        const result = await this.repository.findAllPrintJobs(query);

        return {
            data: result.data,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    /**
     * Get print job items
     */
    async getPrintJobItems(jobId: string): Promise<PrintJobItemWithDetails[]> {
        return this.repository.findPrintJobItems(jobId);
    }

    /**
     * Start processing a print job
     */
    async startPrintJob(id: string): Promise<PrintJobResult> {
        const job = await this.repository.findPrintJobById(id);
        if (!job) {
            return { success: false, error: 'Print job not found' };
        }

        if (job.status !== 'queued') {
            return { success: false, error: 'Job is not in queued status' };
        }

        const updated = await this.repository.updatePrintJobStatus(id, { status: 'processing' });
        return { success: true, job: updated || undefined };
    }

    /**
     * Complete a print job
     */
    async completePrintJob(id: string, outputUrl?: string): Promise<PrintJobResult> {
        const job = await this.repository.findPrintJobById(id);
        if (!job) {
            return { success: false, error: 'Print job not found' };
        }

        if (job.status !== 'processing') {
            return { success: false, error: 'Job is not in processing status' };
        }

        const updated = await this.repository.updatePrintJobStatus(id, {
            status: 'completed',
            outputUrl,
        });
        return { success: true, job: updated || undefined };
    }

    /**
     * Fail a print job
     */
    async failPrintJob(id: string, errorMessage: string): Promise<PrintJobResult> {
        const job = await this.repository.findPrintJobById(id);
        if (!job) {
            return { success: false, error: 'Print job not found' };
        }

        const updated = await this.repository.updatePrintJobStatus(id, {
            status: 'failed',
            errorMessage,
        });
        return { success: true, job: updated || undefined };
    }

    /**
     * Cancel a print job
     */
    async cancelPrintJob(id: string): Promise<PrintJobResult> {
        const job = await this.repository.findPrintJobById(id);
        if (!job) {
            return { success: false, error: 'Print job not found' };
        }

        if (job.status === 'completed' || job.status === 'cancelled') {
            return { success: false, error: 'Cannot cancel a completed or already cancelled job' };
        }

        const updated = await this.repository.updatePrintJobStatus(id, { status: 'cancelled' });
        return { success: true, job: updated || undefined };
    }

    /**
     * Reprint a completed job
     */
    async reprintJob(id: string, createdBy: string): Promise<PrintJobResult> {
        const job = await this.repository.findPrintJobById(id);
        if (!job) {
            return { success: false, error: 'Print job not found' };
        }

        // Create a new job with the same parameters
        return this.createPrintJob({
            templateId: job.templateId,
            assetIds: job.assetIds,
            copiesPerAsset: job.copiesPerAsset,
            printerName: job.printerName,
            paperSize: job.paperSize,
            outputType: job.outputType,
            organizationId: job.organizationId,
            createdBy,
        });
    }

    // ==================== Label Generation ====================

    /**
     * Generate label preview data for assets
     * LBL-R04: Warn if asset missing required fields
     */
    async generatePreview(templateId: string, assetIds: string[]): Promise<LabelPreviewData[]> {
        const template = await this.repository.findTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const assetData = await this.repository.getAssetLabelData(assetIds);
        const qrBaseUrl = await this.getSettingValue('qr_base_url') || '';
        const qrContainsUrl = await this.getSettingValue('qr_contains_url') === 'true';

        const previews: LabelPreviewData[] = [];
        for (const assetId of assetIds) {
            const data = assetData[assetId];
            if (!data) continue;

            const assetTag = data.asset_tag as string;
            previews.push({
                assetTag,
                assetName: data.name as string,
                serialNumber: data.serial as string | undefined,
                companyName: data.company_name as string | undefined,
                companyLogoUrl: data.company_logo as string | undefined,
                purchaseDate: data.purchase_date as string | undefined,
                category: data.category as string | undefined,
                location: data.location as string | undefined,
                assignedTo: data.assigned_to as string | undefined,
                barcodeValue: assetTag,
                qrcodeValue: qrContainsUrl ? `${qrBaseUrl}${assetTag}` : assetTag,
            });
        }

        return previews;
    }

    /**
     * Validate assets for label generation
     * LBL-R04: Check if assets have all required fields
     */
    async validateAssets(templateId: string, assetIds: string[]): Promise<BatchValidationResult> {
        const template = await this.repository.findTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const validationResults = await this.repository.validateAssetFields(assetIds, template.fields);

        return {
            valid: assetIds.length - validationResults.length,
            warnings: validationResults.length,
            assets: validationResults,
        };
    }

    // ==================== Settings Operations ====================

    /**
     * Get all settings
     */
    async getSettings(organizationId?: string): Promise<LabelSetting[]> {
        return this.repository.findAllSettings(organizationId);
    }

    /**
     * Get setting value
     */
    async getSettingValue(key: string, organizationId?: string): Promise<string | undefined> {
        const setting = await this.repository.findSettingByKey(key, organizationId);
        return setting?.settingValue;
    }

    /**
     * Update setting
     */
    async updateSetting(key: string, value: string, updatedBy: string, organizationId?: string): Promise<LabelSetting> {
        return this.repository.upsertSetting(key, value, updatedBy, organizationId);
    }

    // ==================== Statistics ====================

    /**
     * Get label statistics
     */
    async getStatistics(organizationId?: string): Promise<{
        totalTemplates: number;
        activeTemplates: number;
        totalPrintJobs: number;
        totalLabelsGenerated: number;
        recentJobs: PrintJobWithDetails[];
    }> {
        const [allTemplates, activeTemplates, allJobs, recentJobsResult] = await Promise.all([
            this.repository.findAllTemplates({ organizationId, limit: 1 }),
            this.repository.findAllTemplates({ organizationId, isActive: true, limit: 1 }),
            this.repository.findAllPrintJobs({ organizationId, limit: 1 }),
            this.repository.findAllPrintJobs({ organizationId, limit: 5, sortBy: 'created_at', sortOrder: 'desc' }),
        ]);

        // Calculate total labels from recent jobs (simplified - in production would be a separate query)
        const totalLabels = recentJobsResult.data.reduce((sum, job) => sum + job.totalLabels, 0);

        return {
            totalTemplates: allTemplates.total,
            activeTemplates: activeTemplates.total,
            totalPrintJobs: allJobs.total,
            totalLabelsGenerated: totalLabels,
            recentJobs: recentJobsResult.data,
        };
    }
}
