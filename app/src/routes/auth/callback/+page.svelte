<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { supabase } from '$lib/auth/supabase';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';

  let message = $state('Signing you in…');
  let detail = $state<string | null>(null);
  let showOtpFallback = $state(false);
  let isError = $state(false);

  onMount(async () => {
    if (!supabase) {
      void goto(`${base}/`);
      return;
    }

    // 1. If we already have a session (e.g. user reloaded /auth/callback with
    //    a stale URL after signing in elsewhere), short-circuit to /chat.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      void goto(`${base}/chat`);
      return;
    }

    // 2. Inspect URL params for OAuth-style errors first. These come from
    //    Supabase BEFORE any code exchange — link expired, redirect not in
    //    allow-list, OAuth consent denied, etc.
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const err = params.get('error') ?? hashParams.get('error');
    const errDesc = params.get('error_description') ?? hashParams.get('error_description');
    const errCode = params.get('error_code') ?? hashParams.get('error_code');

    if (err || errDesc) {
      handleProviderError(err, errDesc, errCode);
      return;
    }

    if (!params.get('code')) {
      message = 'Redirecting to sign in…';
      setTimeout(() => void goto(`${base}/login`), 1000);
      return;
    }

    // 3. PKCE exchange. Pass the full search string so the SDK can extract
    //    the code; it then reads the code_verifier from localStorage.
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.search);

    if (error) {
      isError = true;
      // PKCE-specific error: link opened in a different browser than the
      // one that initiated sign-in.
      if (/code verifier/i.test(error.message) || /code_verifier/i.test(error.message)) {
        message = 'Sign-in failed';
        detail = 'Open the email link in the same browser you started sign-in from. Or use the 6-digit code below — it works from any browser.';
      } else {
        message = 'Sign-in failed';
        detail = 'Try again or use the 6-digit code from your email.';
      }
      showOtpFallback = true;
      return;
    }

    if (data.session) {
      void goto(`${base}/chat`);
    } else {
      isError = true;
      message = 'Sign-in incomplete';
      detail = 'No session was returned. Request a new sign-in code below.';
      showOtpFallback = true;
    }
  });

  function handleProviderError(err: string | null, desc: string | null, code: string | null) {
    isError = true;

    // Token-consumed-by-prefetcher / expired link is the #1 cause of this
    // error in production (Outlook Safe Links, Gmail link-protection,
    // antivirus link-scanners HEAD-request emails to scan for malware,
    // consuming the single-use Supabase token before the user clicks).
    const expiredish =
      code === 'otp_expired' ||
      /expired|invalid/i.test(desc ?? '') ||
      err === 'access_denied';

    if (expiredish) {
      message = 'Sign-in link no longer valid';
      detail =
        'Email security scanners sometimes open single-use sign-in links before you click them. Use the 6-digit code from the email instead — it\'s prefetch-resistant.';
    } else if (err === 'server_error' || /server/i.test(desc ?? '')) {
      message = 'Sign-in service issue';
      detail = 'Try again in a moment, or use the 6-digit code from your email.';
    } else {
      message = 'Sign-in could not complete';
      detail = 'Try again, or use the 6-digit code from your email.';
    }
    showOtpFallback = true;
  }
</script>

<svelte:head><title>Signing in… · Cryptex</title></svelte:head>

<div class="m-auto mt-16 flex max-w-md flex-col items-center gap-6 px-6 sm:mt-24">
  {#if !isError}
    <p class="text-center text-sm text-muted-foreground">{message}</p>
  {:else}
    <div class="w-full space-y-5 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-glass">
      <div class="space-y-1.5 text-center">
        <h1 class="font-serif text-2xl tracking-tight">{message}</h1>
        {#if detail}
          <p class="text-sm leading-relaxed text-muted-foreground">{detail}</p>
        {/if}
      </div>

      {#if showOtpFallback}
        <div class="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div class="flex items-center gap-2 font-medium text-foreground">
            <KeyRound size={14} class="text-primary" />
            Use the 6-digit code instead
          </div>
          <p class="text-[12px] leading-relaxed text-muted-foreground">
            Open your email, copy the 6-digit code, then sign in with the code. Codes work from any browser and survive email-link scanners.
          </p>
        </div>
      {/if}

      <div class="flex flex-col gap-2">
        <a
          href="{base}/login"
          class="group inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          Enter sign-in code
          <ArrowRight size={14} class="transition-transform group-hover:translate-x-0.5" />
        </a>
        <a
          href="{base}/login"
          class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm font-medium transition-colors hover:bg-muted/40"
        >
          <RefreshCw size={14} /> Request a new email
        </a>
      </div>
    </div>
  {/if}
</div>
