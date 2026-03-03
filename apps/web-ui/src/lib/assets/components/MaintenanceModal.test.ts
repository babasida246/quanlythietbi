import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MaintenanceModal from './MaintenanceModal.svelte';

describe('MaintenanceModal', () => {
  it('emits submit event', async () => {
    let fired = false;
    const { getByText, getByPlaceholderText } = render(MaintenanceModal, {
      props: {
        open: true,
        assetCode: 'ASSET-1',
        onsubmit: () => {
          fired = true;
        }
      }
    });

    await fireEvent.input(getByPlaceholderText('Issue summary'), { target: { value: 'Fan noise' } });
    await fireEvent.click(getByText('Create'));

    expect(fired).toBe(true);
  });
});
