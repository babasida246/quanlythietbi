import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
  it('renders status label', () => {
    const { getByText } = render(StatusBadge, { props: { status: 'in_stock' } });
    expect(getByText('in stock')).toBeTruthy();
  });
});
