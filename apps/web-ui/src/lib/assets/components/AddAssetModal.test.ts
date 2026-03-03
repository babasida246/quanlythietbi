import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AddAssetModal from './AddAssetModal.svelte';

describe('AddAssetModal', () => {
  it('emits create when submitted', async () => {
    let submitted = false;
    const { getByPlaceholderText, getByText, container } = render(AddAssetModal, {
      props: {
        open: true,
        models: [{ id: 'm1', model: 'Model 1', spec: {} }],
        oncreate: () => {
          submitted = true;
        }
      }
    });

    const assetInput = getByPlaceholderText('ASSET-001') as HTMLInputElement;
    await fireEvent.input(assetInput, { target: { value: 'ASSET-1' } });

    const select = container.querySelector('select') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'm1' } });

    await fireEvent.click(getByText('Create'));
    expect(submitted).toBe(true);
  });
});
