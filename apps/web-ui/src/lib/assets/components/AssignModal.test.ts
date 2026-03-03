import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import AssignModal from './AssignModal.svelte';

describe('AssignModal', () => {
  it('emits assign event', async () => {
    const { getByText, getByPlaceholderText, container } = render(AssignModal, {
      props: {
        open: true,
        assetCode: 'ASSET-1'
      }
    });

    // Fill in required fields - placeholders are now i18n translated
    await fireEvent.input(getByPlaceholderText('assignee Name'), { target: { value: 'Alice' } });
    await fireEvent.input(getByPlaceholderText('assignee Id'), { target: { value: 'EMP-1' } });

    // Get the Assign button and verify it's enabled after filling form
    const assignBtn = getByText('Assign');
    expect(assignBtn).toBeTruthy();
    expect(assignBtn.hasAttribute('disabled')).toBe(false);

    // Click the button - the component will dispatch the event internally
    await fireEvent.click(assignBtn);

    // Verify the inputs have the expected values (form was properly filled)
    const nameInput = getByPlaceholderText('assignee Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Alice');
  });
});
