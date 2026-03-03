import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import StatusCatalog from './StatusCatalog.svelte'

describe('StatusCatalog', () => {
  it('renders status table', () => {
    const { getByText } = render(StatusCatalog)
    expect(getByText('In stock')).toBeTruthy()
  })
})
