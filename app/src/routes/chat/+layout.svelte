<script lang="ts">
  import ChatShell from '$lib/components/chat/ChatShell.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
  import AuthRequiredOverlay from '$lib/components/auth/AuthRequiredOverlay.svelte';
  import { onMount } from 'svelte';
  import { installChatShortcuts } from '$lib/stores/chatShortcuts.svelte';
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  let { children } = $props();
  onMount(() => installChatShortcuts());

  // Auth gate (production-grade): when auth is enabled in this build and the
  // session has hydrated and the user isn't signed in, render the chat
  // skeleton behind a sign-in modal instead of bouncing to /login. Why:
  //   - The previous redirect-on-mount UX flickered ("Redirecting to sign
  //     in…") and dropped users into a blank /login screen disconnected
  //     from the feature they were trying to use.
  //   - The overlay preserves visual context — users see what /chat looks
  //     like (dimmed) and the sign-in card is centred over it. After auth
  //     completes Supabase returns to /auth/callback → /chat with no
  //     manual navigation. One smooth flow, no URL ping-pong.
  //
  // We MUST still wait for `session.isReady` before deciding — otherwise a
  // signed-in user reloading /chat would see the modal flash for a frame
  // before Supabase finishes hydrating localStorage and isSignedIn flips
  // to true.
  const showAuthGate = $derived(
    featureFlags.authEnabled && session.isReady && !session.isSignedIn
  );
</script>

{#if featureFlags.authEnabled && !session.isReady}
  <!-- Hydrating Supabase session — show a tiny loading state to avoid the
       flash of unauthenticated UI between first paint and the auth resolve. -->
  <p class="m-auto mt-24 text-center text-sm text-muted-foreground">Loading…</p>
{:else}
  <RouteShell skeleton="chat">
    {#if showAuthGate}
      <!-- Render the chat skeleton (empty state) behind the modal so the
           user sees their destination, dimmed. We deliberately do NOT
           render <ChatShell> with the actual children here — the children
           include +page.svelte which would query Dexie + spin up real
           streams. Empty grid + modal is the entire surface. -->
    {:else}
      <ChatShell>{@render children?.()}</ChatShell>
    {/if}
  </RouteShell>
  {#if showAuthGate}
    <AuthRequiredOverlay
      title="Sign in to start chatting"
      description="Your conversations stay on this device by default. Sign in to use BYOK encrypted vault, sync across devices, and unlock the chat playground."
    />
  {/if}
{/if}
