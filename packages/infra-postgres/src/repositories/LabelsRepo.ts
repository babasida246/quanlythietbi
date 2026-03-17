/**
 * Labels Module - Repository Layer
 * Migrated from apps/api/src/modules/labels/labels.repository.ts
 */

import type { PoolClient } from 'pg';
import type { PgClient } from '../PgClient.js';
import type {
    LabelTemplate,
    LabelTemplateWithUsage,
    PrintJob,
    PrintJobWithDetails,
    PrintJobItem,
    PrintJobItemWithDetails,
    LabelSetting,
    CreateTemplateDto,
    UpdateTemplateDto,
    CreatePrintJobDto,
    UpdatePrintJobStatusDto,
    TemplateListQuery,
    PrintJobListQuery,
    LabelLayout,
    LabelFieldId,
} from '@qltb/contracts';

export class LabelsRepository {
    constructor(private db: PgClient) { }

    // ==================== Template Operations ====================

    async createTemplate(dto: CreateTemplateDto, client?: PoolClient): Promise<LabelTemplate> {
        const db = client ?? (this.db as unknown as PoolClient);
        const result = await db.query(
            `INSERT INTO label_templates (
                name, description, label_type, size_preset, width_mm, height_mm,
                layout, fields, barcode_type, include_logo, include_company_name,
                font_family, font_size, is_default, organization_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                dto.name,
                dto.description,
                dto.labelType,
                dto.sizePreset,
                dto.widthMm,
                dto.heightMm,
                JSON.stringify(dto.layout || { elements: [] }),
                JSON.stringify(dto.fields),
                dto.barcodeType || 'code128',
                dto.includeLogo || false,
                dto.includeCompanyName || false,
                dto.fontFamily || 'Arial',
                dto.fontSize || 10,
                dto.isDefault || false,
                dto.organizationId,
                dto.createdBy,
            ]
        );
        return this.mapTemplate(result.rows[0]);
    }

    async findTemplateById(id: string): Promise<LabelTemplate | null> {
        const result = await this.db.query(
            'SELECT * FROM label_templates WHERE id = $1',
            [id]
        );
        return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
    }

    async findTemplateByCode(code: string): Promise<LabelTemplate | null> {
        const result = await this.db.query(
            'SELECT * FROM label_templates WHERE template_code = $1',
            [code]
        );
        return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
    }

    async findDefaultTemplate(organizationId?: string): Promise<LabelTemplate | null> {
        const result = await this.db.query(
            `SELECT * FROM label_templates 
             WHERE is_default = true AND is_active = true
             AND ($1::uuid IS NULL OR organization_id = $1 OR organization_id IS NULL)
             ORDER BY organization_id NULLS LAST
             LIMIT 1`,
            [organizationId]
        );
        return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
    }

    async updateTemplate(id: string, dto: UpdateTemplateDto): Promise<LabelTemplate | null> {
        const fields: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            fields.push(`name = $${paramIndex++}`);
            values.push(dto.name);
        }
        if (dto.description !== undefined) {
            fields.push(`description = $${paramIndex++}`);
            values.push(dto.description);
        }
        if (dto.labelType !== undefined) {
            fields.push(`label_type = $${paramIndex++}`);
            values.push(dto.labelType);
        }
        if (dto.sizePreset !== undefined) {
            fields.push(`size_preset = $${paramIndex++}`);
            values.push(dto.sizePreset);
        }
        if (dto.widthMm !== undefined) {
            fields.push(`width_mm = $${paramIndex++}`);
            values.push(dto.widthMm);
        }
        if (dto.heightMm !== undefined) {
            fields.push(`height_mm = $${paramIndex++}`);
            values.push(dto.heightMm);
        }
        if (dto.layout !== undefined) {
            fields.push(`layout = $${paramIndex++}`);
            values.push(JSON.stringify(dto.layout));
        }
        if (dto.fields !== undefined) {
            fields.push(`fields = $${paramIndex++}`);
            values.push(JSON.stringify(dto.fields));
        }
        if (dto.barcodeType !== undefined) {
            fields.push(`barcode_type = $${paramIndex++}`);
            values.push(dto.barcodeType);
        }
        if (dto.includeLogo !== undefined) {
            fields.push(`include_logo = $${paramIndex++}`);
            values.push(dto.includeLogo);
        }
        if (dto.includeCompanyName !== undefined) {
            fields.push(`include_company_name = $${paramIndex++}`);
            values.push(dto.includeCompanyName);
        }
        if (dto.fontFamily !== undefined) {
            fields.push(`font_family = $${paramIndex++}`);
            values.push(dto.fontFamily);
        }
        if (dto.fontSize !== undefined) {
            fields.push(`font_size = $${paramIndex++}`);
            values.push(dto.fontSize);
        }
        if (dto.isDefault !== undefined) {
            fields.push(`is_default = $${paramIndex++}`);
            values.push(dto.isDefault);
        }
        if (dto.isActive !== undefined) {
            fields.push(`is_active = $${paramIndex++}`);
            values.push(dto.isActive);
        }

        fields.push(`updated_by = $${paramIndex++}`);
        values.push(dto.updatedBy);

        if (fields.length === 1) {
            return this.findTemplateById(id);
        }

        values.push(id);
        const result = await this.db.query(
            `UPDATE label_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
    }

    async deleteTemplate(id: string): Promise<boolean> {
        const result = await this.db.query(
            'DELETE FROM label_templates WHERE id = $1',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async findAllTemplates(query: TemplateListQuery): Promise<{ data: LabelTemplateWithUsage[]; total: number }> {
        const { page = 1, limit = 20, search, labelType, isActive, organizationId, sortBy = 'name', sortOrder = 'asc' } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(name ILIKE $${paramIndex} OR template_code ILIKE $${paramIndex})`);
            values.push(`%${search}%`);
            paramIndex++;
        }
        if (labelType) {
            conditions.push(`label_type = $${paramIndex++}`);
            values.push(labelType);
        }
        if (isActive !== undefined) {
            conditions.push(`is_active = $${paramIndex++}`);
            values.push(isActive);
        }
        if (organizationId) {
            conditions.push(`(organization_id = $${paramIndex} OR organization_id IS NULL)`);
            values.push(organizationId);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSortColumns = ['name', 'template_code', 'label_type', 'created_at', 'is_default'];
        const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'name';
        const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM label_templates ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        values.push(limit, offset);
        const result = await this.db.query(
            `SELECT lt.*, u.name as created_by_name,
                    (SELECT COUNT(*) FROM print_jobs pj WHERE pj.template_id = lt.id) as usage_count
             FROM label_templates lt
             LEFT JOIN users u ON lt.created_by = u.id
             ${whereClause}
             ORDER BY ${sortColumn} ${order}
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: result.rows.map((row) => this.mapTemplateWithUsage(row)),
            total,
        };
    }

    async setDefaultTemplate(id: string, organizationId?: string): Promise<boolean> {
        const client = await this.db.getClient();
        try {
            await client.query('BEGIN');

            // Clear existing default
            await client.query(
                `UPDATE label_templates SET is_default = false 
                 WHERE is_default = true AND ($1::uuid IS NULL OR organization_id = $1 OR organization_id IS NULL)`,
                [organizationId]
            );

            // Set new default
            const result = await client.query(
                'UPDATE label_templates SET is_default = true WHERE id = $1 RETURNING id',
                [id]
            );

            await client.query('COMMIT');
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async cloneTemplate(id: string, newName: string, createdBy: string): Promise<LabelTemplate | null> {
        const original = await this.findTemplateById(id);
        if (!original) return null;

        return this.createTemplate({
            name: newName,
            description: original.description,
            labelType: original.labelType,
            sizePreset: original.sizePreset,
            widthMm: original.widthMm,
            heightMm: original.heightMm,
            layout: original.layout,
            fields: original.fields,
            barcodeType: original.barcodeType,
            includeLogo: original.includeLogo,
            includeCompanyName: original.includeCompanyName,
            fontFamily: original.fontFamily,
            fontSize: original.fontSize,
            isDefault: false,
            organizationId: original.organizationId,
            createdBy,
        });
    }

    async hasActiveTemplates(): Promise<boolean> {
        const result = await this.db.query(
            'SELECT 1 FROM label_templates WHERE is_active = true LIMIT 1'
        );
        return result.rows.length > 0;
    }

    // ==================== Print Job Operations ====================

    async createPrintJob(dto: CreatePrintJobDto, client?: PoolClient): Promise<PrintJob> {
        const db = client ?? (this.db as unknown as PoolClient);
        const result = await db.query(
            `INSERT INTO print_jobs (
                template_id, asset_ids, asset_count, copies_per_asset,
                printer_name, paper_size, output_type, organization_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                dto.templateId,
                JSON.stringify(dto.assetIds),
                dto.assetIds.length,
                dto.copiesPerAsset || 1,
                dto.printerName,
                dto.paperSize,
                dto.outputType || 'pdf',
                dto.organizationId,
                dto.createdBy,
            ]
        );
        return this.mapPrintJob(result.rows[0]);
    }

    async findPrintJobById(id: string): Promise<PrintJob | null> {
        const result = await this.db.query(
            'SELECT * FROM print_jobs WHERE id = $1',
            [id]
        );
        return result.rows[0] ? this.mapPrintJob(result.rows[0]) : null;
    }

    async findPrintJobByCode(code: string): Promise<PrintJob | null> {
        const result = await this.db.query(
            'SELECT * FROM print_jobs WHERE job_code = $1',
            [code]
        );
        return result.rows[0] ? this.mapPrintJob(result.rows[0]) : null;
    }

    async findPrintJobWithDetails(id: string): Promise<PrintJobWithDetails | null> {
        const result = await this.db.query(
            `SELECT * FROM v_print_jobs_with_details WHERE id = $1`,
            [id]
        );
        return result.rows[0] ? this.mapPrintJobWithDetails(result.rows[0]) : null;
    }

    async updatePrintJobStatus(id: string, dto: UpdatePrintJobStatusDto): Promise<PrintJob | null> {
        const updates: string[] = ['status = $1'];
        const values: unknown[] = [dto.status];
        let paramIndex = 2;

        if (dto.errorMessage !== undefined) {
            updates.push(`error_message = $${paramIndex++}`);
            values.push(dto.errorMessage);
        }
        if (dto.outputUrl !== undefined) {
            updates.push(`output_url = $${paramIndex++}`);
            values.push(dto.outputUrl);
        }

        // Set timestamps based on status
        if (dto.status === 'processing') {
            updates.push(`started_at = NOW()`);
        } else if (dto.status === 'completed' || dto.status === 'failed' || dto.status === 'cancelled') {
            updates.push(`completed_at = NOW()`);
        }

        values.push(id);
        const result = await this.db.query(
            `UPDATE print_jobs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        return result.rows[0] ? this.mapPrintJob(result.rows[0]) : null;
    }

    async findAllPrintJobs(query: PrintJobListQuery): Promise<{ data: PrintJobWithDetails[]; total: number }> {
        const { page = 1, limit = 20, search, status, templateId, createdBy, dateFrom, dateTo, organizationId, sortBy = 'created_at', sortOrder = 'desc' } = query;
        const offset = (page - 1) * limit;

        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(job_code ILIKE $${paramIndex} OR template_name ILIKE $${paramIndex})`);
            values.push(`%${search}%`);
            paramIndex++;
        }
        if (status) {
            conditions.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (templateId) {
            conditions.push(`template_id = $${paramIndex++}`);
            values.push(templateId);
        }
        if (createdBy) {
            conditions.push(`created_by = $${paramIndex++}`);
            values.push(createdBy);
        }
        if (dateFrom) {
            conditions.push(`created_at >= $${paramIndex++}`);
            values.push(dateFrom);
        }
        if (dateTo) {
            conditions.push(`created_at <= $${paramIndex++}`);
            values.push(dateTo);
        }
        if (organizationId) {
            conditions.push(`organization_id = $${paramIndex++}`);
            values.push(organizationId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const allowedSortColumns = ['job_code', 'created_at', 'status', 'total_labels'];
        const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

        const countResult = await this.db.query(
            `SELECT COUNT(*) FROM v_print_jobs_with_details ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        values.push(limit, offset);
        const result = await this.db.query(
            `SELECT * FROM v_print_jobs_with_details ${whereClause}
             ORDER BY ${sortColumn} ${order}
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: result.rows.map((row) => this.mapPrintJobWithDetails(row)),
            total,
        };
    }

    // ==================== Print Job Items ====================

    async createPrintJobItems(jobId: string, assetIds: string[], copiesPerAsset: number): Promise<number> {
        const insertValues: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        for (const assetId of assetIds) {
            for (let copy = 1; copy <= copiesPerAsset; copy++) {
                insertValues.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                params.push(jobId, assetId, copy);
            }
        }

        if (insertValues.length === 0) return 0;

        const result = await this.db.query(
            `INSERT INTO print_job_items (print_job_id, asset_id, copy_number)
             VALUES ${insertValues.join(', ')}`,
            params
        );
        return result.rowCount ?? 0;
    }

    async findPrintJobItems(jobId: string): Promise<PrintJobItemWithDetails[]> {
        const result = await this.db.query(
            `SELECT pji.*, a.asset_code as asset_tag, a.name as asset_name, 
                    a.serial_number, c.name as category_name, l.name as location_name,
                    u.name as assigned_to_name
             FROM print_job_items pji
             JOIN assets a ON pji.asset_id = a.id
             LEFT JOIN asset_categories c ON a.category_id = c.id
             LEFT JOIN locations l ON a.location_id = l.id
             LEFT JOIN users u ON a.assigned_user_id = u.id
             WHERE pji.print_job_id = $1
             ORDER BY a.asset_code, pji.copy_number`,
            [jobId]
        );
        return result.rows.map((row) => this.mapPrintJobItemWithDetails(row));
    }

    async updatePrintJobItemStatus(id: string, status: string, errorMessage?: string): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE print_job_items SET status = $1, error_message = $2 WHERE id = $3`,
            [status, errorMessage, id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // ==================== Settings ====================

    async findAllSettings(organizationId?: string): Promise<LabelSetting[]> {
        const result = await this.db.query(
            `SELECT * FROM label_settings 
             WHERE organization_id IS NULL OR organization_id = $1
             ORDER BY setting_key`,
            [organizationId]
        );
        return result.rows.map((row) => this.mapSetting(row));
    }

    async findSettingByKey(key: string, organizationId?: string): Promise<LabelSetting | null> {
        const result = await this.db.query(
            `SELECT * FROM label_settings 
             WHERE setting_key = $1 AND (organization_id IS NULL OR organization_id = $2)
             ORDER BY organization_id NULLS LAST
             LIMIT 1`,
            [key, organizationId]
        );
        return result.rows[0] ? this.mapSetting(result.rows[0]) : null;
    }

    async upsertSetting(key: string, value: string, updatedBy: string, organizationId?: string): Promise<LabelSetting> {
        const result = await this.db.query(
            `INSERT INTO label_settings (setting_key, setting_value, organization_id, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (setting_key, organization_id) 
             DO UPDATE SET setting_value = $2, updated_by = $4, updated_at = NOW()
             RETURNING *`,
            [key, value, organizationId, updatedBy]
        );
        return this.mapSetting(result.rows[0]);
    }

    // ==================== Asset Data for Labels ====================

    async getAssetLabelData(assetIds: string[]): Promise<Record<string, Record<string, unknown>>> {
        if (assetIds.length === 0) return {};

        const result = await this.db.query(
            `SELECT a.id, a.asset_code as asset_tag, a.name, a.serial_number,
                    c.name as category, l.name as location, u.name as assigned_to,
                    a.purchase_date, o.name as company_name, o.logo_url as company_logo
             FROM assets a
             LEFT JOIN asset_categories c ON a.category_id = c.id
             LEFT JOIN locations l ON a.location_id = l.id
             LEFT JOIN users u ON a.assigned_user_id = u.id
             LEFT JOIN organizations o ON a.organization_id = o.id
             WHERE a.id = ANY($1)`,
            [assetIds]
        );

        const dataMap: Record<string, Record<string, unknown>> = {};
        for (const row of result.rows) {
            dataMap[row.id] = {
                asset_tag: row.asset_tag,
                name: row.name,
                serial: row.serial_number,
                category: row.category,
                location: row.location,
                assigned_to: row.assigned_to,
                purchase_date: row.purchase_date,
                company_name: row.company_name,
                company_logo: row.company_logo,
            };
        }
        return dataMap;
    }

    async validateAssetFields(assetIds: string[], requiredFields: string[]): Promise<{ assetId: string; assetTag: string; missingFields: string[]; emptyFields: string[] }[]> {
        const assetData = await this.getAssetLabelData(assetIds);
        const results: { assetId: string; assetTag: string; missingFields: string[]; emptyFields: string[] }[] = [];

        for (const assetId of assetIds) {
            const data = assetData[assetId];
            if (!data) {
                results.push({ assetId, assetTag: 'Unknown', missingFields: ['asset'], emptyFields: [] });
                continue;
            }

            const emptyFields: string[] = [];
            for (const field of requiredFields) {
                if (field === 'barcode' || field === 'qrcode') continue; // Generated fields
                const value = data[field];
                if (value === null || value === undefined || value === '') {
                    emptyFields.push(field);
                }
            }

            if (emptyFields.length > 0) {
                results.push({ assetId, assetTag: data.asset_tag as string, missingFields: [], emptyFields });
            }
        }

        return results;
    }

    // ==================== Transaction Helper ====================

    async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        return this.db.transaction(callback);
    }

    // ==================== Mappers ====================

    private mapTemplate(row: Record<string, unknown>): LabelTemplate {
        return {
            id: row.id as string,
            templateCode: row.template_code as string,
            name: row.name as string,
            description: row.description as string | undefined,
            labelType: row.label_type as LabelTemplate['labelType'],
            sizePreset: row.size_preset as LabelTemplate['sizePreset'],
            widthMm: parseFloat(row.width_mm as string),
            heightMm: parseFloat(row.height_mm as string),
            layout: row.layout as LabelLayout,
            fields: row.fields as LabelFieldId[],
            barcodeType: row.barcode_type as LabelTemplate['barcodeType'],
            includeLogo: row.include_logo as boolean,
            includeCompanyName: row.include_company_name as boolean,
            fontFamily: row.font_family as string,
            fontSize: row.font_size as number,
            isDefault: row.is_default as boolean,
            isActive: row.is_active as boolean,
            organizationId: row.organization_id as string | undefined,
            createdBy: row.created_by as string | undefined,
            updatedBy: row.updated_by as string | undefined,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }

    private mapTemplateWithUsage(row: Record<string, unknown>): LabelTemplateWithUsage {
        return {
            ...this.mapTemplate(row),
            createdByName: row.created_by_name as string | undefined,
            usageCount: parseInt(row.usage_count as string, 10) || 0,
        };
    }

    private mapPrintJob(row: Record<string, unknown>): PrintJob {
        return {
            id: row.id as string,
            jobCode: row.job_code as string,
            templateId: row.template_id as string,
            assetIds: row.asset_ids as string[],
            assetCount: row.asset_count as number,
            copiesPerAsset: row.copies_per_asset as number,
            totalLabels: row.total_labels as number,
            printerName: row.printer_name as string | undefined,
            paperSize: row.paper_size as string | undefined,
            status: row.status as PrintJob['status'],
            errorMessage: row.error_message as string | undefined,
            outputType: row.output_type as PrintJob['outputType'],
            outputUrl: row.output_url as string | undefined,
            startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
            completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
            organizationId: row.organization_id as string | undefined,
            createdBy: row.created_by as string,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }

    private mapPrintJobWithDetails(row: Record<string, unknown>): PrintJobWithDetails {
        return {
            ...this.mapPrintJob(row),
            templateName: row.template_name as string,
            labelType: row.label_type as PrintJobWithDetails['labelType'],
            sizePreset: row.size_preset as PrintJobWithDetails['sizePreset'],
            createdByName: row.created_by_name as string,
            createdByEmail: row.created_by_email as string,
            durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds as string) : undefined,
        };
    }

    private mapPrintJobItemWithDetails(row: Record<string, unknown>): PrintJobItemWithDetails {
        return {
            id: row.id as string,
            printJobId: row.print_job_id as string,
            assetId: row.asset_id as string,
            copyNumber: row.copy_number as number,
            status: row.status as PrintJobItem['status'],
            errorMessage: row.error_message as string | undefined,
            labelData: row.label_data as Record<string, unknown> | undefined,
            createdAt: new Date(row.created_at as string),
            assetTag: row.asset_tag as string,
            assetName: row.asset_name as string,
            serialNumber: row.serial_number as string | undefined,
            categoryName: row.category_name as string | undefined,
            locationName: row.location_name as string | undefined,
            assignedToName: row.assigned_to_name as string | undefined,
        };
    }

    private mapSetting(row: Record<string, unknown>): LabelSetting {
        return {
            id: row.id as string,
            settingKey: row.setting_key as string,
            settingValue: row.setting_value as string | undefined,
            valueType: row.value_type as LabelSetting['valueType'],
            description: row.description as string | undefined,
            organizationId: row.organization_id as string | undefined,
            updatedBy: row.updated_by as string | undefined,
            updatedAt: new Date(row.updated_at as string),
        };
    }
}
