import type { ICmdbConfigFileRepo } from '@qltb/contracts'
import type {
    CmdbConfigFileCreateInput,
    CmdbConfigFileListFilters,
    CmdbConfigFilePage,
    CmdbConfigFileRecord,
    CmdbConfigFileUpdatePatch,
    CmdbConfigFileVersionRecord
} from '@qltb/contracts'
import type { Queryable } from './types.js'

type ConfigFileRow = {
    id: string
    ci_id: string
    ci_name?: string | null
    name: string
    file_type: string
    language: string | null
    description: string | null
    file_path: string | null
    content: string
    current_version: number
    is_active: boolean
    created_by: string | null
    updated_by: string | null
    created_at: Date
    updated_at: Date
}

type ConfigFileVersionRow = {
    id: string
    config_file_id: string
    version: number
    content: string
    change_summary: string | null
    created_by: string | null
    created_at: Date
}

function mapFile(row: ConfigFileRow): CmdbConfigFileRecord {
    return {
        id: row.id,
        ciId: row.ci_id,
        ciName: row.ci_name ?? undefined,
        name: row.name,
        fileType: row.file_type as CmdbConfigFileRecord['fileType'],
        language: row.language,
        description: row.description,
        filePath: row.file_path,
        content: row.content,
        currentVersion: row.current_version,
        isActive: row.is_active,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
    }
}

function mapVersion(row: ConfigFileVersionRow): CmdbConfigFileVersionRecord {
    return {
        id: row.id,
        configFileId: row.config_file_id,
        version: row.version,
        content: row.content,
        changeSummary: row.change_summary,
        createdBy: row.created_by,
        createdAt: row.created_at.toISOString()
    }
}

export class CmdbConfigFileRepo implements ICmdbConfigFileRepo {
    constructor(private db: Queryable) {}

    async create(input: CmdbConfigFileCreateInput): Promise<CmdbConfigFileRecord> {
        const result = await this.db.query<ConfigFileRow>(
            `INSERT INTO cmdb_config_files
                (ci_id, name, file_type, language, description, file_path, content, current_version, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $8)
             RETURNING *`,
            [
                input.ciId,
                input.name,
                input.fileType ?? 'config',
                input.language ?? null,
                input.description ?? null,
                input.filePath ?? null,
                input.content,
                input.createdBy ?? null
            ]
        )
        const file = mapFile(result.rows[0])

        // Lưu phiên bản đầu tiên vào lịch sử
        await this.db.query(
            `INSERT INTO cmdb_config_file_versions
                (config_file_id, version, content, change_summary, created_by)
             VALUES ($1, 1, $2, $3, $4)`,
            [file.id, input.content, input.changeSummary ?? 'Khởi tạo', input.createdBy ?? null]
        )

        return file
    }

    async update(id: string, patch: CmdbConfigFileUpdatePatch): Promise<CmdbConfigFileRecord | null> {
        // Nếu content thay đổi → tăng version và lưu lịch sử
        const current = await this.getById(id)
        if (!current) return null

        const newContent = patch.content !== undefined ? patch.content : current.content
        const contentChanged = patch.content !== undefined && patch.content !== current.content
        const newVersion = contentChanged ? current.currentVersion + 1 : current.currentVersion

        const result = await this.db.query<ConfigFileRow>(
            `UPDATE cmdb_config_files SET
                name            = COALESCE($2, name),
                file_type       = COALESCE($3, file_type),
                language        = CASE WHEN $4::boolean THEN $5 ELSE language END,
                description     = CASE WHEN $6::boolean THEN $7 ELSE description END,
                file_path       = CASE WHEN $8::boolean THEN $9 ELSE file_path END,
                content         = $10,
                current_version = $11,
                updated_by      = $12,
                updated_at      = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING *`,
            [
                id,
                patch.name ?? null,
                patch.fileType ?? null,
                'language' in patch,
                patch.language ?? null,
                'description' in patch,
                patch.description ?? null,
                'filePath' in patch,
                patch.filePath ?? null,
                newContent,
                newVersion,
                patch.updatedBy ?? null
            ]
        )
        if (result.rows.length === 0) return null

        // Lưu phiên bản mới nếu content thay đổi
        if (contentChanged) {
            await this.db.query(
                `INSERT INTO cmdb_config_file_versions
                    (config_file_id, version, content, change_summary, created_by)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, newVersion, newContent, patch.changeSummary ?? null, patch.updatedBy ?? null]
            )
        }

        return mapFile(result.rows[0])
    }

    async getById(id: string): Promise<CmdbConfigFileRecord | null> {
        const result = await this.db.query<ConfigFileRow>(
            `SELECT * FROM cmdb_config_files WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        )
        return result.rows.length > 0 ? mapFile(result.rows[0]) : null
    }

    async list(filters: CmdbConfigFileListFilters): Promise<CmdbConfigFilePage> {
        const page  = filters.page  ?? 1
        const limit = filters.limit ?? 20
        const offset = (page - 1) * limit

        const conditions: string[] = ['f.deleted_at IS NULL']
        const params: unknown[] = []

        if (filters.ciId) {
            params.push(filters.ciId)
            conditions.push(`f.ci_id = $${params.length}`)
        }
        if (filters.fileType) {
            params.push(filters.fileType)
            conditions.push(`f.file_type = $${params.length}`)
        }
        if (filters.q) {
            params.push(`%${filters.q}%`)
            const n = params.length
            conditions.push(`(f.name ILIKE $${n} OR f.description ILIKE $${n} OR f.file_path ILIKE $${n} OR ci.name ILIKE $${n})`)
        }

        const where = conditions.join(' AND ')
        const fromJoin = `FROM cmdb_config_files f LEFT JOIN cmdb_cis ci ON ci.id = f.ci_id`

        const countResult = await this.db.query<{ count: string }>(
            `SELECT COUNT(*) ${fromJoin} WHERE ${where}`,
            params
        )
        const total = parseInt(countResult.rows[0].count, 10)

        params.push(limit, offset)
        const dataResult = await this.db.query<ConfigFileRow>(
            `SELECT f.*, ci.name AS ci_name ${fromJoin}
             WHERE ${where}
             ORDER BY f.updated_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        )

        return {
            items: dataResult.rows.map(mapFile),
            total,
            page,
            limit
        }
    }

    async softDelete(id: string): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE cmdb_config_files SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }

    async listVersions(configFileId: string): Promise<CmdbConfigFileVersionRecord[]> {
        const result = await this.db.query<ConfigFileVersionRow>(
            `SELECT * FROM cmdb_config_file_versions
             WHERE config_file_id = $1
             ORDER BY version DESC`,
            [configFileId]
        )
        return result.rows.map(mapVersion)
    }

    async getVersion(configFileId: string, version: number): Promise<CmdbConfigFileVersionRecord | null> {
        const result = await this.db.query<ConfigFileVersionRow>(
            `SELECT * FROM cmdb_config_file_versions
             WHERE config_file_id = $1 AND version = $2`,
            [configFileId, version]
        )
        return result.rows.length > 0 ? mapVersion(result.rows[0]) : null
    }
}
