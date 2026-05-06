<script lang="ts">
  /**
   * Usage hint button + popover. Renders a small bulb icon that, when
   * clicked, opens a themed popover with the usage bullets — saves the
   * vertical space the old <UsageCard> sidebar tile took, and keeps the
   * help discoverable next to the tool's title.
   *
   * Theme-aware: uses bg-popover / text-popover-foreground / border-border
   * tokens so it's correct in both light and dark modes without bespoke CSS.
   *
   * Accessibility: button has aria-expanded, popover has role=dialog +
   * aria-label, Escape closes, click-outside closes.
   */
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import Lightbulb from 'lucide-svelte/icons/lightbulb';
  import X from 'lucide-svelte/icons/x';
  import type { Component } from 'svelte';

  interface Props {
    title?: string;
    icon?: Component;
    bullets: string[];
    note?: string;
    /** Where to anchor the popover relative to the trigger. Default 'right'
     *  works for tools where the trigger sits next to the H1; switch to
     *  'left' on right-aligned UIs. */
    align?: 'left' | 'right';
  }
  let {
    title = 'Usage',
    icon,
    bullets,
    note,
    align = 'left'
  }: Props = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | undefined = $state();
  let popoverEl: HTMLDivElement | undefined = $state();

  const Icon = $derived(icon ?? Lightbulb);

  function close() {
    open = false;
    // Return focus to the trigger so keyboard users don't lose context.
    triggerEl?.focus();
  }

  function toggle() {
    open = !open;
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (popoverEl?.contains(target)) return;
    if (triggerEl?.contains(target)) return;
    open = false;
  }

  onMount(() => {
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });
</script>

<div class="relative inline-flex">
  <button
    bind:this={triggerEl}
    type="button"
    onclick={toggle}
    aria-expanded={open}
    aria-controls="usage-hint-popover"
    aria-label="Open {title.toLowerCase()} guide"
    title="{title} · click for help"
    class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
  >
    <Icon size={14} />
  </button>

  {#if open}
    <!-- Backdrop catches click-outside on small viewports where the
         popover floats over content; mousedown handler does the rest. -->
    <div
      class="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px] sm:hidden"
      transition:fade={{ duration: 120 }}
      aria-hidden="true"
    ></div>

    <div
      bind:this={popoverEl}
      id="usage-hint-popover"
      role="dialog"
      aria-modal="false"
      aria-label="{title}"
      transition:fly={{ y: -4, duration: 160 }}
      class={
        'absolute top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-border bg-popover text-popover-foreground shadow-glass ring-1 ring-black/5 dark:ring-white/5 ' +
        (align === 'right' ? 'right-0' : 'left-0')
      }
    >
      <div class="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div class="flex items-center gap-1.5 text-[12px] font-medium">
          <Icon size={12} class="text-primary" />
          <span>{title}</span>
        </div>
        <button
          type="button"
          onclick={close}
          aria-label="Close"
          class="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={11} />
        </button>
      </div>
      <ul class="space-y-1 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        {#each bullets as b}
          <li class="flex gap-1.5">
            <span aria-hidden="true" class="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/60"></span>
            <span>{b}</span>
          </li>
        {/each}
      </ul>
      {#if note}
        <p class="border-t border-border/60 bg-background/40 px-3 py-2 text-[11px] italic leading-relaxed text-muted-foreground">
          {note}
        </p>
      {/if}
    </div>
  {/if}
</div>
