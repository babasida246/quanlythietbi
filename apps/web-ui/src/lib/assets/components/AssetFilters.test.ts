import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AssetFilters from './AssetFilters.svelte';

describe('AssetFilters', () => {
  it('emits apply on button click', async () => {
    let applied = false;
    const { getByText } = render(AssetFilters, {
      props: {
        query: '',
        status: '',
        categoryId: '',
        vendorId: '',
        modelId: '',
        locationId: '',
        categories: [{ id: 'c1', name: 'Servers' }],
        vendors: [{ id: 'v1', name: 'Dell' }],
        models: [{ id: 'm1', name: 'R740' }],
        locations: [{ id: 'l1', name: 'HQ' }],
        onapply: () => {
          applied = true;
        }
      }
    });

    await fireEvent.click(getByText('Apply'));
    expect(applied).toBe(true);
  });
});
