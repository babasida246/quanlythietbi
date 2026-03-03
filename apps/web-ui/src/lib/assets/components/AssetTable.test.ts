import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AssetTable from './AssetTable.svelte';

describe('AssetTable', () => {
  it('renders asset rows', () => {
    const { getByText } = render(AssetTable, {
      props: {
        assets: [{
          id: 'asset-1',
          assetCode: 'ASSET-1',
          status: 'in_stock',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      }
    });

    expect(getByText('ASSET-1')).toBeTruthy();
  });
});
