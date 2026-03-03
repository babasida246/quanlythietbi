import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import InventoryScanPanel from './InventoryScanPanel.svelte';

describe('InventoryScanPanel', () => {
  it('renders scan button', () => {
    const { getByRole } = render(InventoryScanPanel, { props: { sessionId: 's1' } });
    // Button may show i18n text or fallback 'Scan'
    const button = getByRole('button');
    expect(button).toBeTruthy();
    expect(button.textContent).toMatch(/Scan|Quét/i);
  });
});
