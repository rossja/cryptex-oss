<script lang="ts">
  import type { ChatRow, MessageRow } from '$lib/chat/types';
  import { repo } from '$lib/chat/repo';
  import { continueAssistantMessage, regenerateAssistantMessage } from '$lib/chat/dispatch';
  import ChatHeader from './ChatHeader.svelte';
  import MessageList from './MessageList.svelte';
  import Composer from '../composer/Composer.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import { onMount } from 'svelte';

  type Props = { chat: ChatRow };
  let { chat }: Props = $props();
  let messages = $state<MessageRow[]>([]);
  let streaming = $state(false);
  let messageListEl = $state<{ scrollToBottom: () => void; scrollToBottomIfPinned: () => void } | null>(null);

  let streamingContent = $state('');
  let streamingReasoning = $state('');

  let activeMode = $state<string | null>(chat.settings.activeMode ?? null);
  $effect(() => { activeMode = chat.settings.activeMode ?? null; });

  async function refresh() { messages = await repo.listMessages(chat.id); }
  $effect(() => { refresh(); });

  // Re-query Dexie when another part of the app (e.g. the chain-session
  // "Send to main chat" action) writes messages to this chat out-of-band.
  function handleMessagesUpdated(e: Event) {
    const ce = e as CustomEvent<{ chatId: string; origin?: string }>;
    if (!ce.detail || ce.detail.chatId !== chat.id) return;
    void refresh();
  }

  onMount(() => {
    window.addEventListener('cryptex.chat.messages.updated', handleMessagesUpdated);
    return () => window.removeEventListener('cryptex.chat.messages.updated', handleMessagesUpdated);
  });

  $effect(() => {
    messages.length;
    messageListEl?.scrollToBottom();
  });

  function onMessageAppended(msg: MessageRow) {
    // Flush any pending delta batch before swapping the streaming placeholder
    // out for the persisted message — otherwise the last few tokens can be
    // lost between the final rAF and the swap.
    flushDeltaBuffer();
    messages = [...messages, msg];
    refresh();
    streamingContent = '';
    streamingReasoning = '';
  }

  // rAF-batched delta handler. For big responses the text-delta event fires
  // hundreds of times per second. Doing `streamingContent += delta` + a
  // `tick()`-awaiting scroll call on every delta starved the main thread
  // and the SSE stream backed up, sometimes dropping the tail entirely.
  // We accumulate all deltas emitted between frames and flush once per
  // animation frame — visually indistinguishable, MUCH kinder to the UI
  // thread.
  let pendingText = '';
  let pendingReasoning = '';
  let rafPending = false;
  function flushDeltaBuffer() {
    if (pendingText) {
      streamingContent += pendingText;
      pendingText = '';
    }
    if (pendingReasoning) {
      streamingReasoning += pendingReasoning;
      pendingReasoning = '';
    }
    messageListEl?.scrollToBottomIfPinned();
    rafPending = false;
  }
  function scheduleFlush() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(flushDeltaBuffer);
  }
  function onTextDelta(delta: string) {
    pendingText += delta;
    scheduleFlush();
  }
  function onReasoningDelta(delta: string) {
    pendingReasoning += delta;
    scheduleFlush();
  }

  // Stream error banner — populated when Composer / continueAssistantMessage
  // emits `chat:stream-error`. Auto-clears after 6s or on next send.
  let streamError = $state<string | null>(null);
  let streamErrorTimer: ReturnType<typeof setTimeout> | null = null;
  function showStreamError(msg: string) {
    streamError = msg;
    if (streamErrorTimer) clearTimeout(streamErrorTimer);
    streamErrorTimer = setTimeout(() => (streamError = null), 6000);
  }
  function dismissStreamError() {
    streamError = null;
    if (streamErrorTimer) clearTimeout(streamErrorTimer);
  }

  let continueCtrl = $state<AbortController | null>(null);

  async function handleContinueMessage(messageId: string) {
    if (streaming) return;
    streaming = true;
    continueCtrl = new AbortController();
    try {
      await continueAssistantMessage(chat, messageId, continueCtrl.signal, {
        onTextDelta,
        onReasoningDelta,
        onFinish: (msg) => onMessageAppended(msg),
        onError: (err) => {
          console.error('[continue]', err);
          showStreamError((err as Error)?.message || String(err));
        }
      });
    } catch (err) {
      console.error('[continue] unhandled', err);
      showStreamError((err as Error)?.message || String(err));
    } finally {
      streaming = false;
      continueCtrl = null;
    }
  }

  /** Regenerate replaces the prior assistant message in place. The
   *  dispatch routine tombstones the old reply, then streams a new one
   *  via the same onMessageAppended path used by send. We refresh
   *  messages afterwards to drop the tombstoned row from the view. */
  async function handleRegenerateMessage(messageId: string) {
    if (streaming) return;
    streaming = true;
    continueCtrl = new AbortController();
    try {
      await regenerateAssistantMessage(chat, messageId, continueCtrl.signal, {
        onTextDelta,
        onReasoningDelta,
        onFinish: (msg) => {
          // Replace the tombstoned message with the new one + sweep stale
          // rows out of the view.
          messages = messages.filter((m) => m.id !== messageId);
          onMessageAppended(msg);
        },
        onError: (err) => {
          console.error('[regenerate]', err);
          showStreamError((err as Error)?.message || String(err));
        }
      });
    } catch (err) {
      console.error('[regenerate] unhandled', err);
      showStreamError((err as Error)?.message || String(err));
    } finally {
      streaming = false;
      continueCtrl = null;
    }
  }

  onMount(() => {
    const continueHandler = (e: Event) => {
      const id = (e as CustomEvent<{ messageId: string }>).detail?.messageId;
      if (typeof id === 'string') void handleContinueMessage(id);
    };
    window.addEventListener('chat:continue-message', continueHandler);

    const regenerateHandler = (e: Event) => {
      const id = (e as CustomEvent<{ messageId: string }>).detail?.messageId;
      if (typeof id === 'string') void handleRegenerateMessage(id);
    };
    window.addEventListener('chat:regenerate-message', regenerateHandler);

    /** Soft-delete just removes the row from the view; repo already
     *  flipped tombstoned in IndexedDB. */
    const deletedHandler = (e: Event) => {
      const id = (e as CustomEvent<{ messageId: string }>).detail?.messageId;
      if (typeof id !== 'string') return;
      messages = messages.filter((m) => m.id !== id);
    };
    window.addEventListener('chat:message-deleted', deletedHandler);

    const streamErrorHandler = (e: Event) => {
      const msg = (e as CustomEvent<{ message: string }>).detail?.message;
      if (typeof msg === 'string') showStreamError(msg);
    };
    window.addEventListener('chat:stream-error', streamErrorHandler);

    return () => {
      window.removeEventListener('chat:continue-message', continueHandler);
      window.removeEventListener('chat:regenerate-message', regenerateHandler);
      window.removeEventListener('chat:message-deleted', deletedHandler);
      window.removeEventListener('chat:stream-error', streamErrorHandler);
    };
  });

</script>

<div class="flex h-full w-full min-h-0 overflow-hidden">
  <div class="fade-in flex h-full min-w-0 min-h-0 flex-1 flex-col gap-2 overflow-hidden">
    <ChatHeader {chat} />
    <div class="px-3 pt-1"><NoProviderBanner context="chat" compact={true} /></div>
    {#if streamError}
      <div class="mx-3 mt-1 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
        <span class="flex-1"><strong>Stream interrupted:</strong> {streamError}</span>
        <button type="button" onclick={dismissStreamError} aria-label="Dismiss" class="rounded p-1 hover:bg-destructive/20">×</button>
      </div>
    {/if}
    <MessageList
      bind:this={messageListEl}
      {chat}
      {messages}
      {streaming}
      {streamingContent}
      {streamingReasoning}
    />

    <Composer
      {chat}
      {activeMode}
      {onMessageAppended}
      {onTextDelta}
      {onReasoningDelta}
      onStreamingChanged={(v) => (streaming = v)}
    />
  </div>
</div>
