import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import VendorCatalog from './VendorCatalog.svelte'

describe('VendorCatalog', () => {
  it('renders vendor rows', () => {
    const { getByText } = render(VendorCatalog, {
      props: { vendors: [{ id: 'v1', name: 'Dell' }] }
    })
    expect(getByText('Dell')).toBeTruthy()
  })
})
