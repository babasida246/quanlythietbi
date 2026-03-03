/**
 * Documents Module - Repository
 */
import type { Pool } from 'pg'
import type {
    CreateDocumentInput,
    Document,
    DocumentListQueryInput,
    UpdateDocumentInput
} from './documents.schemas.js'

type DocumentRow = {
    id: string
    parent_id: string | null
    type: string
    title: string
    summary: string | null
    content_type: string
    markdown: string | null
    external_url: string | null
    visibility: string
    approval_status: string
    approval_reason: string | null
    requested_by: string | null
    approved_by: string | null
    approved_at: Date | null
    version: string
    tags: string[] | null
    created_by: string | null
    updated_by: string | null
    created_at: Date
    updated_at: Date
}

type DocumentFileRow = {
    id: string
    document_id: string
    storage_key: string
    filename: string
    sha256: string | null
    size_bytes: number | string | null
    mime_type: string | null
    created_at: Date
}

type DocumentRelationRow = {
    relation_type: 'asset' | 'model' | 'site' | 'service'
    relation_id: string
}

function toNumber(value: number | string | null): number | null {
    if (value === null) return null
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim()) return Number(value)
    return null
}

export class DocumentsRepository {
    constructor(private db: Pool) { }

    async list(query: DocumentListQueryInput): Promise<{ data: Document[]; total: number }> {
        const conditions: string[] = []
        const params: any[] = []
        let idx = 1

        if (query.type) {
            conditions.push(`type = $${idx}`)
            params.push(query.type)
            idx++
        }

        if (query.visibility) {
            conditions.push(`visibility = $${idx}`)
            params.push(query.visibility)
            idx++
        }

        if (query.status) {
            conditions.push(`approval_status = $${idx}`)
            params.push(query.status)
            idx++
        }

        if (query.tag) {
            conditions.push(`tags @> ARRAY[$${idx}]::text[]`)
            params.push(query.tag)
            idx++
        }

        if (query.q) {
            conditions.push(`(
                title ILIKE $${idx}
                OR COALESCE(summary, '') ILIKE $${idx}
            )`)
            params.push(`%${query.q}%`)
            idx++
        }

        if (query.relatedAssetId) {
            conditions.push(`EXISTS (
                SELECT 1
                FROM document_relations r
                WHERE r.document_id = documents.id
                  AND r.relation_type = 'asset'
                  AND r.relation_id = $${idx}
            )`)
            params.push(query.relatedAssetId)
            idx++
        }

        if (query.relatedModel) {
            const value = query.relatedModel
            const exact = value.includes('|')
            conditions.push(`EXISTS (
                SELECT 1
                FROM document_relations r
                WHERE r.document_id = documents.id
                  AND r.relation_type = 'model'
                  AND r.relation_id ${exact ? `= $${idx}` : `ILIKE $${idx}`}
            )`)
            params.push(exact ? value : `%${value}%`)
            idx++
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const allowedSort: Record<string, string> = {
            updatedAt: 'updated_at',
            title: 'title',
            type: 'type'
        }
        const sortColumn = allowedSort[query.sort] ?? 'updated_at'
        const sortDirection = sortColumn === 'title' || sortColumn === 'type' ? 'ASC' : 'DESC'
        const orderBy = `${sortColumn} ${sortDirection}`

        const limit = query.pageSize
        const offset = (query.page - 1) * query.pageSize

        const count = await this.db.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM documents ${where}`,
            params
        )
        const total = parseInt(count.rows[0]?.count ?? '0', 10)

        const dataResult = await this.db.query<DocumentRow>(
            `SELECT
                id, parent_id, type, title, summary, content_type, markdown, external_url,
                visibility, approval_status, approval_reason, requested_by, approved_by, approved_at,
                version, tags, created_by, updated_by, created_at, updated_at
            FROM documents
            ${where}
            ORDER BY ${orderBy}
            LIMIT $${idx} OFFSET $${idx + 1}`,
            [...params, limit, offset]
        )

        // List view: omit relations/files to keep payload light.
        return {
            data: dataResult.rows.map((row) => this.mapDocument(row, [], [])),
            total
        }
    }

    async getById(id: string): Promise<Document | null> {
        const docResult = await this.db.query<DocumentRow>(
            `SELECT
                id, parent_id, type, title, summary, content_type, markdown, external_url,
                visibility, approval_status, approval_reason, requested_by, approved_by, approved_at,
                version, tags, created_by, updated_by, created_at, updated_at
            FROM documents
            WHERE id = $1`,
            [id]
        )
        if (docResult.rows.length === 0) return null

        const filesResult = await this.db.query<DocumentFileRow>(
            `SELECT id, document_id, storage_key, filename, sha256, size_bytes, mime_type, created_at
             FROM document_files
             WHERE document_id = $1
             ORDER BY created_at ASC`,
            [id]
        )

        const relResult = await this.db.query<DocumentRelationRow>(
            `SELECT relation_type, relation_id
             FROM document_relations
             WHERE document_id = $1`,
            [id]
        )

        return this.mapDocument(docResult.rows[0], filesResult.rows, relResult.rows)
    }

    async create(input: CreateDocumentInput, actorUserId: string): Promise<Document> {
        const scope = input.scope ?? {
            relatedAssets: [],
            relatedModels: [],
            relatedSites: [],
            relatedServices: []
        }

        const docResult = await this.db.query<DocumentRow>(
            `INSERT INTO documents (
                parent_id, type, title, summary, content_type, markdown, external_url,
                visibility, approval_status, requested_by, version, tags, created_by, updated_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, 'draft', $9, $10, $11, $12, $12
            )
            RETURNING
                id, parent_id, type, title, summary, content_type, markdown, external_url,
                visibility, approval_status, approval_reason, requested_by, approved_by, approved_at,
                version, tags, created_by, updated_by, created_at, updated_at`,
            [
                input.parentId ?? null,
                input.type,
                input.title,
                input.summary ?? null,
                input.contentType,
                input.markdown ?? null,
                input.externalUrl ?? null,
                input.visibility,
                actorUserId,
                input.version,
                input.tags,
                actorUserId
            ]
        )

        const created = docResult.rows[0]
        await this.replaceRelations(created.id, scope)

        const doc = await this.getById(created.id)
        if (!doc) throw new Error('Document creation failed')
        return doc
    }

    async update(id: string, patch: UpdateDocumentInput, actorUserId: string): Promise<Document | null> {
        const updates: string[] = []
        const params: any[] = []
        let idx = 1

        const set = (column: string, value: any) => {
            updates.push(`${column} = $${idx}`)
            params.push(value)
            idx++
        }

        if (patch.type !== undefined) set('type', patch.type)
        if (patch.title !== undefined) set('title', patch.title)
        if (patch.summary !== undefined) set('summary', patch.summary ?? null)
        if (patch.contentType !== undefined) set('content_type', patch.contentType)
        if (patch.markdown !== undefined) set('markdown', patch.markdown ?? null)
        if (patch.externalUrl !== undefined) set('external_url', patch.externalUrl ?? null)
        if (patch.visibility !== undefined) set('visibility', patch.visibility)
        if (patch.version !== undefined) set('version', patch.version)
        if (patch.tags !== undefined) set('tags', patch.tags)
        set('updated_by', actorUserId)

        if (updates.length === 0) {
            return this.getById(id)
        }

        const result = await this.db.query<DocumentRow>(
            `UPDATE documents
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${idx}
            RETURNING
                id, parent_id, type, title, summary, content_type, markdown, external_url,
                visibility, approval_status, approval_reason, requested_by, approved_by, approved_at,
                version, tags, created_by, updated_by, created_at, updated_at`,
            [...params, id]
        )

        if (result.rows.length === 0) return null

        if (patch.scope) {
            await this.replaceRelations(id, patch.scope)
        }

        return this.getById(id)
    }

    async submitApproval(id: string, actorUserId: string): Promise<Document | null> {
        await this.db.query(
            `UPDATE documents
             SET approval_status = 'pending',
                 requested_by = $1,
                 approved_by = NULL,
                 approved_at = NULL,
                 approval_reason = NULL,
                 updated_at = NOW()
             WHERE id = $2`,
            [actorUserId, id]
        )
        return this.getById(id)
    }

    async approve(id: string, actorUserId: string, reason: string | null): Promise<Document | null> {
        await this.db.query(
            `UPDATE documents
             SET approval_status = 'approved',
                 approved_by = $1,
                 approved_at = NOW(),
                 approval_reason = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [actorUserId, reason, id]
        )
        return this.getById(id)
    }

