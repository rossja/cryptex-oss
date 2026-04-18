<script lang="ts">
  import type { ChatRow, MessageRow } from '$lib/chat/types';
  import { sendTurn } from '$lib/chat/dispatch';
  import { byCategory } from '$lib/chat/techniques/registry';
  import type { Technique } from '$lib/chat/techniques/types';
  import ModePills from './ModePills.svelte';
  import SendStopButton from './SendStopButton.svelte';
  import SlashSuggestions from './SlashSuggestions.svelte';

  type Props = {
    chat: ChatRow;
    activeMode: string | null;
    onModeChange: (id: string | null) => void;
    onMessageAppended: (msg: MessageRow) => void;
    onStreamingChanged: (streaming: boolean) => void;
    onTextDelta?: (delta: string) => void;
    onReasoningDelta?: (delta: string) => void;
  };
  let { chat, activeMode, onModeChange, onMessageAppended, onStreamingChanged, onTextDelta, onReasoningDelta }: Props = $props();

  let draft = $state('');
  let streaming = $state(false);
  let ctrl = $state<AbortController | null>(null);
  let suggestionIndex = $state(0);
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  // Only the 9 PromptCraft mutators are slash-completable
  const mutators = byCategory('mutate');

  // Synthetic slash entries (not registered Techniques)
  type SlashEntry = { id: string; name: string; description: string; icon?: string };

  const BTW_ENTRY: SlashEntry = { id: 'btw', name: 'btw', description: 'Side question, no chat history', icon: '💬' };

  // Slash autocomplete: only trigger when draft starts with / and has no space yet
  const slashQuery = $derived(() => {
    const m = draft.match(/^\/(\S*)$/);
    return m ? m[1] : null;
  });

  const suggestions = $derived((): SlashEntry[] => {
    const q = slashQuery();
    if (q === null) return [];
    const lower = q.toLowerCase();
    const mutatorEntries: SlashEntry[] = mutators.filter(
      (t) => t.id.startsWith(lower) || t.name.toLowerCase().includes(lower)
    );
    const btwMatches = BTW_ENTRY.id.startsWith(lower) || BTW_ENTRY.name.includes(lower);
    return btwMatches ? [BTW_ENTRY, ...mutatorEntries] : mutatorEntries;
  });

  // Reset selection when suggestions change
  $effect(() => {
    void suggestions();
    suggestionIndex = 0;
  });

  async function send() {
    if (!draft.trim() || streaming) return;
    streaming = true; onStreamingChanged(true);
    ctrl = new AbortController();
    const text = draft;
    draft = '';
    if (textareaEl) textareaEl.style.height = 'auto';

    // Use the in-memory activeMode from parent (instant, no DB round-trip needed)
    // Build a chat snapshot with the current activeMode for dispatch
    const chatWithMode: ChatRow = { ...chat, settings: { ...chat.settings, activeMode } };

    await sendTurn(chatWithMode, text, ctrl.signal, {
      onTextDelta: (d) => onTextDelta?.(d),
      onReasoningDelta: (d) => onReasoningDelta?.(d),
      onFinish: (msg) => { onMessageAppended(msg); },
      onError: (err) => { console.error('[sendTurn]', err); }
    });

    streaming = false; onStreamingChanged(false); ctrl = null;
  }

  function stop() { ctrl?.abort(); }

  function completeSuggestion(t: SlashEntry) {
    draft = `/${t.id} `;
    suggestionIndex = 0;
  }

  function onKeydown(e: KeyboardEvent) {
    const suggs = suggestions();
    if (suggs.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); suggestionIndex = (suggestionIndex + 1) % suggs.length; return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); suggestionIndex = (suggestionIndex - 1 + suggs.length) % suggs.length; return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); completeSuggestion(suggs[suggestionIndex]); return; }
      if (e.key === 'Escape') { draft = ''; return; }
    }
    // Enter sends; Shift+Enter inserts newline naturally
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
  }

  function onInput(e: Event) {
    const ta = e.currentTarget as HTMLTextAreaElement;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';
  }
</script>

<div class="composer-textarea relative mt-3 rounded-lg border border-border/60 bg-card/50 p-3">
  <!-- Slash suggestions popover -->
  <SlashSuggestions
    suggestions={suggestions()}
    selectedIndex={suggestionIndex}
    onSelect={completeSuggestion}
  />

  <div class="mb-2 flex items-center gap-2"><ModePills {activeMode} {onModeChange} /></div>
  <div class="flex items-end gap-2">
    <textarea
      bind:this={textareaEl}
      bind:value={draft}
      onkeydown={onKeydown}
      oninput={onInput}
      rows="2"
      placeholder="Type a message, or /slash a technique… (Enter to send, Shift+Enter for newline)"
      class="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
    ></textarea>
    <SendStopButton {streaming} disabled={!draft.trim()} onSend={send} onStop={stop} />
  </div>
</div>
