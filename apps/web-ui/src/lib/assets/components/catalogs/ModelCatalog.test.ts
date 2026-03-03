import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ModelCatalog from './ModelCatalog.svelte'

describe('ModelCatalog', () => {
  it('renders model rows', () => {
    const { getByText } = render(ModelCatalog, {
      props: {
        models: [{
          id: 'm1',
          model: 'Latitude',
          brand: 'Dell',
          categoryId: 'c1',
          vendorId: 'v1',
          spec: {}
        }],
        categories: [{ id: 'c1', name: 'Laptop' }],
        vendors: [{ id: 'v1', name: 'Dell' }]
      }
    })
    expect(getByText('Latitude')).toBeTruthy()
  })
})
