<script lang="ts">
  /**
   * Cloud Sync settings panel (v2.2 Wave 10.1).
   *
   * BYO Supabase. User pastes project URL + anon key, hits Enable. Test
   * Connection round-trips the runs table to verify the schema is installed
   * and the key is valid. Initial Sync uploads current local history + Vault
   * customs in one batch.
   *
   * BYOK provider keys never sync. We say so loudly above the form.
   */
  import { syncStore } from '$lib/sync/store.svelte';
  import { isLikelyValidConfig } from '$lib/sync/supabase-provider';
  import { history } from '$lib/history/store.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import Cloud from 'lucide-svelte/icons/cloud';
  import CloudOff from 'lucide-svelte/icons/cloud-off';
  import CheckCircle2 from 'lucide-svelte/icons/circle-check';
  import AlertCircle from 'lucide-svelte/icons/circle-alert';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import ExternalLink from 'lucide-svelte/icons/external-link';

  let url = $state(syncStore.config.supabaseUrl ?? '');
  let key = $state(syncStore.config.supabaseAnonKey ?? '');
  let testing = $state(false);
  let pushing = $state(false);

  const enabled = $derived(syncStore.config.enabled);
  const status = $derived(syncStore.status);
  const canSave = $derived(
    isLikelyValidConfig({
      supabaseUrl: url.trim(),
      supabaseAnonKey: key.trim(),
      enabled: true,
      provider: 'supabase'
    })
  );

  function saveAndEnable() {
    syncStore.updateConfig({
      enabled: true,
      provider: 'supabase',
      supabaseUrl: url.trim(),
      supabaseAnonKey: key.trim()
    });
    notify.success('Cloud Sync enabled');
  }

  function disable() {
    syncStore.updateConfig({ enabled: false });
    notify.info('Cloud Sync disabled. Local data is untouched.');
  }

  async function testConnection() {
    testing = true;
    try {
      // Apply the form values without enabling first, so the in-memory
      // provider matches what the user just typed.
      syncStore.updateConfig({
        supabaseUrl: url.trim(),
        supabaseAnonKey: key.trim()
      });
      const r = await syncStore.validate();
      if (r.ok) {
        notify.success('Supabase connection OK');
      } else {
        notify.error(r.error);
      }
    } finally {
      testing = false;
    }
  }

  async function runInitialSync() {
    pushing = true;
    try {
      // Snapshot local data. We only push user-source Vault items (bundled
      // seeds stay on disk; cloud should reflect the user's contributions).
      const allRuns = history.all;
      // Per-tool Vault customs are scattered under cryptex.vault.<toolId>
      // localStorage keys; collect them here for the bulk push.
      const vaultByTool: Record<string, Array<{ id: string; source: string; [k: string]: unknown }>> = {};
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith('cryptex.vault.')) continue;
          const toolId = k.slice('cryptex.vault.'.length);
          try {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) vaultByTool[toolId] = parsed;
          } catch {
            /* ignore corrupt entries */
          }
        }
      }

      const result = await syncStore.runInitialSync({
        runs: allRuns,
        // Cast: vault items are persisted as VaultItem<unknown> already.
        vaultByTool: vaultByTool as unknown as Record<string, Array<import('$lib/vault/types').VaultItem<unknown>>>
      });

      if ('error' in result) {
        notify.error(result.error);
      } else {
        notify.success(`Pushed ${result.runsPushed} runs + ${result.vaultPushed} vault items`);
      }
    } finally {
      pushing = false;
    }
  }

  function relTime(ts?: number): string {
    if (!ts) return 'never';
    const d = Date.now() - ts;
    if (d < 60_000) return `${Math.max(1, Math.round(d / 1000))}s ago`;
    if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
    if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
    return new Date(ts).toLocaleString();
  }
</script>

