<script lang="ts">
  /**
   * Production-grade "sign in to continue" modal overlay.
   *
   * Replaces the historic "redirect-to-/login on chat open" UX with a
   * seamless overlay that:
   *
   *   - Renders on top of the destination route (chat, etc.) so the user's
   *     visual context is preserved — the page they meant to visit is
   *     visible (dimmed + blurred) behind the card. No abrupt URL change.
   *
   *   - Offers the three sign-in paths in priority order: Google OAuth,
   *     GitHub OAuth, email + password (links out to /login). Sign-up is
   *     a tertiary link below.
   *
   *   - Stays accessible: role="dialog" + aria-modal=true, Escape-to-close
   *     (returns to the home route), focus is moved into the dialog on
   *     mount, click-outside is intentionally NOT close-to-cancel —
   *     exactly because the user landed here meaning to use a feature
   *     that requires auth, so we keep the choice explicit (Cancel link
   *     at the bottom of the card, plus the small X in the corner).
   *
   *   - Localises all OAuth error messages to a single neutral string
   *     ("Sign-in could not complete. Try again.") — never echoes provider
   *     payloads back to the page (defense against fingerprinting +
   *     account-existence enumeration).
   *
   * Re-usable across routes — designed for /chat first but the chat
   * layout, settings panel, dataset inspector, and similar can all mount
   * this when `featureFlags.authEnabled && session.isReady && !session.isSignedIn`.
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { session } from '$lib/auth/session.svelte';
  import Logo from '$lib/components/brand/Logo.svelte';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import Mail from 'lucide-svelte/icons/mail';
  import Lock from 'lucide-svelte/icons/lock';
  import X from 'lucide-svelte/icons/x';
  import Loader from 'lucide-svelte/icons/loader-circle';

  type Props = {
    /** Heading. Default: "Sign in to continue". Routes pass route-specific copy. */
    title?: string;
    /** Subtitle / value-prop line. Default speaks to chat persistence. */
    description?: string;
    /** Where to send the user when they cancel. Defaults to the home route. */
    cancelHref?: string;
  };
  let {
    title = 'Sign in to continue',
    description = 'Your conversations are saved to your account, encrypted, and synced across devices.',
    cancelHref = `${base}/`
  }: Props = $props();

  let busy = $state<'google' | 'github' | null>(null);
  let error = $state<string | null>(null);

  // Focus the primary action when the modal mounts so keyboard users land
  // inside the dialog instead of the outer document. Production-grade a11y.
  let primaryButton: HTMLButtonElement | undefined;
  onMount(() => {
    primaryButton?.focus();
  });

  function neutralFail() {
    // Production-grade: never echo provider error strings (rate-limit shape,
    // account-existence hints, OAuth redirect-uri mismatches). One neutral
    // message regardless of underlying cause.
    error = 'Sign-in could not complete. Try again.';
  }

  async function google() {
    if (busy) return;
    busy = 'google'; error = null;
    try {
      await session.signInWithGoogle();
    } catch {
      neutralFail();
      busy = null;
    }
  }

  async function github() {
    if (busy) return;
    busy = 'github'; error = null;
    try {
      await session.signInWithGitHub();
    } catch {
      neutralFail();
      busy = null;
    }
  }

  function handleEsc(e: KeyboardEvent) {
    // Escape returns the user to the cancel destination — same UX as a
    // discreet "back out" affordance. We don't trap it because there's
    // nothing destructive to confirm, and it matches platform expectations.
    if (e.key === 'Escape') {
      void goto(cancelHref, { replaceState: true });
    }
  }
</script>

<svelte:window onkeydown={handleEsc} />

<!-- Backdrop: full-screen, dimmed + blurred so the chat shell behind reads
     as "where you're going" without competing for attention. Blur depth
     keeps brand chrome (header, navigation) recognisable so users don't
     feel disoriented. -->
<div
  class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md fade-in"
  role="dialog"
  aria-modal="true"
  aria-labelledby="auth-required-title"
  aria-describedby="auth-required-desc"
>
  <div
    class="glass relative w-full max-w-sm space-y-5 rounded-2xl border border-white/10 p-6 shadow-2xl card-rise"
  >
    <!-- Discreet cancel chip in the top corner — the cancel link at the
         bottom is the primary affordance, this is a courtesy for users
         who like the corner X pattern. -->
    <a
      href={cancelHref}
      class="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      aria-label="Cancel and go back"
    >
      <X size={14} />
    </a>

    <!-- Brand mark — gives the modal weight and tells the user this is
         Cryptex's auth surface, not a third-party prompt. -->
    <div class="flex items-center justify-center gap-2.5">
      <Logo size={26} />
      <Wordmark size="md" />
    </div>

    <!-- Heading + value prop. Center-aligned so it reads as a call-to-action,
         not a form label. -->
    <div class="space-y-2 text-center">
      <h2 id="auth-required-title" class="font-serif text-xl font-semibold leading-tight">
        {title}
      </h2>
      <p id="auth-required-desc" class="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>

    <!-- OAuth — primary path. Two big buttons, brand colours per provider
         convention (Google's multicolour mark, GitHub's monochrome). -->
    <div class="space-y-2">
      <button
        bind:this={primaryButton}
        type="button"
        onclick={google}
        disabled={busy !== null}
        class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
      >
        {#if busy === 'google'}
          <Loader size={14} class="animate-spin" />
        {:else}
          <svg viewBox="0 0 18 18" class="h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.32A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.32z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
        {/if}
        Continue with Google
      </button>

      <button
        type="button"
        onclick={github}
        disabled={busy !== null}
        class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
      >
        {#if busy === 'github'}
          <Loader size={14} class="animate-spin" />
        {:else}
          <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.95 10.95 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
          </svg>
        {/if}
        Continue with GitHub
      </button>
    </div>

    {#if error}
      <p class="text-center text-xs text-destructive" role="alert">{error}</p>
    {/if}

    <!-- Divider with "or" — separates OAuth (one-click) from email path
         (multi-step). Keeps OAuth's primacy without hiding the alternative. -->
    <div class="flex items-center gap-3" aria-hidden="true">
      <div class="h-px flex-1 bg-border/30"></div>
      <span class="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
      <div class="h-px flex-1 bg-border/30"></div>
    </div>

    <!-- Email path — links to /login (full sign-in form lives there). -->
    <a
      href="{base}/login"
      class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
    >
      <Mail size={14} />
      Sign in with email
    </a>

    <!-- Sign-up footer — small, tertiary so it doesn't compete with the
         primary OAuth row but discoverable for new users. -->
    <p class="text-center text-xs text-muted-foreground">
      Don't have an account?
      <a href="{base}/signup" class="font-medium text-primary hover:underline">Sign up</a>
    </p>

    <!-- Privacy reassurance — single line, matches the footer voice on
         /login. Production-grade trust signal. -->
    <p class="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
      <Lock size={10} />
      Keys + chat data stay on your device unless you opt in.
    </p>
  </div>
</div>

<style>
  /* Smooth fade-in so the modal feels intentional, not flicked-on. The
     content card gets a subtle rise + scale so the eye tracks it. */
  .fade-in {
    animation: fade-in 180ms ease-out both;
  }
  .card-rise {
    animation: card-rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes card-rise {
    from { opacity: 0; transform: translateY(6px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  /* Respect users with reduced-motion preferences — no surprise animation. */
  @media (prefers-reduced-motion: reduce) {
    .fade-in, .card-rise { animation: none; }
  }
</style>
