<script lang="ts">
  /**
   * Update-available banner. Renders above the HeaderBar when a newer
   * Cryptex release exists on GitHub. Dismissible per version so dismissing
   * v2.5.1's banner doesn't suppress v2.6.0's. Silent when no update
   * available, when the check failed, or when the user disabled the
   * Settings → "Check for updates on launch" toggle.
   */
  import { onMount } from 'svelte';
  import { checkForUpdate, type UpdateInfo } from '$lib/release/update-check';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import { APP_RELEASE_URL_FOR } from '$lib/config/version';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import X from 'lucide-svelte/icons/x';
  import ExternalLink from 'lucide-svelte/icons/external-link';

  // User opt-out toggle. Default ON.
  const enabled = createPersistedState<boolean>('cryptex.updateCheck.enabled', true);

  let info = $state<UpdateInfo | null>(null);

  const dismissedKey = $derived(info ? `cryptex.updateDismissed.${info.latest}` : '');
  let dismissed = $state(false);

  function readDismissed(version: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      return localStorage.getItem(`cryptex.updateDismissed.${version}`) === '1';
    } catch {
      return false;
    }
  }

  function writeDismissed(version: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`cryptex.updateDismissed.${version}`, '1');
    } catch {
      /* ignore quota */
    }
  }

  function dismiss(): void {
    if (info) writeDismissed(info.latest);
    dismissed = true;
  }

  onMount(() => {
    if (!enabled.value) return;
    const controller = new AbortController();
    void checkForUpdate({ signal: controller.signal }).then((r) => {
      if (!r || !r.hasUpdate) return;
      if (readDismissed(r.latest)) {
        dismissed = true;
        info = r;
        return;
      }
      info = r;
    });
    return () => controller.abort();
  });

  const visible = $derived(!!info && info.hasUpdate && !dismissed);
  const releaseUrl = $derived(info ? APP_RELEASE_URL_FOR(info.latest) : '#');
</script>

{#if visible && info}
  <div
    role="status"
    aria-live="polite"
    class="flex w-full items-center justify-center gap-2 border-b border-primary/30 bg-primary/5 px-3 py-1.5 text-[12px] text-foreground sm:text-sm"
  >
    <Sparkles size={14} class="shrink-0 text-primary" aria-hidden="true" />
    <span class="truncate">
      <span class="hidden sm:inline">Cryptex</span>
      <strong>v{info.latest}</strong> is available
      <span class="hidden text-muted-foreground sm:inline">(you have v{info.current})</span>
    </span>
    <a
      href={releaseUrl}
      target="_blank"
      rel="noreferrer noopener"
      class="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
    >
      See what's new <ExternalLink size={11} aria-hidden="true" />
    </a>
    <button
      type="button"
      onclick={dismiss}
      aria-label="Dismiss update banner"
      class="ml-1 inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <X size={14} />
    </button>
  </div>
{/if}
