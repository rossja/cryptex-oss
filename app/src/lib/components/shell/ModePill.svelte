<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { chatMode } from '$lib/stores/chatMode.svelte';
  import { cn } from '$lib/utils/cn';
  import MessageSquare from 'lucide-svelte/icons/message-square';
  import Wrench from 'lucide-svelte/icons/wrench';

  /**
   * Routes that are NOT tool surfaces. Used both to derive the active pill
   * (any of these = chat-mode highlights "Tools" by default? No — these are
   * "in between" routes. We treat /chat as Chat, everything else as Tools)
   * and to decide whether clicking "Tools" should navigate.
   */
  const NON_TOOL_PREFIXES = [
    '/chat',
    '/login',
    '/signup',
    '/auth',
    '/settings',
    '/guide',
    '/privacy',
    '/terms',
    '/about',
    '/dataset'
  ];

  function pathFromUrl(): string {
    return $page.url.pathname.replace(base, '') || '/';
  }

  function isOnChat(path: string): boolean {
    return path.startsWith('/chat');
  }

  function isOnToolRoute(path: string): boolean {
    return !NON_TOOL_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
  }

  function selectMode(next: 'chat' | 'tools') {
    chatMode.value = next;
    const currentPath = pathFromUrl();

    if (next === 'chat') {
      // Always land on /chat unless we're already there.
      if (!isOnChat(currentPath)) goto(`${base}/chat`);
      return;
    }

    // next === 'tools' — navigate to a tool surface unless the user is
    // already on one. This covers chat → tools (canonical) but ALSO
    // /guide → tools, /settings → tools, /privacy → tools, /login → tools,
    // which used to fall through silently.
    if (!isOnToolRoute(currentPath)) {
      // /transforms is the canonical first tool tab. The home route ("/")
      // also redirects there, so either works — using /transforms makes
      // the URL meaningful immediately without a flash through home.
      goto(`${base}/transforms/`);
    }
  }

  // Reconcile chatMode with the current URL on every navigation so the pill
  // accurately reflects where the user actually is, not a stale localStorage
  // value left over from a prior session. /chat → 'chat'; everything else →
  // 'tools' (including the in-between routes like /guide and /settings, so
  // the "Tools" pill stays highlighted there until the user clicks "Chat").
  $effect(() => {
    const currentPath = pathFromUrl();
    const derived: 'chat' | 'tools' = isOnChat(currentPath) ? 'chat' : 'tools';
    if (chatMode.value !== derived) chatMode.value = derived;
  });

  const active = $derived(chatMode.value);
</script>

<div role="group" aria-label="App mode" class="inline-flex items-center rounded-full border border-border bg-card/60 p-0.5 text-xs">
  <button
    type="button"
    aria-pressed={active === 'chat'}
    onclick={() => selectMode('chat')}
    class={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
      active === 'chat'
        ? 'bg-primary text-primary-foreground shadow-primary'
        : 'text-muted-foreground hover:text-foreground'
    )}
  >
    <MessageSquare size={12} /> Chat
  </button>
  <button
    type="button"
    aria-pressed={active === 'tools'}
    onclick={() => selectMode('tools')}
    class={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors',
      active === 'tools'
        ? 'bg-primary text-primary-foreground shadow-primary'
        : 'text-muted-foreground hover:text-foreground'
    )}
  >
    <Wrench size={12} /> Tools
  </button>
</div>