<section class="space-y-5">
  <header class="space-y-1">
    <h2 class="flex items-center gap-2 font-serif text-xl">
      <Cloud size={18} class="text-primary" />
      Cloud Sync <span class="font-sans text-xs uppercase tracking-wider text-muted-foreground">BYO Supabase</span>
    </h2>
    <p class="text-sm text-muted-foreground">
      Opt-in cross-device sync of your tool runs and Vault custom items, into a Supabase project you own and control.
      Cryptex itself never sees your data; the sync goes browser straight to your Supabase URL.
    </p>
  </header>

  <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
    <strong>BYOK provider keys never sync.</strong> Your OpenAI / Anthropic / OpenRouter / local-server keys stay in
    <code class="rounded bg-amber-500/10 px-1">localStorage</code> on this device, by design. Only history runs and Vault
    custom items go to your Supabase project.
  </div>

  <!-- Status chip -->
  <div class="flex items-center gap-2 text-sm">
    <span class="text-muted-foreground">Status:</span>
    {#if status.kind === 'disabled'}
      <span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-0.5 text-xs">
        <CloudOff size={12} /> Disabled
      </span>
    {:else if status.kind === 'idle'}
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300"
      >
        <CheckCircle2 size={12} /> Synced ({relTime(status.lastSyncedAt)})
      </span>
    {:else if status.kind === 'syncing'}
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-300"
      >
        <Loader size={12} class="animate-spin" /> Syncing {status.queued} pending
      </span>
    {:else if status.kind === 'error'}
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs text-red-300"
      >
        <AlertCircle size={12} /> {status.message}
      </span>
    {/if}
  </div>

  <!-- Form -->
  <div class="space-y-3 rounded-lg border border-border bg-card/40 p-4">
    <label class="block space-y-1">
      <span class="text-xs uppercase tracking-wider text-muted-foreground">Supabase project URL</span>
      <input
        type="url"
        bind:value={url}
        placeholder="https://abcdefgh.supabase.co"
        autocomplete="off"
        class="w-full rounded-md border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none"
      />
    </label>

    <label class="block space-y-1">
      <span class="text-xs uppercase tracking-wider text-muted-foreground">Anon (public) key</span>
      <input
        type="password"
        bind:value={key}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        autocomplete="off"
        class="w-full rounded-md border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none"
      />
      <span class="text-[11px] text-muted-foreground">
        Settings -> API in your Supabase dashboard. The anon key is public-safe inside YOUR project;
        do not share it with people you do not trust.
      </span>
    </label>

    <div class="flex flex-wrap gap-2 pt-1">
      <button
        type="button"
        onclick={testConnection}
        disabled={!canSave || testing}
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        {#if testing}<Loader size={14} class="animate-spin" />{:else}<CheckCircle2 size={14} />{/if}
        Test connection
      </button>

      {#if !enabled}
        <button
          type="button"
          onclick={saveAndEnable}
          disabled={!canSave}
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-primary hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Cloud size={14} /> Save & enable
        </button>
      {:else}
        <button
          type="button"
          onclick={runInitialSync}
          disabled={pushing}
          class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          {#if pushing}<Loader size={14} class="animate-spin" />{:else}<Cloud size={14} />{/if}
          Sync everything now
        </button>
        <button
          type="button"
          onclick={disable}
          class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CloudOff size={14} /> Disable
        </button>
      {/if}
    </div>
  </div>

  <!-- Setup link -->
  <div class="rounded-lg border border-border bg-card/40 p-4 text-sm">
    <strong class="block mb-1">First-time setup (one-time)</strong>
    <p class="text-muted-foreground">
      Create a Supabase project at <a href="https://supabase.com" class="text-primary hover:underline" target="_blank" rel="noreferrer">supabase.com</a>,
      open the SQL Editor, and paste the schema from
      <a
        href="https://github.com/m4xx101/cryptex-oss/blob/main/docs/SUPABASE.md"
        class="inline-flex items-center gap-1 text-primary hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        docs/SUPABASE.md <ExternalLink size={11} />
      </a>.
      It creates two tables (<code>synced_runs</code>, <code>synced_vault_items</code>) and the RLS policies.
      Then copy your project URL and anon key here.
    </p>
  </div>
</section>
