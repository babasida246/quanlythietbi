import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportsPanel from './ReportsPanel.svelte';

describe('ReportsPanel', () => {
  it('renders empty state', () => {
    const { getByText } = render(ReportsPanel, { props: { title: 'Status', rows: [] } });
    expect(getByText('No data available.')).toBeTruthy();
  });
});
