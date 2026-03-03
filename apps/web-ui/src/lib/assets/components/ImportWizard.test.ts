import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ImportWizard from './ImportWizard.svelte';

describe('ImportWizard', () => {
  it('renders modal title', () => {
    const { getByText } = render(ImportWizard, { props: { open: true } });
    expect(getByText('Import Assets')).toBeTruthy();
  });
});
