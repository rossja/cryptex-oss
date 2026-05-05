<script lang="ts">
  import ChatShell from '$lib/components/chat/ChatShell.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
  import { onMount } from 'svelte';
  import { installChatShortcuts } from '$lib/stores/chatShortcuts.svelte';
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  let { children } = $props();
  onMount(() => installChatShortcuts());

  // Auth gate: when auth is enabled in this build and the user isn't signed
  // in, redirect to /login. Falls back to no gate when authEnabled is false
  // (local dev / static-only deploys without Supabase).
  $effect(() => {
    if (featureFlags.authEnabled && !session.isSignedIn) {
      void goto(`${base}/login`, { replaceState: true });
    }
  });
</script>

{#if featureFlags.authEnabled && !session.isSignedIn}
  <!-- Brief "redirecting" placeholder so the route doesn't flash unauthenticated
       UI before the goto() in the effect resolves. -->
  <p class="m-auto mt-24 text-center text-sm text-muted-foreground">Redirecting to sign in…</p>
{:else}
  <RouteShell skeleton="chat">
    <ChatShell>{@render children?.()}</ChatShell>
  </RouteShell>
{/if}
