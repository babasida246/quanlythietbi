import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import CategoryCatalog from './CategoryCatalog.svelte'

describe('CategoryCatalog', () => {
  it('renders categories', () => {
    const { getByText } = render(CategoryCatalog, {
      props: { categories: [{ id: 'c1', name: 'Laptops' }] }
    })
    expect(getByText('Laptops')).toBeTruthy()
  })
})
