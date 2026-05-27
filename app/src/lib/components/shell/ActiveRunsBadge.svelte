<script lang="ts">
  /**
   * Global "X running" badge — always-visible HeaderBar indicator that
   * surfaces in-flight runs from every tool, not just the currently-open
   * route. Closes the visibility gap: a user can start a long PromptCraft
   * fan-out, navigate to /history or /settings, and still see at a glance
   * that 1 run is in flight, with a click-through link back to its route.
   */
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { activeRuns } from '$lib/stores/activeRuns.svelte';
  import { tabs } from './TabRail.svelte';
  import Loader from 'lucide-svelte/icons/loader-circle';

  const runningCount = $derived(activeRuns.runningCount);
  const runningList = $derived(
    activeRuns.values.filter((r) => r.status === 'running')
  );

  let open = $state(false);

  /** Resolve a toolId to a tab descriptor so we can render a label + icon + link. */
  function findTab(toolId: string): typeof tabs[number] | undefined {
    return tabs.find((t) => t.toolId === toolId);
  }

  function formatElapsed(startedAt: number): string {
    const ms = Date.now() - startedAt;
    if (ms < 1000) return '<1s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h`;
  }

  async function gotoTool(href: string): Promise<void> {
    open = false;
    await goto(base + href);
  }
</script>

{#if runningCount > 0}
  <div class="relative">
    <button
      type="button"
      onclick={() => (open = !open)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`${runningCount} tool${runningCount === 1 ? '' : 's'} running`}
      title={`${runningCount} tool${runningCount === 1 ? '' : 's'} running`}
      class="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
    >
      <Loader size={12} class="animate-spin" />
      <span>{runningCount}</span>
      <span class="hidden sm:inline">running</span>
    </button>

    {#if open}
      <!-- Click-outside backdrop -->
      <button
        type="button"
        aria-label="Close running tools popover"
        onclick={() => (open = false)}
        class="fixed inset-0 z-40 w-full cursor-default bg-transparent"
      ></button>

      <div
        role="dialog"
        aria-label="Running tools"
        class="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card/95 p-2 shadow-glass backdrop-blur-sm"
      >
        <h3 class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Running ({runningCount})
        </h3>
        <ul class="flex flex-col gap-1">
          {#each runningList as run (run.toolId)}
            {@const tab = findTab(run.toolId)}
            <li>
              <button
                type="button"
                onclick={() => tab && gotoTool(tab.href)}
                disabled={!tab}
                class="flex w-full items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {#if tab}
                  <tab.icon size={14} class="shrink-0 text-primary" />
                  <span class="flex-1 truncate">{tab.label}</span>
                {:else}
                  <Loader size={14} class="shrink-0 animate-spin text-primary" />
                  <span class="flex-1 truncate font-mono text-xs">{run.toolId}</span>
                {/if}
                <span class="shrink-0 text-[10px] text-muted-foreground">
                  {formatElapsed(run.startedAt)}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}
