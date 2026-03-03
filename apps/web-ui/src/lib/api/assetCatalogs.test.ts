import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiJsonMock } = vi.hoisted(() => ({
    apiJsonMock: vi.fn()
}))

vi.mock('./httpClient', () => ({
    API_BASE: 'http://example.test',
    apiJson: apiJsonMock
}))

vi.mock('./assets', () => ({
    getAssetHeaders: () => ({})
}))

describe('assetCatalogs api', () => {
    beforeEach(() => {
        apiJsonMock.mockReset()
    })

    it('calls catalogs endpoint', async () => {
        const { getAssetCatalogs } = await import('./assetCatalogs')
        const { API_BASE } = await import('./httpClient')
        apiJsonMock.mockResolvedValue({
            data: {
                categories: [{ id: 'c1', name: 'Category' }],
                locations: [{ id: 'l1', name: 'HQ', path: '/hq' }],
                vendors: [{ id: 'v1', name: 'Vendor' }],
                models: [{ id: 'm1', model: 'Model', spec: {} }]
            }
        })
        const result = await getAssetCatalogs()
        expect(apiJsonMock).toHaveBeenCalledWith(`${API_BASE}/v1/assets/catalogs`, expect.any(Object))
        expect(result.data.categories).toHaveLength(1)
        expect(result.data.models[0]?.brand ?? null).toBeNull()
    })
})
