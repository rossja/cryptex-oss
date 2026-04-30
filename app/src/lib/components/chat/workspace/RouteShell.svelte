<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import ChatSkeleton from './ChatSkeleton.svelte';
  import ToolsSkeleton from './ToolsSkeleton.svelte';

  type Props = {
    skeleton?: 'chat' | 'tools' | null;
    children: Snippet;
  };
  let { skeleton = null, children }: Props = $props();

  // Cold-load = first mount in this browser session. We use sessionStorage
  // so route navigations within the same session use the fast fade only.
  let coldLoad = $state(false);
  let mounted = $state(false);

  onMount(() => {
    if (typeof window === 'undefined') return;
    coldLoad = !sessionStorage.getItem('cryptex.routeShell.warm');
    sessionStorage.setItem('cryptex.routeShell.warm', '1');
    // Two-frame delay: first frame renders skeleton, second swaps to content.
    requestAnimationFrame(() => requestAnimationFrame(() => { mounted = true; }));
  });
</script>

<div class="route-shell" class:warm={!coldLoad} class:mounted>
  {#if coldLoad && skeleton && !mounted}
    <div class="skeleton-overlay" aria-hidden="true">
      {#if skeleton === 'chat'}
        <ChatSkeleton />
      {:else if skeleton === 'tools'}
        <ToolsSkeleton />
      {/if}
    </div>
  {/if}
  <div class="content">{@render children()}</div>
</div>

<style>
  .route-shell { position: relative; height: 100%; min-height: 0; }
  .content {
    height: 100%;
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  .route-shell.warm .content,
  .route-shell.mounted .content {
    opacity: 1;
  }
  .skeleton-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    animation: skeleton-fade-out 250ms 200ms ease-out forwards;
    pointer-events: none;
  }
  @keyframes skeleton-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
</style>