    async reject(id: string, actorUserId: string, reason: string): Promise<Document | null> {
        await this.db.query(
            `UPDATE documents
             SET approval_status = 'rejected',
                 approved_by = $1,
                 approved_at = NOW(),
                 approval_reason = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [actorUserId, reason, id]
        )
        return this.getById(id)
    }

    async insertFileMeta(
        documentId: string,
        meta: {
            storageKey: string
            filename: string
            sha256: string | null
            sizeBytes: number
            mimeType: string | null
        }
    ): Promise<Document | null> {
        await this.db.query(
            `INSERT INTO document_files (document_id, storage_key, filename, sha256, size_bytes, mime_type)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                documentId,
                meta.storageKey,
                meta.filename,
                meta.sha256,
                meta.sizeBytes,
                meta.mimeType
            ]
        )
        return this.getById(documentId)
    }

    async getFile(fileId: string): Promise<DocumentFileRow | null> {
        const result = await this.db.query<DocumentFileRow>(
            `SELECT id, document_id, storage_key, filename, sha256, size_bytes, mime_type, created_at
             FROM document_files
             WHERE id = $1`,
            [fileId]
        )
        return result.rows[0] ?? null
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db.query(`DELETE FROM documents WHERE id = $1`, [id])
        return (result.rowCount ?? 0) > 0
    }

    private async replaceRelations(
        documentId: string,
        scope: {
            relatedAssets: string[]
            relatedModels: Array<{ vendor: string; model: string }>
            relatedSites: string[]
            relatedServices: string[]
        }
    ): Promise<void> {
        await this.db.query(`DELETE FROM document_relations WHERE document_id = $1`, [documentId])

        const inserts: Array<{ type: 'asset' | 'model' | 'site' | 'service'; id: string }> = []
        for (const assetId of scope.relatedAssets ?? []) inserts.push({ type: 'asset', id: assetId })
        for (const model of scope.relatedModels ?? []) inserts.push({ type: 'model', id: `${model.vendor}|${model.model}` })
        for (const siteId of scope.relatedSites ?? []) inserts.push({ type: 'site', id: siteId })
        for (const serviceId of scope.relatedServices ?? []) inserts.push({ type: 'service', id: serviceId })

        if (inserts.length === 0) return

        const values: string[] = []
        const params: any[] = []
        let idx = 1
        for (const item of inserts) {
            values.push(`($${idx}, $${idx + 1}, $${idx + 2})`)
            params.push(documentId, item.type, item.id)
            idx += 3
        }

        await this.db.query(
            `INSERT INTO document_relations (document_id, relation_type, relation_id)
             VALUES ${values.join(', ')}`,
            params
        )
    }

    private mapDocument(row: DocumentRow, files: DocumentFileRow[], relations: DocumentRelationRow[]): Document {
        const scope = {
            relatedAssets: [] as string[],
            relatedModels: [] as Array<{ vendor: string; model: string }>,
            relatedSites: [] as string[],
            relatedServices: [] as string[]
        }

        for (const rel of relations) {
            if (rel.relation_type === 'asset') scope.relatedAssets.push(rel.relation_id)
            if (rel.relation_type === 'site') scope.relatedSites.push(rel.relation_id)
            if (rel.relation_type === 'service') scope.relatedServices.push(rel.relation_id)
            if (rel.relation_type === 'model') {
                const [vendor, model] = rel.relation_id.split('|', 2)
                if (vendor && model) scope.relatedModels.push({ vendor, model })
            }
        }

        return {
            id: row.id,
            parentId: row.parent_id,
            type: row.type as any,
            title: row.title,
            summary: row.summary,
            contentType: row.content_type as any,
            markdown: row.markdown,
            externalUrl: row.external_url,
            files: files.map((file) => ({
                id: file.id,
                storageKey: file.storage_key,
                filename: file.filename,
                sha256: file.sha256,
                size: toNumber(file.size_bytes),
                mime: file.mime_type,
                createdAt: file.created_at.toISOString()
            })),
            scope,
            version: row.version,
            visibility: row.visibility as any,
            approval: {
                status: row.approval_status as any,
                requestedBy: row.requested_by,
                approvedBy: row.approved_by,
                approvedAt: row.approved_at ? row.approved_at.toISOString() : null,
                reason: row.approval_reason
            },
            tags: row.tags ?? [],
            createdBy: row.created_by,
            updatedBy: row.updated_by,
            createdAt: row.created_at.toISOString(),
            updatedAt: row.updated_at.toISOString()
        }
    }
}
