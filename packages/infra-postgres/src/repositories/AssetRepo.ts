import type {
    AssetCreateInput,
    AssetRecord,
    AssetSearchFilters,
    AssetSearchResult,
    AssetUpdatePatch,
    AssetBulkUpsertInput,
    AssetBulkUpsertResult,
    IAssetRepo
} from '@qltb/contracts'
import type { PgClient } from '../PgClient.js'
import { BASE_SELECT, buildSearchConditions, mapAssetRow, normalizePagination, resolveSort, type AssetRow } from './asset-queries.js'

export class AssetRepo implements IAssetRepo {
    constructor(private pg: PgClient) { }

    async create(asset: AssetCreateInput): Promise<AssetRecord> {
        const result = await this.pg.query<AssetRow>(
            `INSERT INTO assets (
                asset_code,
                model_id,
                serial_no,
                mac_address,
                mgmt_ip,
                hostname,
                vlan_id,
                switch_name,
                switch_port,
                location_id,
                warehouse_id,
                status,
                purchase_date,
                warranty_end,
                vendor_id,
                notes
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
            )
            RETURNING *`,
            [
                asset.assetCode,
                asset.modelId,
                asset.serialNo ?? null,
                asset.macAddress ?? null,
                asset.mgmtIp ?? null,
                asset.hostname ?? null,
                asset.vlanId ?? null,
                asset.switchName ?? null,
                asset.switchPort ?? null,
                asset.locationId ?? null,
                asset.warehouseId ?? null,
                asset.status ?? 'in_stock',
                asset.purchaseDate ?? null,
                asset.warrantyEnd ?? null,
                asset.vendorId ?? null,
                asset.notes ?? null
            ]
        )

        return mapAssetRow(result.rows[0])
    }

    async update(id: string, patch: AssetUpdatePatch): Promise<AssetRecord> {
        const updates: Array<{ column: string; value: unknown }> = []

        if (patch.assetCode !== undefined) updates.push({ column: 'asset_code', value: patch.assetCode })
        if (patch.modelId !== undefined) updates.push({ column: 'model_id', value: patch.modelId })
        if (patch.serialNo !== undefined) updates.push({ column: 'serial_no', value: patch.serialNo })
        if (patch.macAddress !== undefined) updates.push({ column: 'mac_address', value: patch.macAddress })
        if (patch.mgmtIp !== undefined) updates.push({ column: 'mgmt_ip', value: patch.mgmtIp })
        if (patch.hostname !== undefined) updates.push({ column: 'hostname', value: patch.hostname })
        if (patch.vlanId !== undefined) updates.push({ column: 'vlan_id', value: patch.vlanId })
        if (patch.switchName !== undefined) updates.push({ column: 'switch_name', value: patch.switchName })
        if (patch.switchPort !== undefined) updates.push({ column: 'switch_port', value: patch.switchPort })
        if (patch.locationId !== undefined) updates.push({ column: 'location_id', value: patch.locationId })
        if (patch.warehouseId !== undefined) updates.push({ column: 'warehouse_id', value: patch.warehouseId })
        if (patch.status !== undefined) updates.push({ column: 'status', value: patch.status })
        if (patch.purchaseDate !== undefined) updates.push({ column: 'purchase_date', value: patch.purchaseDate })
        if (patch.warrantyEnd !== undefined) updates.push({ column: 'warranty_end', value: patch.warrantyEnd })
        if (patch.vendorId !== undefined) updates.push({ column: 'vendor_id', value: patch.vendorId })
        if (patch.notes !== undefined) updates.push({ column: 'notes', value: patch.notes })

        if (updates.length === 0) {
            const existing = await this.getById(id)
            if (!existing) {
                throw new Error('Asset not found')
            }
            return existing
        }

        const setClause = updates
            .map((update, index) => `${update.column} = $${index + 1}`)
            .join(', ')
        const params = updates.map(update => update.value)
        params.push(id)

        const result = await this.pg.query<AssetRow>(
            `UPDATE assets
             SET ${setClause}, updated_at = NOW()
             WHERE id = $${params.length}
             RETURNING *`,
            params
        )

        return mapAssetRow(result.rows[0])
    }

    async getById(id: string): Promise<AssetRecord | null> {
        const result = await this.pg.query<AssetRow>(
            `${BASE_SELECT}
             WHERE a.id = $1`,
            [id]
        )
        if (result.rows.length === 0) return null
        return mapAssetRow(result.rows[0])
    }

