import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AttachmentUploader from './AttachmentUploader.svelte';

describe('AttachmentUploader', () => {
  it('renders upload button', () => {
    const { getByText } = render(AttachmentUploader, { props: { assetId: 'a1' } });
    expect(getByText('Upload')).toBeTruthy();
  });
});
