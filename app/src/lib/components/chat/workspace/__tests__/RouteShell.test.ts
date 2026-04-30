import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import RouteShell from '../RouteShell.svelte';

const textSnippet = (text: string) =>
  createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('RouteShell', () => {
  beforeEach(() => {
    sessionStorage.removeItem('cryptex.routeShell.warm');
  });

  it('renders a skeleton on cold mount when skeleton="chat"', async () => {
    render(RouteShell, { props: { skeleton: 'chat', children: textSnippet('BODY') } });
    expect(document.querySelector('.skeleton-overlay')).toBeTruthy();
    // getByText throws if not found; truthy assertion keeps the type-checker happy
    // without depending on jest-dom ambient types.
    expect(screen.getByText('BODY')).toBeTruthy();
  });

  it('marks subsequent mounts as warm via sessionStorage', async () => {
    render(RouteShell, { props: { skeleton: 'chat', children: textSnippet('A') } });
    await tick();
    render(RouteShell, { props: { skeleton: 'chat', children: textSnippet('B') } });
    await tick();
    const overlays = document.querySelectorAll('.skeleton-overlay');
    expect(overlays.length).toBeLessThanOrEqual(1);
  });
});
