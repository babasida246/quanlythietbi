/**
 * Labels Module - Service Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LabelsService } from './labels.service.js';
import { LabelsRepository } from './labels.repository.js';
import {
    LabelTemplate,
    LabelTemplateWithUsage,
    PrintJob,
    PrintJobWithDetails,
    LabelSetting,
    CreateTemplateDto,
    CreatePrintJobDto,
} from './labels.types.js';

// Mock repository
function createMockRepository() {
    return {
        createTemplate: vi.fn(),
        findTemplateById: vi.fn(),
        findTemplateByCode: vi.fn(),
        findDefaultTemplate: vi.fn(),
        updateTemplate: vi.fn(),
        deleteTemplate: vi.fn(),
        findAllTemplates: vi.fn(),
        setDefaultTemplate: vi.fn(),
        cloneTemplate: vi.fn(),
        hasActiveTemplates: vi.fn(),
        createPrintJob: vi.fn(),
        findPrintJobById: vi.fn(),
        findPrintJobByCode: vi.fn(),
        findPrintJobWithDetails: vi.fn(),
        updatePrintJobStatus: vi.fn(),
        findAllPrintJobs: vi.fn(),
        createPrintJobItems: vi.fn(),
        findPrintJobItems: vi.fn(),
        updatePrintJobItemStatus: vi.fn(),
        findAllSettings: vi.fn(),
        findSettingByKey: vi.fn(),
        upsertSetting: vi.fn(),
        getAssetLabelData: vi.fn(),
        validateAssetFields: vi.fn(),
        withTransaction: vi.fn(),
    } as unknown as LabelsRepository;
}

// Sample data
const sampleTemplate: LabelTemplate = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    templateCode: 'TPL-0001',
    name: 'Standard Label',
    description: 'Standard barcode label',
    labelType: 'barcode',
    sizePreset: 'medium',
    widthMm: 60,
    heightMm: 30,
    layout: { elements: [] },
    fields: ['asset_tag', 'name', 'barcode'],
    barcodeType: 'code128',
    includeLogo: false,
    includeCompanyName: false,
    fontFamily: 'Arial',
    fontSize: 10,
    isDefault: true,
    isActive: true,
    organizationId: undefined,
    createdBy: 'user-1',
    updatedBy: undefined,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
};

const sampleTemplateWithUsage: LabelTemplateWithUsage = {
    ...sampleTemplate,
    createdByName: 'John Doe',
    usageCount: 5,
};

const samplePrintJob: PrintJob = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    jobCode: 'PJ-20240101-0001',
    templateId: sampleTemplate.id,
    assetIds: ['asset-1', 'asset-2'],
    assetCount: 2,
    copiesPerAsset: 1,
    totalLabels: 2,
    printerName: undefined,
    paperSize: undefined,
    status: 'queued',
    errorMessage: undefined,
    outputType: 'pdf',
    outputUrl: undefined,
    startedAt: undefined,
    completedAt: undefined,
    organizationId: undefined,
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
};

const samplePrintJobWithDetails: PrintJobWithDetails = {
    ...samplePrintJob,
    templateName: 'Standard Label',
    labelType: 'barcode',
    sizePreset: 'medium',
    createdByName: 'John Doe',
    createdByEmail: 'john@example.com',
    durationSeconds: undefined,
};

const sampleSetting: LabelSetting = {
    id: 'setting-1',
    settingKey: 'qr_contains_url',
    settingValue: 'true',
    valueType: 'boolean',
    description: 'QR code contains asset URL',
    organizationId: undefined,
    updatedBy: undefined,
    updatedAt: new Date('2024-01-01T10:00:00Z'),
};

describe('LabelsService', () => {
    let repository: ReturnType<typeof createMockRepository>;
    let service: LabelsService;

    beforeEach(() => {
        repository = createMockRepository();
        service = new LabelsService(repository as unknown as LabelsRepository);
    });

    // ==================== Template Tests ====================

    describe('createTemplate', () => {
        it('should create a new template', async () => {
            repository.createTemplate.mockResolvedValue(sampleTemplate);

            const dto: CreateTemplateDto = {
                name: 'Standard Label',
                labelType: 'barcode',
                sizePreset: 'medium',
                widthMm: 60,
                heightMm: 30,
                fields: ['asset_tag', 'name', 'barcode'],
                createdBy: 'user-1',
            };

            const result = await service.createTemplate(dto);

            expect(result.success).toBe(true);
            expect(result.template).toBeDefined();
        });

        it('should reject if dimensions are not positive (LBL-R03)', async () => {
            const dto: CreateTemplateDto = {
                name: 'Invalid Template',
                labelType: 'barcode',
                sizePreset: 'custom',
                widthMm: 0,
                heightMm: 30,
                fields: ['asset_tag'],
                createdBy: 'user-1',
            };

            const result = await service.createTemplate(dto);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template dimensions must be positive');
        });

        it('should reject if no fields provided', async () => {
            const dto: CreateTemplateDto = {
                name: 'No Fields Template',
                labelType: 'barcode',
                sizePreset: 'medium',
                widthMm: 60,
                heightMm: 30,
                fields: [],
                createdBy: 'user-1',
            };

            const result = await service.createTemplate(dto);

            expect(result.success).toBe(false);
            expect(result.error).toBe('At least one field is required');
        });
    });

    describe('getTemplateById', () => {
        it('should return template by ID', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);

            const result = await service.getTemplateById(sampleTemplate.id);

            expect(result).toEqual(sampleTemplate);
        });

        it('should return null when not found', async () => {
            repository.findTemplateById.mockResolvedValue(null);

            const result = await service.getTemplateById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getDefaultTemplate', () => {
        it('should return default template', async () => {
            repository.findDefaultTemplate.mockResolvedValue(sampleTemplate);

            const result = await service.getDefaultTemplate();

            expect(result?.isDefault).toBe(true);
        });
    });

    describe('updateTemplate', () => {
        it('should update template', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            const updated = { ...sampleTemplate, name: 'Updated Label' };
            repository.updateTemplate.mockResolvedValue(updated);

            const result = await service.updateTemplate(sampleTemplate.id, {
                name: 'Updated Label',
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(result.template?.name).toBe('Updated Label');
        });

        it('should reject update with invalid dimensions', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);

            const result = await service.updateTemplate(sampleTemplate.id, {
                widthMm: -10,
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template dimensions must be positive');
        });

        it('should return error when template not found', async () => {
            repository.findTemplateById.mockResolvedValue(null);

            const result = await service.updateTemplate('non-existent', {
                name: 'Updated',
                updatedBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template not found');
        });
    });

    describe('deleteTemplate', () => {
        it('should delete template', async () => {
            const inactiveTemplate = { ...sampleTemplate, isActive: false };
            repository.findTemplateById.mockResolvedValue(inactiveTemplate);
            repository.deleteTemplate.mockResolvedValue(true);

            const result = await service.deleteTemplate(sampleTemplate.id);

            expect(result.success).toBe(true);
        });

        it('should reject deleting the only active template (LBL-R02)', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate); // isActive: true
            repository.hasActiveTemplates.mockResolvedValue(true);
            repository.findAllTemplates.mockResolvedValue({ data: [sampleTemplateWithUsage], total: 1 });

            const result = await service.deleteTemplate(sampleTemplate.id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot delete the only active template');
        });

        it('should allow deleting when other active templates exist', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.findAllTemplates.mockResolvedValue({
                data: [sampleTemplateWithUsage, { ...sampleTemplateWithUsage, id: 'other' }],
                total: 2,
            });
            repository.deleteTemplate.mockResolvedValue(true);

            const result = await service.deleteTemplate(sampleTemplate.id);

            expect(result.success).toBe(true);
        });
    });

    describe('getTemplates', () => {
        it('should return paginated templates', async () => {
            repository.findAllTemplates.mockResolvedValue({
                data: [sampleTemplateWithUsage],
                total: 10,
            });

            const result = await service.getTemplates({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(10);
            expect(result.pagination.totalPages).toBe(1);
        });
    });

    describe('setDefaultTemplate', () => {
        it('should set template as default', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.setDefaultTemplate.mockResolvedValue(true);

            const result = await service.setDefaultTemplate(sampleTemplate.id);

            expect(result.success).toBe(true);
        });

        it('should reject setting inactive template as default', async () => {
            const inactiveTemplate = { ...sampleTemplate, isActive: false };
            repository.findTemplateById.mockResolvedValue(inactiveTemplate);

            const result = await service.setDefaultTemplate(sampleTemplate.id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot set inactive template as default');
        });
    });

    describe('cloneTemplate', () => {
        it('should clone template', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            const cloned = { ...sampleTemplate, id: 'new-id', name: 'Cloned Label', isDefault: false };
            repository.cloneTemplate.mockResolvedValue(cloned);

            const result = await service.cloneTemplate(sampleTemplate.id, 'Cloned Label', 'user-1');

            expect(result.success).toBe(true);
            expect(result.template?.name).toBe('Cloned Label');
        });

        it('should return error when template not found', async () => {
            repository.findTemplateById.mockResolvedValue(null);

            const result = await service.cloneTemplate('non-existent', 'New Name', 'user-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template not found');
        });
    });

    describe('setTemplateActive', () => {
        it('should activate template', async () => {
            const inactiveTemplate = { ...sampleTemplate, isActive: false };
            repository.findTemplateById.mockResolvedValue(inactiveTemplate);
            repository.updateTemplate.mockResolvedValue({ ...inactiveTemplate, isActive: true });

            const result = await service.setTemplateActive(sampleTemplate.id, true, 'user-1');

            expect(result.success).toBe(true);
        });

        it('should reject deactivating the only active template (LBL-R02)', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.findAllTemplates.mockResolvedValue({ data: [sampleTemplateWithUsage], total: 1 });

            const result = await service.setTemplateActive(sampleTemplate.id, false, 'user-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot deactivate the only active template');
        });
    });

    // ==================== Print Job Tests ====================

    describe('createPrintJob', () => {
        it('should create a print job', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.findSettingByKey.mockResolvedValue({ settingValue: '500' });
            repository.withTransaction.mockImplementation(async (callback) => {
                return callback({} as any);
            });
            repository.createPrintJob.mockResolvedValue(samplePrintJob);
            repository.createPrintJobItems.mockResolvedValue(2);

            const dto: CreatePrintJobDto = {
                templateId: sampleTemplate.id,
                assetIds: ['asset-1', 'asset-2'],
                copiesPerAsset: 1,
                createdBy: 'user-1',
            };

            const result = await service.createPrintJob(dto);

            expect(result.success).toBe(true);
            expect(result.job).toBeDefined();
        });

        it('should reject if template not found', async () => {
            repository.findTemplateById.mockResolvedValue(null);

            const result = await service.createPrintJob({
                templateId: 'non-existent',
                assetIds: ['asset-1'],
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template not found');
        });

        it('should reject if template is not active', async () => {
            const inactiveTemplate = { ...sampleTemplate, isActive: false };
            repository.findTemplateById.mockResolvedValue(inactiveTemplate);

            const result = await service.createPrintJob({
                templateId: sampleTemplate.id,
                assetIds: ['asset-1'],
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template is not active');
        });

        it('should reject if no assets provided', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);

            const result = await service.createPrintJob({
                templateId: sampleTemplate.id,
                assetIds: [],
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('At least one asset is required');
        });

        it('should reject if exceeds batch size limit', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.findSettingByKey.mockResolvedValue({ settingValue: '10' });

            const manyAssets = Array.from({ length: 15 }, (_, i) => `asset-${i}`);

            const result = await service.createPrintJob({
                templateId: sampleTemplate.id,
                assetIds: manyAssets,
                createdBy: 'user-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Maximum 10 assets per job');
        });
    });

    describe('getPrintJobById', () => {
        it('should return print job by ID', async () => {
            repository.findPrintJobById.mockResolvedValue(samplePrintJob);

            const result = await service.getPrintJobById(samplePrintJob.id);

            expect(result).toEqual(samplePrintJob);
        });
    });

    describe('getPrintJobDetail', () => {
        it('should return print job with details', async () => {
            repository.findPrintJobWithDetails.mockResolvedValue(samplePrintJobWithDetails);

            const result = await service.getPrintJobDetail(samplePrintJob.id);

            expect(result?.templateName).toBe('Standard Label');
        });
    });

    describe('startPrintJob', () => {
        it('should start a queued job', async () => {
            repository.findPrintJobById.mockResolvedValue(samplePrintJob);
            const processingJob = { ...samplePrintJob, status: 'processing' as const };
            repository.updatePrintJobStatus.mockResolvedValue(processingJob);

            const result = await service.startPrintJob(samplePrintJob.id);

            expect(result.success).toBe(true);
            expect(result.job?.status).toBe('processing');
        });

        it('should reject if job is not queued', async () => {
            const processingJob = { ...samplePrintJob, status: 'processing' as const };
            repository.findPrintJobById.mockResolvedValue(processingJob);

            const result = await service.startPrintJob(samplePrintJob.id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Job is not in queued status');
        });
    });

    describe('completePrintJob', () => {
        it('should complete a processing job', async () => {
            const processingJob = { ...samplePrintJob, status: 'processing' as const };
            repository.findPrintJobById.mockResolvedValue(processingJob);
            const completedJob = { ...samplePrintJob, status: 'completed' as const };
            repository.updatePrintJobStatus.mockResolvedValue(completedJob);

            const result = await service.completePrintJob(samplePrintJob.id, 'https://example.com/label.pdf');

            expect(result.success).toBe(true);
            expect(result.job?.status).toBe('completed');
        });

        it('should reject if job is not processing', async () => {
            repository.findPrintJobById.mockResolvedValue(samplePrintJob); // queued

            const result = await service.completePrintJob(samplePrintJob.id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Job is not in processing status');
        });
    });

    describe('failPrintJob', () => {
        it('should mark job as failed', async () => {
            repository.findPrintJobById.mockResolvedValue(samplePrintJob);
            const failedJob = { ...samplePrintJob, status: 'failed' as const, errorMessage: 'Print error' };
            repository.updatePrintJobStatus.mockResolvedValue(failedJob);

            const result = await service.failPrintJob(samplePrintJob.id, 'Print error');

            expect(result.success).toBe(true);
            expect(result.job?.status).toBe('failed');
        });
    });

    describe('cancelPrintJob', () => {
        it('should cancel a queued job', async () => {
            repository.findPrintJobById.mockResolvedValue(samplePrintJob);
            const cancelledJob = { ...samplePrintJob, status: 'cancelled' as const };
            repository.updatePrintJobStatus.mockResolvedValue(cancelledJob);

            const result = await service.cancelPrintJob(samplePrintJob.id);

            expect(result.success).toBe(true);
            expect(result.job?.status).toBe('cancelled');
        });

        it('should reject cancelling a completed job', async () => {
            const completedJob = { ...samplePrintJob, status: 'completed' as const };
            repository.findPrintJobById.mockResolvedValue(completedJob);

            const result = await service.cancelPrintJob(samplePrintJob.id);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot cancel a completed or already cancelled job');
        });
    });

    describe('reprintJob', () => {
        it('should create a new job based on existing job', async () => {
            repository.findPrintJobById.mockResolvedValue(samplePrintJob);
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.findSettingByKey.mockResolvedValue({ settingValue: '500' });
            repository.withTransaction.mockImplementation(async (callback) => callback({} as any));
            const newJob = { ...samplePrintJob, id: 'new-job-id' };
            repository.createPrintJob.mockResolvedValue(newJob);
            repository.createPrintJobItems.mockResolvedValue(2);

            const result = await service.reprintJob(samplePrintJob.id, 'user-2');

            expect(result.success).toBe(true);
        });

        it('should return error when job not found', async () => {
            repository.findPrintJobById.mockResolvedValue(null);

            const result = await service.reprintJob('non-existent', 'user-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Print job not found');
        });
    });

    // ==================== Preview & Validation Tests ====================

    describe('generatePreview', () => {
        it('should generate label preview data', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.findSettingByKey
                .mockResolvedValueOnce({ settingValue: 'https://itam.example.com/assets/' })
                .mockResolvedValueOnce({ settingValue: 'true' });
            repository.getAssetLabelData.mockResolvedValue({
                'asset-1': {
                    asset_tag: 'LAP-001',
                    name: 'Dell Latitude',
                    serial: 'ABC123',
                },
            });

            const result = await service.generatePreview(sampleTemplate.id, ['asset-1']);

            expect(result).toHaveLength(1);
            expect(result[0].assetTag).toBe('LAP-001');
            expect(result[0].qrcodeValue).toBe('https://itam.example.com/assets/LAP-001');
        });

        it('should throw error when template not found', async () => {
            repository.findTemplateById.mockResolvedValue(null);

            await expect(service.generatePreview('non-existent', ['asset-1']))
                .rejects.toThrow('Template not found');
        });
    });

    describe('validateAssets', () => {
        it('should validate assets for label generation (LBL-R04)', async () => {
            repository.findTemplateById.mockResolvedValue(sampleTemplate);
            repository.validateAssetFields.mockResolvedValue([
                { assetId: 'asset-2', assetTag: 'LAP-002', missingFields: [], emptyFields: ['serial'] },
            ]);

            const result = await service.validateAssets(sampleTemplate.id, ['asset-1', 'asset-2']);

            expect(result.valid).toBe(1);
            expect(result.warnings).toBe(1);
            expect(result.assets[0].emptyFields).toContain('serial');
        });
    });

    // ==================== Settings Tests ====================

    describe('getSettings', () => {
        it('should return all settings', async () => {
            repository.findAllSettings.mockResolvedValue([sampleSetting]);

            const result = await service.getSettings();

            expect(result).toHaveLength(1);
        });
    });

    describe('getSettingValue', () => {
        it('should return setting value', async () => {
            repository.findSettingByKey.mockResolvedValue(sampleSetting);

            const result = await service.getSettingValue('qr_contains_url');

            expect(result).toBe('true');
        });

        it('should return undefined when setting not found', async () => {
            repository.findSettingByKey.mockResolvedValue(null);

            const result = await service.getSettingValue('non_existent');

            expect(result).toBeUndefined();
        });
    });

    describe('updateSetting', () => {
        it('should update setting', async () => {
            const updatedSetting = { ...sampleSetting, settingValue: 'false' };
            repository.upsertSetting.mockResolvedValue(updatedSetting);

            const result = await service.updateSetting('qr_contains_url', 'false', 'user-1');

            expect(result.settingValue).toBe('false');
        });
    });

    // ==================== Statistics Tests ====================

    describe('getStatistics', () => {
        it('should return label statistics', async () => {
            repository.findAllTemplates
                .mockResolvedValueOnce({ data: [], total: 10 }) // all
                .mockResolvedValueOnce({ data: [], total: 8 }); // active
            repository.findAllPrintJobs
                .mockResolvedValueOnce({ data: [], total: 50 }) // all
                .mockResolvedValueOnce({ data: [samplePrintJobWithDetails], total: 5 }); // recent

            const result = await service.getStatistics();

            expect(result.totalTemplates).toBe(10);
            expect(result.activeTemplates).toBe(8);
            expect(result.totalPrintJobs).toBe(50);
            expect(result.recentJobs).toHaveLength(1);
        });
    });
});
