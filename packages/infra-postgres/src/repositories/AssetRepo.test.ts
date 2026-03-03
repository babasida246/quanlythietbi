import { describe, it, expect, vi } from 'vitest'
import { AssetRepo } from './AssetRepo.js'
import type { PgClient } from '../PgClient.js'

describe('AssetRepo', () => {
    it('creates asset records', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssetRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'asset-1',
                asset_code: 'ASSET-1',
                model_id: 'model-1',
                serial_no: null,
                mac_address: null,
                mgmt_ip: null,
                hostname: null,
                vlan_id: null,
                switch_name: null,
                switch_port: null,
                location_id: null,
                status: 'in_stock',
                purchase_date: null,
                warranty_end: null,
                vendor_id: null,
                notes: null,
                created_at: new Date(),
                updated_at: new Date()
            }]
        })

        const created = await repo.create({ assetCode: 'ASSET-1', modelId: 'model-1', status: 'in_stock' })
        expect(created.assetCode).toBe('ASSET-1')
        expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO assets'), expect.any(Array))
    })

    it('searches assets with pagination', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssetRepo(pg)

        query
            .mockResolvedValueOnce({ rows: [{ count: '1' }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'asset-2',
                    asset_code: 'ASSET-2',
                model_id: 'model-1',
                serial_no: null,
                mac_address: null,
                mgmt_ip: null,
                hostname: null,
                vlan_id: null,
                    switch_name: null,
                    switch_port: null,
                    location_id: null,
                    status: 'in_stock',
                    purchase_date: null,
                    warranty_end: null,
                    vendor_id: null,
                    notes: null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    model_name: null,
                    model_brand: null,
                    category_name: null,
                    vendor_name: null,
                location_name: null
            }]
        })

        const result = await repo.search({ query: 'ASSET' })
        expect(result.total).toBe(1)
        expect(result.items[0]?.assetCode).toBe('ASSET-2')
        expect(query).toHaveBeenCalledTimes(2)
    })

    it('gets asset by code', async () => {
        const query = vi.fn()
        const pg = { query } as unknown as PgClient
        const repo = new AssetRepo(pg)

        query.mockResolvedValueOnce({
            rows: [{
                id: 'asset-3',
                asset_code: 'ASSET-3',
                model_id: 'model-1',
                serial_no: null,
                mac_address: null,
                mgmt_ip: null,
                hostname: null,
                vlan_id: null,
                switch_name: null,
                switch_port: null,
                location_id: null,
                status: 'in_stock',
                purchase_date: null,
                warranty_end: null,
                vendor_id: null,
                notes: null,
                created_at: new Date(),
                updated_at: new Date(),
                model_name: null,
                model_brand: null,
                category_name: null,
                vendor_name: null,
                location_name: null
            }]
        })

        const result = await repo.getByAssetCode('ASSET-3')
        expect(result?.assetCode).toBe('ASSET-3')
    })
})
