/**
 * Interactivity regression guard (v2.7.x incident).
 *
 * The home-route Campaign tool mounted a goal->sharedContext mirror $effect
 * that looped (effect_update_depth_exceeded) and crashed hydration, leaving the
 * whole SPA non-interactive while the prerendered HTML still rendered fine.
 * Render-only verification missed it. Mounting the component here flushes its
 * effects synchronously, so an unbroken loop would throw on render — turning a
 * "looks fine but is dead" deploy into a failing test.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import CampaignTool from '../CampaignTool.svelte';

afterEach(() => cleanup());

describe('CampaignTool mount smoke', () => {
  it('mounts without throwing (guards the effect-update-depth crash)', () => {
    expect(() => render(CampaignTool)).not.toThrow();
  });

  it('renders real content (the Campaign heading), not a dead shell', () => {
    const { container } = render(CampaignTool);
    expect(container.querySelector('h1')?.textContent).toContain('Campaign');
  });
});
