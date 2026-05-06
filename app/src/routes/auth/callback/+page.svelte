<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { supabase } from '$lib/auth/supabase';

  let message = $state('Signing you in…');
  let detail = $state<string | null>(null);

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

    // 2. The URL must contain ?code=…  (PKCE) or an OAuth error param.
    const params = new URL(window.location.href).searchParams;
    const oauthError = params.get('error') || params.get('error_description');
    if (oauthError) {
      message = `Sign-in failed: ${decodeURIComponent(oauthError)}`;
      detail = 'Common causes: redirect URL not in Supabase allow-list, OAuth app not configured, or you cancelled the consent screen.';
      setTimeout(() => void goto(`${base}/login`), 4000);
      return;
    }

    if (!params.get('code')) {
      // Fragment-style legacy flow (?type=recovery, #access_token=…) used by
      // older Supabase email links. Fall back to letting the SDK parse the
      // fragment via setSession — this rarely happens with current
      // Supabase, but support it so old emails in flight don't break.
      message = 'No auth code in URL. Redirecting…';
      setTimeout(() => void goto(`${base}/login`), 1500);
      return;
    }

    // 3. PKCE exchange. Pass the full search string so the SDK can extract
    //    the code; it then reads the code_verifier from localStorage.
    const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.search);

    if (error) {
      message = `Sign-in failed: ${error.message}`;
      // Diagnostic hint for the most common PKCE failure mode — useful when
      // the user opens the email link in a different browser than the one
      // that initiated the request.
      if (/code verifier/i.test(error.message) || /code_verifier/i.test(error.message)) {
        detail = 'This usually means the email link was opened in a different browser, profile, or device than the one that started sign-in. Re-request the link and open it in the same browser.';
      }
      setTimeout(() => void goto(`${base}/login`), 4000);
      return;
    }

    if (data.session) {
      void goto(`${base}/chat`);
    } else {
      message = 'Sign-in returned no session. Redirecting…';
      setTimeout(() => void goto(`${base}/login`), 2000);
    }
  });
</script>

<div class="m-auto mt-24 max-w-md px-6 text-center">
  <p class="text-sm text-muted-foreground">{message}</p>
  {#if detail}
    <p class="mt-3 text-[12px] leading-relaxed text-muted-foreground/80">{detail}</p>
  {/if}
</div>
