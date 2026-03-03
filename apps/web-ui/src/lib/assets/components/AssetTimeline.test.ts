import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AssetTimeline from './AssetTimeline.svelte';

describe('AssetTimeline', () => {
  it('renders event entries', () => {
    const { getByText } = render(AssetTimeline, {
      props: {
        events: [{
          id: 'event-1',
          assetId: 'asset-1',
          eventType: 'CREATED',
          payload: {},
          createdAt: new Date().toISOString()
        }]
      }
    });

    expect(getByText('CREATED')).toBeTruthy();
  });
});
