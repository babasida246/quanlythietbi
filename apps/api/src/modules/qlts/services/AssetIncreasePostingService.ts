import type { AssetIncreaseDoc, AssetIncreaseLine } from '@qltb/contracts'
import type { PgClient } from '@qltb/infra-postgres'

type QueryableClient = {
    query<T = { id: string }>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
}

type InsertedAssetRow = {
    id: string
}

export class AssetIncreasePostingService {
    constructor(private pg: PgClient) { }

    async postDocument(doc: AssetIncreaseDoc, postedBy: string): Promise<number> {
        const lines = doc.lines ?? []

        await this.pg.transaction(async (client) => {
            const db = client as unknown as QueryableClient

            for (const line of lines) {
                const assetId = await this.createAssetFromLine(db, doc, line)

                await db.query(
                    `UPDATE asset_increase_lines SET asset_id = $1 WHERE id = $2`,
                    [assetId, line.id]
                )

                if (line.modelId) {
                    await db.query(
                        `UPDATE asset_models
                         SET current_stock_qty = COALESCE(current_stock_qty, 0) + $1
                         WHERE id = $2`,
                        [line.quantity, line.modelId]
                    )
                }
            }

            await db.query(
                `UPDATE asset_increase_docs
                 SET status = $1, posted_by = $2, posted_at = NOW(), updated_at = NOW()
                 WHERE id = $3`,
                ['posted', postedBy, doc.id]
            )
        })

        return lines.length
    }

    private async createAssetFromLine(db: QueryableClient, doc: AssetIncreaseDoc, line: AssetIncreaseLine): Promise<string> {
        const assetCode = line.assetCode || this.generateFallbackAssetCode(line)
        const assetNotes = this.buildAssetNotes(line)

        const inserted = await db.query<InsertedAssetRow>(
            `INSERT INTO assets (
                asset_code, model_id, serial_no,
                location_id, status,
                purchase_date, warranty_end,
                notes,
                source_doc_type, source_doc_id, source_doc_no
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`,
            [
                assetCode,
                line.modelId,
                line.serialNumber ?? null,
                line.locationId ?? null,
                'in_stock',
                line.acquisitionDate || doc.docDate || null,
                line.warrantyEndDate ?? null,
                assetNotes,
                'asset_increase',
                doc.id,
                doc.docNo
            ]
        )

        return inserted.rows[0].id
    }

    private generateFallbackAssetCode(line: AssetIncreaseLine): string {
        return ['AST', Date.now().toString(), String(line.lineNo)].join('-')
    }

    private buildAssetNotes(line: AssetIncreaseLine): string | null {
        if (!line.assetName) {
            return null
        }

        return 'Tăng TS: ' + line.assetName
    }
}