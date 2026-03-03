import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AttachmentList from './AttachmentList.svelte';

describe('AttachmentList', () => {
  it('shows empty state', () => {
    const { getByText } = render(AttachmentList, { props: { assetId: 'a1', attachments: [] } });
    expect(getByText('No attachments uploaded.')).toBeTruthy();
  });
});
