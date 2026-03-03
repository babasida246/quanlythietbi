import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import LocationCatalog from './LocationCatalog.svelte'

describe('LocationCatalog', () => {
  it('renders location rows', () => {
    const { getByRole } = render(LocationCatalog, {
      props: { locations: [{ id: 'l1', name: 'HQ', path: '/l1' }] }
    })
    expect(getByRole('cell', { name: 'HQ' })).toBeTruthy()
  })
})
