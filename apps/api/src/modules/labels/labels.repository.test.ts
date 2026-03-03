/**
 * Labels Module - Repository Layer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LabelsRepository } from './labels.repository.js';
import { Pool, PoolClient, QueryResult } from 'pg';
import { CreateTemplateDto, CreatePrintJobDto } from './labels.types.js';

// Mock Pool
function createMockPool() {
    const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
    };
    return {
        query: vi.fn(),
        connect: vi.fn().mockResolvedValue(mockClient),
        mockClient,
    } as unknown as Pool & { mockClient: PoolClient };
}

// Sample data
const sampleTemplateRow = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    template_code: 'TPL-0001',
    name: 'Standard Label',
    description: 'Standard barcode label',
    label_type: 'barcode',
    size_preset: 'medium',
    width_mm: '60.00',
    height_mm: '30.00',
    layout: { elements: [] },
    fields: ['asset_tag', 'name', 'barcode'],
    barcode_type: 'code128',
    include_logo: false,
    include_company_name: false,
    font_family: 'Arial',
    font_size: 10,
    is_default: true,
    is_active: true,
    organization_id: null,
    created_by: 'user-1',
    updated_by: null,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
};

const samplePrintJobRow = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    job_code: 'PJ-20240101-0001',
    template_id: sampleTemplateRow.id,
    asset_ids: ['asset-1', 'asset-2'],
    asset_count: 2,
    copies_per_asset: 1,
    total_labels: 2,
    printer_name: null,
    paper_size: null,
    status: 'queued',
    error_message: null,
    output_type: 'pdf',
    output_url: null,
    started_at: null,
    completed_at: null,
    organization_id: null,
    created_by: 'user-1',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
};

const sampleSettingRow = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    setting_key: 'qr_contains_url',
    setting_value: 'true',
    value_type: 'boolean',
    description: 'QR code contains asset URL',
    organization_id: null,
    updated_by: null,
    updated_at: '2024-01-01T10:00:00Z',
};

describe('LabelsRepository', () => {
    let pool: ReturnType<typeof createMockPool>;
    let repository: LabelsRepository;

    beforeEach(() => {
        pool = createMockPool();
        repository = new LabelsRepository(pool as unknown as Pool);
    });

    // ==================== Template Tests ====================

    describe('createTemplate', () => {
        it('should create a template and return it', async () => {
            pool.query.mockResolvedValue({ rows: [sampleTemplateRow] } as QueryResult);

            const dto: CreateTemplateDto = {
                name: 'Standard Label',
                labelType: 'barcode',
                sizePreset: 'medium',
                widthMm: 60,
                heightMm: 30,
                fields: ['asset_tag', 'name', 'barcode'],
                createdBy: 'user-1',
            };

            const result = await repository.createTemplate(dto);

            expect(result.id).toBe(sampleTemplateRow.id);
            expect(result.name).toBe('Standard Label');
            expect(result.labelType).toBe('barcode');
            expect(pool.query).toHaveBeenCalled();
        });
    });

    describe('findTemplateById', () => {
        it('should return template when found', async () => {
            pool.query.mockResolvedValue({ rows: [sampleTemplateRow] } as QueryResult);

            const result = await repository.findTemplateById(sampleTemplateRow.id);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(sampleTemplateRow.id);
        });

        it('should return null when not found', async () => {
            pool.query.mockResolvedValue({ rows: [] } as QueryResult);

            const result = await repository.findTemplateById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findTemplateByCode', () => {
        it('should return template when found by code', async () => {
            pool.query.mockResolvedValue({ rows: [sampleTemplateRow] } as QueryResult);

            const result = await repository.findTemplateByCode('TPL-0001');

            expect(result?.templateCode).toBe('TPL-0001');
        });
    });

    describe('findDefaultTemplate', () => {
        it('should return default template', async () => {
            pool.query.mockResolvedValue({ rows: [sampleTemplateRow] } as QueryResult);

            const result = await repository.findDefaultTemplate();

            expect(result?.isDefault).toBe(true);
        });
    });

    describe('updateTemplate', () => {
        it('should update template fields', async () => {
            const updatedRow = { ...sampleTemplateRow, name: 'Updated Label' };
            pool.query.mockResolvedValue({ rows: [updatedRow] } as QueryResult);

            const result = await repository.updateTemplate(sampleTemplateRow.id, {
                name: 'Updated Label',
                updatedBy: 'user-1',
            });

            expect(result?.name).toBe('Updated Label');
        });
    });

    describe('deleteTemplate', () => {
        it('should delete template and return true', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 } as QueryResult);

            const result = await repository.deleteTemplate(sampleTemplateRow.id);

            expect(result).toBe(true);
        });

        it('should return false when template not found', async () => {
            pool.query.mockResolvedValue({ rowCount: 0 } as QueryResult);

            const result = await repository.deleteTemplate('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('findAllTemplates', () => {
        it('should return paginated templates', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '10' }] } as QueryResult)
                .mockResolvedValueOnce({
                    rows: [{ ...sampleTemplateRow, created_by_name: 'John Doe', usage_count: '5' }],
                } as QueryResult);

            const result = await repository.findAllTemplates({ page: 1, limit: 20 });

            expect(result.total).toBe(10);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].usageCount).toBe(5);
        });

        it('should filter by labelType', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] } as QueryResult)
                .mockResolvedValueOnce({ rows: [{ ...sampleTemplateRow, usage_count: '3' }] } as QueryResult);

            const result = await repository.findAllTemplates({ labelType: 'barcode' });

            expect(result.total).toBe(5);
        });
    });

    describe('setDefaultTemplate', () => {
        it('should set template as default', async () => {
            const client = pool.mockClient;
            (client.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}) // Clear existing
                .mockResolvedValueOnce({ rowCount: 1 }) // Set new
                .mockResolvedValueOnce({}); // COMMIT

            const result = await repository.setDefaultTemplate(sampleTemplateRow.id);

            expect(result).toBe(true);
            expect(client.release).toHaveBeenCalled();
        });
    });

    describe('cloneTemplate', () => {
        it('should clone template with new name', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [sampleTemplateRow] } as QueryResult) // findById
                .mockResolvedValueOnce({ rows: [{ ...sampleTemplateRow, name: 'Cloned Label' }] } as QueryResult); // create

            const result = await repository.cloneTemplate(sampleTemplateRow.id, 'Cloned Label', 'user-2');

            expect(result?.name).toBe('Cloned Label');
        });

        it('should return null when original not found', async () => {
            pool.query.mockResolvedValueOnce({ rows: [] } as QueryResult);

            const result = await repository.cloneTemplate('non-existent', 'New Name', 'user-1');

            expect(result).toBeNull();
        });
    });

    describe('hasActiveTemplates', () => {
        it('should return true if active templates exist', async () => {
            pool.query.mockResolvedValue({ rows: [{ id: '1' }] } as QueryResult);

            const result = await repository.hasActiveTemplates();

            expect(result).toBe(true);
        });

        it('should return false if no active templates', async () => {
            pool.query.mockResolvedValue({ rows: [] } as QueryResult);

            const result = await repository.hasActiveTemplates();

            expect(result).toBe(false);
        });
    });

    // ==================== Print Job Tests ====================

    describe('createPrintJob', () => {
        it('should create a print job and return it', async () => {
            pool.query.mockResolvedValue({ rows: [samplePrintJobRow] } as QueryResult);

            const dto: CreatePrintJobDto = {
                templateId: sampleTemplateRow.id,
                assetIds: ['asset-1', 'asset-2'],
                copiesPerAsset: 1,
                createdBy: 'user-1',
            };

            const result = await repository.createPrintJob(dto);

            expect(result.id).toBe(samplePrintJobRow.id);
            expect(result.assetCount).toBe(2);
            expect(result.status).toBe('queued');
        });
    });

    describe('findPrintJobById', () => {
        it('should return print job when found', async () => {
            pool.query.mockResolvedValue({ rows: [samplePrintJobRow] } as QueryResult);

            const result = await repository.findPrintJobById(samplePrintJobRow.id);

            expect(result?.id).toBe(samplePrintJobRow.id);
        });

        it('should return null when not found', async () => {
            pool.query.mockResolvedValue({ rows: [] } as QueryResult);

            const result = await repository.findPrintJobById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('findPrintJobByCode', () => {
        it('should return print job when found by code', async () => {
            pool.query.mockResolvedValue({ rows: [samplePrintJobRow] } as QueryResult);

            const result = await repository.findPrintJobByCode('PJ-20240101-0001');

            expect(result?.jobCode).toBe('PJ-20240101-0001');
        });
    });

    describe('updatePrintJobStatus', () => {
        it('should update job status to processing', async () => {
            const processingRow = { ...samplePrintJobRow, status: 'processing' };
            pool.query.mockResolvedValue({ rows: [processingRow] } as QueryResult);

            const result = await repository.updatePrintJobStatus(samplePrintJobRow.id, {
                status: 'processing',
            });

            expect(result?.status).toBe('processing');
        });

        it('should update job status to completed with output URL', async () => {
            const completedRow = { ...samplePrintJobRow, status: 'completed', output_url: 'https://example.com/label.pdf' };
            pool.query.mockResolvedValue({ rows: [completedRow] } as QueryResult);

            const result = await repository.updatePrintJobStatus(samplePrintJobRow.id, {
                status: 'completed',
                outputUrl: 'https://example.com/label.pdf',
            });

            expect(result?.status).toBe('completed');
            expect(result?.outputUrl).toBe('https://example.com/label.pdf');
        });

        it('should update job status to failed with error message', async () => {
            const failedRow = { ...samplePrintJobRow, status: 'failed', error_message: 'Print error' };
            pool.query.mockResolvedValue({ rows: [failedRow] } as QueryResult);

            const result = await repository.updatePrintJobStatus(samplePrintJobRow.id, {
                status: 'failed',
                errorMessage: 'Print error',
            });

            expect(result?.status).toBe('failed');
            expect(result?.errorMessage).toBe('Print error');
        });
    });

    describe('findAllPrintJobs', () => {
        it('should return paginated print jobs', async () => {
            const jobWithDetails = {
                ...samplePrintJobRow,
                template_name: 'Standard Label',
                label_type: 'barcode',
                size_preset: 'medium',
                created_by_name: 'John Doe',
                created_by_email: 'john@example.com',
                duration_seconds: null,
            };
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '25' }] } as QueryResult)
                .mockResolvedValueOnce({ rows: [jobWithDetails] } as QueryResult);

            const result = await repository.findAllPrintJobs({ page: 1, limit: 20 });

            expect(result.total).toBe(25);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].templateName).toBe('Standard Label');
        });

        it('should filter by status', async () => {
            pool.query
                .mockResolvedValueOnce({ rows: [{ count: '5' }] } as QueryResult)
                .mockResolvedValueOnce({ rows: [] } as QueryResult);

            const result = await repository.findAllPrintJobs({ status: 'completed' });

            expect(result.total).toBe(5);
        });
    });

    // ==================== Print Job Items Tests ====================

    describe('createPrintJobItems', () => {
        it('should create print job items', async () => {
            pool.query.mockResolvedValue({ rowCount: 4 } as QueryResult);

            const result = await repository.createPrintJobItems(
                samplePrintJobRow.id,
                ['asset-1', 'asset-2'],
                2
            );

            expect(result).toBe(4); // 2 assets * 2 copies
        });

        it('should return 0 for empty asset list', async () => {
            const result = await repository.createPrintJobItems(
                samplePrintJobRow.id,
                [],
                1
            );

            expect(result).toBe(0);
        });
    });

    describe('findPrintJobItems', () => {
        it('should return print job items with asset details', async () => {
            const itemRow = {
                id: 'item-1',
                print_job_id: samplePrintJobRow.id,
                asset_id: 'asset-1',
                copy_number: 1,
                status: 'pending',
                error_message: null,
                label_data: null,
                created_at: '2024-01-01T10:00:00Z',
                asset_tag: 'LAP-001',
                asset_name: 'Dell Latitude',
                serial_number: 'ABC123',
                category_name: 'Laptop',
                location_name: 'Floor 1',
                assigned_to_name: 'John Doe',
            };
            pool.query.mockResolvedValue({ rows: [itemRow] } as QueryResult);

            const result = await repository.findPrintJobItems(samplePrintJobRow.id);

            expect(result).toHaveLength(1);
            expect(result[0].assetTag).toBe('LAP-001');
            expect(result[0].assetName).toBe('Dell Latitude');
        });
    });

    describe('updatePrintJobItemStatus', () => {
        it('should update item status', async () => {
            pool.query.mockResolvedValue({ rowCount: 1 } as QueryResult);

            const result = await repository.updatePrintJobItemStatus('item-1', 'generated');

            expect(result).toBe(true);
        });
    });

    // ==================== Settings Tests ====================

    describe('findAllSettings', () => {
        it('should return all settings', async () => {
            pool.query.mockResolvedValue({ rows: [sampleSettingRow] } as QueryResult);

            const result = await repository.findAllSettings();

            expect(result).toHaveLength(1);
            expect(result[0].settingKey).toBe('qr_contains_url');
        });
    });

    describe('findSettingByKey', () => {
        it('should return setting when found', async () => {
            pool.query.mockResolvedValue({ rows: [sampleSettingRow] } as QueryResult);

            const result = await repository.findSettingByKey('qr_contains_url');

            expect(result?.settingValue).toBe('true');
        });

        it('should return null when not found', async () => {
            pool.query.mockResolvedValue({ rows: [] } as QueryResult);

            const result = await repository.findSettingByKey('non_existent_key');

            expect(result).toBeNull();
        });
    });

    describe('upsertSetting', () => {
        it('should insert or update setting', async () => {
            const updatedRow = { ...sampleSettingRow, setting_value: 'false' };
            pool.query.mockResolvedValue({ rows: [updatedRow] } as QueryResult);

            const result = await repository.upsertSetting('qr_contains_url', 'false', 'user-1');

            expect(result.settingValue).toBe('false');
        });
    });

    // ==================== Asset Data Tests ====================

    describe('getAssetLabelData', () => {
        it('should return asset data for labels', async () => {
            const assetRow = {
                id: 'asset-1',
                asset_tag: 'LAP-001',
                name: 'Dell Latitude 5520',
                serial_number: 'ABC123',
                category: 'Laptop',
                location: 'Floor 1',
                assigned_to: 'John Doe',
                purchase_date: '2024-01-15',
                company_name: 'ACME Corp',
                company_logo: 'https://example.com/logo.png',
            };
            pool.query.mockResolvedValue({ rows: [assetRow] } as QueryResult);

            const result = await repository.getAssetLabelData(['asset-1']);

            expect(result['asset-1']).toBeDefined();
            expect(result['asset-1'].asset_tag).toBe('LAP-001');
            expect(result['asset-1'].name).toBe('Dell Latitude 5520');
        });

        it('should return empty object for empty asset list', async () => {
            const result = await repository.getAssetLabelData([]);

            expect(result).toEqual({});
        });
    });

    describe('validateAssetFields', () => {
        it('should identify assets with empty fields', async () => {
            const assetRow = {
                id: 'asset-1',
                asset_tag: 'LAP-001',
                name: 'Dell Latitude',
                serial_number: null, // Empty field
                category: 'Laptop',
                location: null, // Empty field
            };
            pool.query.mockResolvedValue({ rows: [assetRow] } as QueryResult);

            const result = await repository.validateAssetFields(
                ['asset-1'],
                ['asset_tag', 'name', 'serial', 'location']
            );

            expect(result).toHaveLength(1);
            expect(result[0].emptyFields).toContain('serial');
            expect(result[0].emptyFields).toContain('location');
        });
    });

    // ==================== Transaction Tests ====================

    describe('withTransaction', () => {
        it('should commit transaction on success', async () => {
            const client = pool.mockClient;
            (client.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}); // COMMIT

            await repository.withTransaction(async () => {
                return 'success';
            });

            expect(client.query).toHaveBeenCalledWith('BEGIN');
            expect(client.query).toHaveBeenCalledWith('COMMIT');
            expect(client.release).toHaveBeenCalled();
        });

        it('should rollback transaction on error', async () => {
            const client = pool.mockClient;
            (client.query as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({}); // ROLLBACK

            await expect(
                repository.withTransaction(async () => {
                    throw new Error('Test error');
                })
            ).rejects.toThrow('Test error');

            expect(client.query).toHaveBeenCalledWith('BEGIN');
            expect(client.query).toHaveBeenCalledWith('ROLLBACK');
            expect(client.release).toHaveBeenCalled();
        });
    });
});
