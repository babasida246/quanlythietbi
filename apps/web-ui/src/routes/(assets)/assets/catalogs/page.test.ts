import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/svelte'

vi.mock('$lib/api/assetCatalogs', () => ({
  getAssetCatalogs: vi.fn().mockResolvedValue({
    data: { categories: [], vendors: [], models: [], locations: [] }
  }),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createVendor: vi.fn(),
  updateVendor: vi.fn(),
  deleteVendor: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn()
}))

import CatalogsPage from './+page.svelte'

describe('catalogs page', () => {
  it('renders the catalogs header', async () => {
    const { getByText } = render(CatalogsPage)
    await waitFor(() => {
      expect(getByText('Asset Catalogs')).toBeTruthy()
    })
  })
})