    async getByAssetCode(assetCode: string): Promise<AssetRecord | null> {
        const result = await this.pg.query<AssetRow>(
            `${BASE_SELECT}
             WHERE a.asset_code = $1`,
            [assetCode]
        )
        if (result.rows.length === 0) return null
        return mapAssetRow(result.rows[0])
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.pg.query(
            `DELETE FROM assets WHERE id = $1`,
            [id]
        )
        return (result.rowCount ?? 0) > 0
    }

    async bulkUpsert(items: AssetBulkUpsertInput[]): Promise<AssetBulkUpsertResult> {
        return await this.pg.transaction(async (client) => {
            let created = 0
            let updated = 0
            const records: AssetRecord[] = []

            for (const item of items) {
                const existing = await client.query<{ id: string }>(
                    'SELECT id FROM assets WHERE asset_code = $1',
                    [item.assetCode]
                )

                if (existing.rows.length > 0) {
                    const id = existing.rows[0]?.id as string
                    const updateResult = await client.query<AssetRow>(
                        `UPDATE assets
                         SET asset_code = $1,
                             model_id = $2,
                             serial_no = $3,
                             mac_address = $4,
                             mgmt_ip = $5,
                             hostname = $6,
                             vlan_id = $7,
                             switch_name = $8,
                             switch_port = $9,
                             location_id = $10,
                             status = $11,
                             purchase_date = $12,
                             warranty_end = $13,
                             vendor_id = $14,
                             notes = $15,
                             updated_at = NOW()
                         WHERE id = $16
                         RETURNING *`,
                        [
                            item.assetCode,
                            item.modelId,
                            item.serialNo ?? null,
                            item.macAddress ?? null,
                            item.mgmtIp ?? null,
                            item.hostname ?? null,
                            item.vlanId ?? null,
                            item.switchName ?? null,
                            item.switchPort ?? null,
                            item.locationId ?? null,
                            item.status ?? 'in_stock',
                            item.purchaseDate ?? null,
                            item.warrantyEnd ?? null,
                            item.vendorId ?? null,
                            item.notes ?? null,
                            id
                        ]
                    )
                    records.push(mapAssetRow(updateResult.rows[0]))
                    updated += 1
                } else {
                    const insertResult = await client.query<AssetRow>(
                        `INSERT INTO assets (
                            asset_code,
                            model_id,
                            serial_no,
                            mac_address,
                            mgmt_ip,
                            hostname,
                            vlan_id,
                            switch_name,
                            switch_port,
                            location_id,
                            status,
                            purchase_date,
                            warranty_end,
                            vendor_id,
                            notes
                        ) VALUES (
                            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
                        )
                        RETURNING *`,
                        [
                            item.assetCode,
                            item.modelId,
                            item.serialNo ?? null,
                            item.macAddress ?? null,
                            item.mgmtIp ?? null,
                            item.hostname ?? null,
                            item.vlanId ?? null,
                            item.switchName ?? null,
                            item.switchPort ?? null,
                            item.locationId ?? null,
                            item.status ?? 'in_stock',
                            item.purchaseDate ?? null,
                            item.warrantyEnd ?? null,
                            item.vendorId ?? null,
                            item.notes ?? null
                        ]
                    )
                    records.push(mapAssetRow(insertResult.rows[0]))
                    created += 1
                }
            }

            return { created, updated, items: records }
        })
    }

    async search(filters: AssetSearchFilters): Promise<AssetSearchResult> {
        const { conditions, params } = buildSearchConditions(filters)
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const { page, limit, offset } = normalizePagination(filters)

        const countResult = await this.pg.query<{ count: string }>(
            `SELECT COUNT(*) AS count
             FROM assets a
             LEFT JOIN asset_models m ON a.model_id = m.id
             ${whereClause}`,
            params
        )
        const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

        const orderBy = resolveSort(filters.sort)

        const dataParams = [...params, limit, offset]
        const dataResult = await this.pg.query<AssetRow>(
            `${BASE_SELECT}
             ${whereClause}
             ORDER BY ${orderBy}
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            dataParams
        )

        return {
            items: dataResult.rows.map(mapAssetRow),
            total,
            page,
            limit
        }
    }
}
