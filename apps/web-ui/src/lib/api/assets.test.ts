import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportAssetsCsv, listAssets } from './assets'

const { apiJsonMock, authorizedFetchMock } = vi.hoisted(() => ({
    apiJsonMock: vi.fn(),
    authorizedFetchMock: vi.fn()
}))

vi.mock('./httpClient', () => ({
    API_BASE: 'http://example.com',
    apiJson: apiJsonMock,
    authorizedFetch: authorizedFetchMock,
    requireAccessToken: () => 'test-access-token'
}))

describe('assets api', () => {
    beforeEach(() => {
        apiJsonMock.mockReset()
        authorizedFetchMock.mockReset()
        localStorage.clear()
        localStorage.setItem('authToken', 'test-access-token')
    })

    it('builds list assets query', async () => {
        apiJsonMock.mockResolvedValue({ data: [] })
        await listAssets({ query: 'asset', page: 2 })
        expect(apiJsonMock).toHaveBeenCalledWith(
            'http://example.com/v1/assets?query=asset&page=2',
            { headers: {} }
        )
    })

    it('exports assets as csv', async () => {
        authorizedFetchMock.mockResolvedValue({ ok: true, text: async () => 'csv-data' })
        const result = await exportAssetsCsv({ status: 'in_stock' })
        expect(result).toBe('csv-data')
        expect(authorizedFetchMock).toHaveBeenCalledWith(
            'http://example.com/v1/assets?status=in_stock&export=csv',
            { headers: {} }
        )
    })
})
