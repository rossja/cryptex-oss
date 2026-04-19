<script lang="ts">
  /**
   * Unified "no provider configured" banner. Renders only when the gateway
   * reports no working API key across any provider. Used by all AI-backed
   * surfaces (tools + chat) to keep the guidance copy + Settings link
   * consistent.
   *
   * Pass `context` to tune the verb:
   *   - 'tool' (default): "Add one in Settings to unlock this tool."
   *   - 'chat': "Add one in Settings before starting a chat."
   */
  import { hasAnyKey } from '$lib/ai/gateway';
  import { base } from '$app/paths';
  import Key from 'lucide-svelte/icons/key';

  type Props = {
    context?: 'tool' | 'chat';
    /** Optional compact layout for narrow containers (sidebar, empty states). */
    compact?: boolean;
  };
  let { context = 'tool', compact = false }: Props = $props();

  const keyConfigured = $derived(hasAnyKey());

  const verb = $derived(
    context === 'chat'
      ? 'before starting a chat'
      : 'to unlock this tool'
  );
</script>

{#if !keyConfigured}
  <div
    class="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 {compact ? 'p-3' : 'p-4'}"
    role="status"
  >
    <Key size={compact ? 14 : 16} class="text-accent mt-0.5 shrink-0" />
    <div class="text-sm">
      <strong class="text-foreground">No provider configured.</strong>
      <span class="text-muted-foreground">
        Add one in
        <a
          href={base + '/settings/'}
          class="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Settings
        </a>
        {verb}. Cryptex supports OpenRouter, Anthropic, and OpenAI-compatible endpoints (Groq, Together, Fireworks, custom).
      </span>
    </div>
  </div>
{/if}
