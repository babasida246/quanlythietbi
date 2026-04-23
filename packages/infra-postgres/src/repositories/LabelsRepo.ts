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
    DocumentTemplate,
    DocumentTemplateSummary,
    DocumentTemplateVersion,
    CreateDocumentTemplateDto,
    UpdateDocumentTemplateDto,
    CreateDocumentTemplateVersionDto,
    CreateDocumentTemplateVersionDocxDto,
    DocumentTemplateListQuery,
    DocumentTemplateDataSourceKind,
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

    // ==================== Shared Document Template Versioning ====================

    async createDocumentTemplate(dto: CreateDocumentTemplateDto, actorId: string): Promise<DocumentTemplateSummary> {
        const module = dto.module?.trim() || 'general';
        const dataSourceKind = (dto.dataSourceKind ?? 'none') as DocumentTemplateDataSourceKind;
        const dataSourceName = dto.dataSourceName?.trim() || null;
        const codeBase = dto.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 40) || 'template';
        const templateCode = `doc-${codeBase}-${Date.now().toString(36).slice(-6)}`;

        const templateId = await this.withTransaction(async (client) => {
            const templateResult = await client.query(
                `INSERT INTO document_templates (
                    template_code, name, description, module, data_source_kind, data_source_name,
                    data_source_updated_at, data_source_updated_by, organization_id, created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $7, $7)
                RETURNING id`,
                [
                    templateCode,
                    dto.name.trim(),
                    dto.description?.trim() || null,
                    module,
                    dataSourceKind,
                    dataSourceKind === 'none' ? null : dataSourceName,
                    actorId,
                    dto.organizationId ?? null,
                ]
            );

            const id = templateResult.rows[0]?.id as string;
            const fields = dto.fields && dto.fields.length > 0 ? dto.fields : this.extractFields(dto.htmlContent);

            const versionResult = await client.query(
                `INSERT INTO document_template_versions (
                    template_id, version_no, title, html_content, fields, change_note, status, created_by
                ) VALUES ($1, 1, $2, $3, $4::jsonb, $5, 'draft', $6)
                RETURNING id`,
                [
                    id,
                    dto.title?.trim() || null,
                    dto.htmlContent,
                    JSON.stringify(fields),
                    dto.changeNote?.trim() || null,
                    actorId,
                ]
            );

            await client.query(
                `UPDATE document_templates
                 SET active_version_id = $2, updated_by = $3
                 WHERE id = $1`,
                [id, versionResult.rows[0]?.id as string, actorId]
            );

            return id;
        });

        const created = await this.findDocumentTemplateById(templateId);
        if (!created) {
            throw new Error('Failed to create document template');
        }
        return created;
    }

    async findAllDocumentTemplates(query: DocumentTemplateListQuery): Promise<{ data: DocumentTemplateSummary[]; total: number }> {
        const { page = 1, limit = 20, module, organizationId, isActive, includeVersions = true, search } = query;
        const offset = (page - 1) * limit;
        const conditions: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (module) {
            conditions.push(`dt.module = $${paramIndex++}`);
            values.push(module);
        }
        if (organizationId) {
            conditions.push(`(dt.organization_id = $${paramIndex} OR dt.organization_id IS NULL)`);
            values.push(organizationId);
            paramIndex++;
        }
        if (typeof isActive === 'boolean') {
            conditions.push(`dt.is_active = $${paramIndex++}`);
            values.push(isActive);
        }
        if (search?.trim()) {
            conditions.push(`(dt.name ILIKE $${paramIndex} OR dt.template_code ILIKE $${paramIndex})`);
            values.push(`%${search.trim()}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await this.db.query(
            `SELECT COUNT(*) AS count FROM document_templates dt ${whereClause}`,
            values
        );
        const total = parseInt((countResult.rows[0]?.count as string) || '0', 10);

        values.push(limit, offset);
        const result = await this.db.query(
            `SELECT
                dt.*,
                av.id AS active_version_id_value,
                av.template_id AS active_template_id,
                av.version_no AS active_version_no,
                av.title AS active_title,
                av.html_content AS active_html_content,
                av.fields AS active_fields,
                av.change_note AS active_change_note,
                av.status AS active_status,
                av.created_by AS active_created_by,
                av.published_by AS active_published_by,
                av.created_at AS active_created_at,
                av.published_at AS active_published_at,
                lv.id AS latest_version_id,
                lv.template_id AS latest_template_id,
                lv.version_no AS latest_version_no,
                lv.title AS latest_title,
                lv.html_content AS latest_html_content,
                lv.fields AS latest_fields,
                lv.change_note AS latest_change_note,
                lv.status AS latest_status,
                lv.created_by AS latest_created_by,
                lv.published_by AS latest_published_by,
                lv.created_at AS latest_created_at,
                lv.published_at AS latest_published_at
            FROM document_templates dt
            LEFT JOIN document_template_versions av ON av.id = dt.active_version_id
            LEFT JOIN LATERAL (
                SELECT *
                FROM document_template_versions v
                WHERE v.template_id = dt.id
                ORDER BY v.version_no DESC
                LIMIT 1
            ) lv ON true
            ${whereClause}
            ORDER BY dt.updated_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            values
        );

        return {
            data: result.rows.map((row) => this.mapDocumentTemplateSummary(row, includeVersions)),
            total,
        };
    }

    async findDocumentTemplateById(id: string): Promise<DocumentTemplateSummary | null> {
        const result = await this.db.query(
            `SELECT
                dt.*,
                av.id AS active_version_id_value,
                av.template_id AS active_template_id,
                av.version_no AS active_version_no,
                av.title AS active_title,
                av.html_content AS active_html_content,
                av.fields AS active_fields,
                av.change_note AS active_change_note,
                av.status AS active_status,
                av.created_by AS active_created_by,
                av.published_by AS active_published_by,
                av.created_at AS active_created_at,
                av.published_at AS active_published_at,
                lv.id AS latest_version_id,
                lv.template_id AS latest_template_id,
                lv.version_no AS latest_version_no,
                lv.title AS latest_title,
                lv.html_content AS latest_html_content,
                lv.fields AS latest_fields,
                lv.change_note AS latest_change_note,
                lv.status AS latest_status,
                lv.created_by AS latest_created_by,
                lv.published_by AS latest_published_by,
                lv.created_at AS latest_created_at,
                lv.published_at AS latest_published_at
            FROM document_templates dt
            LEFT JOIN document_template_versions av ON av.id = dt.active_version_id
            LEFT JOIN LATERAL (
                SELECT *
                FROM document_template_versions v
                WHERE v.template_id = dt.id
                ORDER BY v.version_no DESC
                LIMIT 1
            ) lv ON true
            WHERE dt.id = $1`,
            [id]
        );
        return result.rows[0] ? this.mapDocumentTemplateSummary(result.rows[0], true) : null;
    }

    async updateDocumentTemplate(id: string, dto: UpdateDocumentTemplateDto, actorId: string): Promise<DocumentTemplate | null> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (dto.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(dto.name.trim());
        }
        if (dto.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(dto.description?.trim() || null);
        }
        if (dto.module !== undefined) {
            updates.push(`module = $${paramIndex++}`);
            values.push(dto.module.trim() || 'general');
        }
        if (dto.dataSourceKind !== undefined) {
            updates.push(`data_source_kind = $${paramIndex++}`);
            values.push(dto.dataSourceKind);
            updates.push(`data_source_updated_at = NOW()`);
            updates.push(`data_source_updated_by = $${paramIndex++}`);
            values.push(actorId);

            // Unbind routine name automatically when disabling SQL data source.
            if (dto.dataSourceKind === 'none') {
                updates.push(`data_source_name = NULL`);
            }
        }
        if (dto.dataSourceName !== undefined) {
            updates.push(`data_source_name = $${paramIndex++}`);
            values.push(dto.dataSourceName.trim() || null);
            updates.push(`data_source_updated_at = NOW()`);
            updates.push(`data_source_updated_by = $${paramIndex++}`);
            values.push(actorId);
        }
        if (dto.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(dto.isActive);
        }

        updates.push(`updated_by = $${paramIndex++}`);
        values.push(actorId);

        values.push(id);
        const result = await this.db.query(
            `UPDATE document_templates
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
        );

        return result.rows[0] ? this.mapDocumentTemplate(result.rows[0]) : null;
    }

    async deleteDocumentTemplate(id: string): Promise<boolean> {
        const result = await this.db.query(
            `DELETE FROM document_templates WHERE id = $1`,
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async findDocumentTemplateVersions(templateId: string): Promise<DocumentTemplateVersion[]> {
        const result = await this.db.query(
            `SELECT *
             FROM document_template_versions
             WHERE template_id = $1
             ORDER BY version_no DESC`,
            [templateId]
        );
        return result.rows.map((row) => this.mapDocumentTemplateVersion(row));
    }

    async createDocumentTemplateVersion(
        templateId: string,
        dto: CreateDocumentTemplateVersionDto,
        actorId: string
    ): Promise<DocumentTemplateVersion> {
        const result = await this.db.query(
            `WITH next_version AS (
                SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no
                FROM document_template_versions
                WHERE template_id = $1
            )
            INSERT INTO document_template_versions (
                template_id, version_no, title, html_content, fields, change_note, status, created_by
            )
            SELECT
                $1,
                nv.version_no,
                $2,
                $3,
                $4::jsonb,
                $5,
                'draft',
                $6
            FROM next_version nv
            RETURNING *`,
            [
                templateId,
                dto.title?.trim() || null,
                dto.htmlContent,
                JSON.stringify(dto.fields && dto.fields.length > 0 ? dto.fields : this.extractFields(dto.htmlContent)),
                dto.changeNote?.trim() || null,
                actorId,
            ]
        );

        return this.mapDocumentTemplateVersion(result.rows[0]);
    }

    async publishDocumentTemplateVersion(templateId: string, versionId: string, actorId: string): Promise<DocumentTemplateSummary | null> {
        return this.withTransaction(async (client) => {
            const targetVersionResult = await client.query(
                `SELECT id
                 FROM document_template_versions
                 WHERE id = $1 AND template_id = $2`,
                [versionId, templateId]
            );
            if (!targetVersionResult.rows[0]) {
                return null;
            }

            await client.query(
                `UPDATE document_template_versions
                 SET status = 'archived'
                 WHERE template_id = $1 AND status = 'published'`,
                [templateId]
            );

            await client.query(
                `UPDATE document_template_versions
                 SET status = 'published', published_at = NOW(), published_by = $3
                 WHERE id = $1 AND template_id = $2`,
                [versionId, templateId, actorId]
            );

            await client.query(
                `UPDATE document_templates
                 SET active_version_id = $2, updated_by = $3
                 WHERE id = $1`,
                [templateId, versionId, actorId]
            );

            const summaryResult = await client.query(
                `SELECT
                    dt.*,
                    av.id AS active_version_id_value,
                    av.template_id AS active_template_id,
                    av.version_no AS active_version_no,
                    av.title AS active_title,
                    av.html_content AS active_html_content,
                    av.fields AS active_fields,
                    av.change_note AS active_change_note,
                    av.status AS active_status,
                    av.created_by AS active_created_by,
                    av.published_by AS active_published_by,
                    av.created_at AS active_created_at,
                    av.published_at AS active_published_at,
                    lv.id AS latest_version_id,
                    lv.template_id AS latest_template_id,
                    lv.version_no AS latest_version_no,
                    lv.title AS latest_title,
                    lv.html_content AS latest_html_content,
                    lv.fields AS latest_fields,
                    lv.change_note AS latest_change_note,
                    lv.status AS latest_status,
                    lv.created_by AS latest_created_by,
                    lv.published_by AS latest_published_by,
                    lv.created_at AS latest_created_at,
                    lv.published_at AS latest_published_at
                FROM document_templates dt
                LEFT JOIN document_template_versions av ON av.id = dt.active_version_id
                LEFT JOIN LATERAL (
                    SELECT *
                    FROM document_template_versions v
                    WHERE v.template_id = dt.id
                    ORDER BY v.version_no DESC
                    LIMIT 1
                ) lv ON true
                WHERE dt.id = $1`,
                [templateId]
            );

            return summaryResult.rows[0] ? this.mapDocumentTemplateSummary(summaryResult.rows[0], true) : null;
        });
    }

    async rollbackDocumentTemplateVersion(
        templateId: string,
        targetVersionId: string,
        actorId: string,
        changeNote?: string
    ): Promise<DocumentTemplateSummary | null> {
        return this.withTransaction(async (client) => {
            const targetResult = await client.query(
                `SELECT *
                 FROM document_template_versions
                 WHERE id = $1 AND template_id = $2`,
                [targetVersionId, templateId]
            );
            const target = targetResult.rows[0];
            if (!target) {
                return null;
            }

            const newVersionResult = await client.query(
                `WITH next_version AS (
                    SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no
                    FROM document_template_versions
                    WHERE template_id = $1
                )
                INSERT INTO document_template_versions (
                    template_id, version_no, title, html_content, fields, change_note, status, created_by, published_by, published_at
                )
                SELECT
                    $1,
                    nv.version_no,
                    COALESCE($2, $3),
                    $4,
                    $5::jsonb,
                    $6,
                    'published',
                    $7,
                    $7,
                    NOW()
                FROM next_version nv
                RETURNING id`,
                [
                    templateId,
                    `Rollback from v${target.version_no}`,
                    target.title as string | null,
                    target.html_content as string,
                    JSON.stringify(target.fields as unknown[]),
                    changeNote?.trim() || `Rollback to version ${target.version_no}`,
                    actorId,
                ]
            );

            await client.query(
                `UPDATE document_template_versions
                 SET status = 'archived'
                 WHERE template_id = $1 AND status = 'published' AND id <> $2`,
                [templateId, newVersionResult.rows[0]?.id as string]
            );

            await client.query(
                `UPDATE document_templates
                 SET active_version_id = $2, updated_by = $3
                 WHERE id = $1`,
                [templateId, newVersionResult.rows[0]?.id as string, actorId]
            );

            const summaryResult = await client.query(
                `SELECT
                    dt.*,
                    av.id AS active_version_id_value,
                    av.template_id AS active_template_id,
                    av.version_no AS active_version_no,
                    av.title AS active_title,
                    av.html_content AS active_html_content,
                    av.fields AS active_fields,
                    av.change_note AS active_change_note,
                    av.status AS active_status,
                    av.created_by AS active_created_by,
                    av.published_by AS active_published_by,
                    av.created_at AS active_created_at,
                    av.published_at AS active_published_at,
                    lv.id AS latest_version_id,
                    lv.template_id AS latest_template_id,
                    lv.version_no AS latest_version_no,
                    lv.title AS latest_title,
                    lv.html_content AS latest_html_content,
                    lv.fields AS latest_fields,
                    lv.change_note AS latest_change_note,
                    lv.status AS latest_status,
                    lv.created_by AS latest_created_by,
                    lv.published_by AS latest_published_by,
                    lv.created_at AS latest_created_at,
                    lv.published_at AS latest_published_at
                FROM document_templates dt
                LEFT JOIN document_template_versions av ON av.id = dt.active_version_id
                LEFT JOIN LATERAL (
                    SELECT *
                    FROM document_template_versions v
                    WHERE v.template_id = dt.id
                    ORDER BY v.version_no DESC
                    LIMIT 1
                ) lv ON true
                WHERE dt.id = $1`,
                [templateId]
            );

            return summaryResult.rows[0] ? this.mapDocumentTemplateSummary(summaryResult.rows[0], true) : null;
        });
    }

    async findDocumentTemplateVersionById(templateId: string, versionId: string): Promise<DocumentTemplateVersion | null> {
        const result = await this.db.query(
            `SELECT *
             FROM document_template_versions
             WHERE id = $1 AND template_id = $2`,
            [versionId, templateId]
        );
        return result.rows[0] ? this.mapDocumentTemplateVersion(result.rows[0]) : null;
    }

    async findActiveDocumentTemplateVersion(templateId: string): Promise<DocumentTemplateVersion | null> {
        const result = await this.db.query(
            `SELECT dv.*
             FROM document_templates dt
             JOIN document_template_versions dv ON dv.id = dt.active_version_id
             WHERE dt.id = $1
             AND dv.status = 'published'`,
            [templateId]
        );
        return result.rows[0] ? this.mapDocumentTemplateVersion(result.rows[0]) : null;
    }

    /**
     * Get the binary (.docx) content of a specific template version.
     * Returns null if the version does not exist or has no binary content.
     */
    async getDocumentTemplateVersionBinary(
        templateId: string,
        versionId: string
    ): Promise<{ format: 'html' | 'docx'; binaryContent: Buffer | null; htmlContent: string } | null> {
        const result = await this.db.query<{
            template_format: string;
            binary_content: Buffer | null;
            html_content: string;
        }>(
            `SELECT template_format, binary_content, html_content
             FROM document_template_versions
             WHERE id = $1 AND template_id = $2`,
            [versionId, templateId]
        );
        if (!result.rows[0]) return null;
        const row = result.rows[0];
        return {
            format: (row.template_format as 'html' | 'docx') ?? 'html',
            binaryContent: row.binary_content ? Buffer.from(row.binary_content) : null,
            htmlContent: row.html_content ?? '',
        };
    }

    /**
     * Create a new DOCX template version from a binary .docx upload.
     */
    async createDocumentTemplateVersionDocx(
        templateId: string,
        dto: CreateDocumentTemplateVersionDocxDto
    ): Promise<DocumentTemplateVersion> {
        const result = await this.db.query(
            `WITH next_version AS (
                SELECT COALESCE(MAX(version_no), 0) + 1 AS version_no
                FROM document_template_versions
                WHERE template_id = $1
            )
            INSERT INTO document_template_versions (
                template_id, version_no, title, html_content, template_format,
                binary_content, fields, change_note, status, created_by
            )
            SELECT
                $1,
                nv.version_no,
                $2,
                '',
                'docx',
                $3,
                '[]'::jsonb,
                $4,
                'draft',
                $5
            FROM next_version nv
            RETURNING *`,
            [
                templateId,
                dto.title?.trim() || null,
                dto.binaryContent,
                dto.changeNote?.trim() || null,
                dto.createdBy || null,
            ]
        );
        return this.mapDocumentTemplateVersion(result.rows[0]);
    }

    async bindDocumentTemplateDataSource(
        templateId: string,
        kind: DocumentTemplateDataSourceKind,
        routineName: string | null,
        actorId: string,
    ): Promise<DocumentTemplate | null> {
        const normalizedName = kind === 'none' ? null : (routineName?.trim() || null);
        const result = await this.db.query(
            `UPDATE document_templates
             SET
                data_source_kind = $2,
                data_source_name = $3,
                data_source_updated_at = NOW(),
                data_source_updated_by = $4,
                updated_by = $4,
                updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [templateId, kind, normalizedName, actorId],
        );
        return result.rows[0] ? this.mapDocumentTemplate(result.rows[0]) : null;
    }

    async createOrReplacePrintDataSourceRoutine(
        kind: Exclude<DocumentTemplateDataSourceKind, 'none'>,
        routineName: string,
        definitionSql: string,
    ): Promise<{ schema: string; name: string; qualifiedName: string }> {
        const parsed = this.parseRoutineName(routineName);
        await this.db.query(`CREATE SCHEMA IF NOT EXISTS ${parsed.schemaSql}`);
        await this.db.query(definitionSql);

        const verify = await this.db.query<{ prokind: 'f' | 'p' | 'a' | 'w' }>(
            `SELECT p.prokind
             FROM pg_proc p
             INNER JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = $1
               AND p.proname = $2
             ORDER BY p.oid DESC
             LIMIT 1`,
            [parsed.schema, parsed.name],
        );

        const routine = verify.rows[0];
        if (!routine) {
            throw new Error(`Routine '${parsed.qualifiedName}' was not created`);
        }

        if ((kind === 'function' && routine.prokind !== 'f') || (kind === 'procedure' && routine.prokind !== 'p')) {
            throw new Error(`Routine '${parsed.qualifiedName}' kind mismatch. Expected ${kind}`);
        }

        return {
            schema: parsed.schema,
            name: parsed.name,
            qualifiedName: parsed.qualifiedName,
        };
    }

    async sandboxPrintDataSourceRoutine(
        kind: Exclude<DocumentTemplateDataSourceKind, 'none'>,
        routineName: string,
        payload: Record<string, unknown>,
        limit = 30,
    ): Promise<Record<string, unknown>[]> {
        const parsed = this.parseRoutineName(routineName);
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 200)) : 30;
        const payloadJson = JSON.stringify(payload ?? {});

        return this.withTransaction(async (client) => {
            await client.query(`SET LOCAL statement_timeout = '5000ms'`);
            await client.query('SET LOCAL default_transaction_read_only = on');

            if (kind === 'function') {
                const result = await client.query(
                    `SELECT * FROM ${parsed.qualifiedSql}($1::jsonb) LIMIT $2`,
                    [payloadJson, safeLimit],
                );
                return result.rows as Record<string, unknown>[];
            }

            const result = await client.query(
                `CALL ${parsed.qualifiedSql}($1::jsonb, $2::jsonb)`,
                [payloadJson, null],
            );
            return result.rows as Record<string, unknown>[];
        });
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

    private mapDocumentTemplate(row: Record<string, unknown>): DocumentTemplate {
        return {
            id: row.id as string,
            templateCode: row.template_code as string,
            name: row.name as string,
            description: row.description as string | undefined,
            module: row.module as string,
            dataSourceKind: ((row.data_source_kind as string | undefined) ?? 'none') as DocumentTemplate['dataSourceKind'],
            dataSourceName: (row.data_source_name as string | null) ?? undefined,
            organizationId: row.organization_id as string | undefined,
            activeVersionId: (row.active_version_id as string | undefined) ?? (row.active_version_id_value as string | undefined),
            isActive: row.is_active as boolean,
            createdBy: row.created_by as string | undefined,
            updatedBy: row.updated_by as string | undefined,
            createdAt: new Date(row.created_at as string),
            updatedAt: new Date(row.updated_at as string),
        };
    }

    private mapDocumentTemplateVersion(row: Record<string, unknown>): DocumentTemplateVersion {
        return {
            id: row.id as string,
            templateId: row.template_id as string,
            versionNo: Number(row.version_no),
            title: row.title as string | undefined,
            htmlContent: (row.html_content as string) ?? '',
            templateFormat: ((row.template_format as string) ?? 'html') as DocumentTemplateVersion['templateFormat'],
            fields: (row.fields as string[]) ?? [],
            changeNote: row.change_note as string | undefined,
            status: row.status as DocumentTemplateVersion['status'],
            createdBy: row.created_by as string | undefined,
            publishedBy: row.published_by as string | undefined,
            createdAt: new Date(row.created_at as string),
            publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
        };
    }

    private mapDocumentTemplateSummary(row: Record<string, unknown>, includeVersions: boolean): DocumentTemplateSummary {
        const base = this.mapDocumentTemplate(row);
        if (!includeVersions) return base;

        const activeVersion = row.active_version_id_value
            ? this.mapDocumentTemplateVersion({
                id: row.active_version_id_value,
                template_id: row.active_template_id,
                version_no: row.active_version_no,
                title: row.active_title,
                html_content: row.active_html_content,
                fields: row.active_fields,
                change_note: row.active_change_note,
                status: row.active_status,
                created_by: row.active_created_by,
                published_by: row.active_published_by,
                created_at: row.active_created_at,
                published_at: row.active_published_at,
            })
            : undefined;

        const latestVersion = row.latest_version_id
            ? this.mapDocumentTemplateVersion({
                id: row.latest_version_id,
                template_id: row.latest_template_id,
                version_no: row.latest_version_no,
                title: row.latest_title,
                html_content: row.latest_html_content,
                fields: row.latest_fields,
                change_note: row.latest_change_note,
                status: row.latest_status,
                created_by: row.latest_created_by,
                published_by: row.latest_published_by,
                created_at: row.latest_created_at,
                published_at: row.latest_published_at,
            })
            : undefined;

        return {
            ...base,
            activeVersion,
            latestVersion,
        };
    }

    private parseRoutineName(rawName: string): {
        schema: string;
        name: string;
        schemaSql: string;
        qualifiedSql: string;
        qualifiedName: string;
    } {
        const clean = rawName.trim().replace(/"/g, '');
        const parts = clean.split('.').map((part) => part.trim()).filter(Boolean);
        if (parts.length < 1 || parts.length > 2) {
            throw new Error('Routine name must be in format name or schema.name');
        }

        const schema = parts.length === 2 ? parts[0].toLowerCase() : 'print_data_sources';
        const name = parts.length === 2 ? parts[1].toLowerCase() : parts[0].toLowerCase();

        const ident = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (!ident.test(schema) || !ident.test(name)) {
            throw new Error('Routine name contains invalid characters');
        }

        const schemaSql = this.quoteIdentifier(schema);
        const nameSql = this.quoteIdentifier(name);

        return {
            schema,
            name,
            schemaSql,
            qualifiedSql: `${schemaSql}.${nameSql}`,
            qualifiedName: `${schema}.${name}`,
        };
    }

    private quoteIdentifier(identifier: string): string {
        return `"${identifier.replace(/"/g, '""')}"`;
    }

    private extractFields(htmlContent: string): string[] {
        const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
        const set = new Set<string>();
        let match = regex.exec(htmlContent);
        while (match) {
            set.add(match[1]);
            match = regex.exec(htmlContent);
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }
}
