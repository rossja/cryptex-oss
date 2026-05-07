<script lang="ts">
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { notify } from '$lib/stores/toast.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Shield from 'lucide-svelte/icons/shield';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import Check from 'lucide-svelte/icons/check';
  import X from 'lucide-svelte/icons/x';
  import Mail from 'lucide-svelte/icons/mail';
  import LogOut from 'lucide-svelte/icons/log-out';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Copy from 'lucide-svelte/icons/copy';
  import Check2 from 'lucide-svelte/icons/check';

  // ---------- Account panel state ----------
  // Email is masked by default — full address only revealed on click. Stops
  // shoulder-surfing / screenshot leaks of the user's identifier when the
  // settings panel is open during a screen share.
  let revealEmail = $state(false);
  let copiedEmail = $state(false);

  function maskEmail(email: string | null | undefined): string {
    if (!email) return '—';
    const at = email.indexOf('@');
    if (at < 1) return '•••';
    const [local, domain] = [email.slice(0, at), email.slice(at + 1)];
    const dot = domain.lastIndexOf('.');
    const tld = dot >= 0 ? domain.slice(dot) : '';
    const domainHead = dot >= 0 ? domain.slice(0, dot) : domain;
    const m = (s: string, keepStart = 1, keepEnd = 0) =>
      s.length <= keepStart + keepEnd
        ? s
        : s.slice(0, keepStart) + '•'.repeat(Math.max(2, s.length - keepStart - keepEnd)) + s.slice(s.length - keepEnd);
    return `${m(local, 1, 1)}@${m(domainHead, 1, 0)}${tld}`;
  }

  async function copyEmail() {
    const e = session.current?.email;
    if (!e) return;
    try {
      await navigator.clipboard.writeText(e);
      copiedEmail = true;
      setTimeout(() => { copiedEmail = false; }, 1500);
    } catch {
      // copy failed (clipboard blocked) — fall back silently; user can still reveal + select.
    }
  }

  // ---------- Password change state ----------
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  // Derived from the session API helper so the rule definition lives in
  // one place (and so future callers reading session.hasEmailIdentity get
  // the same answer the panel uses).
  const hasPassword = $derived(session.hasEmailIdentity);

  const rules = $derived([
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'Contains a letter', ok: /[A-Za-z]/.test(newPassword) },
    { label: 'Contains a number', ok: /[0-9]/.test(newPassword) },
    { label: 'Different from current', ok: !hasPassword || (newPassword.length > 0 && newPassword !== currentPassword) }
  ]);

  const passwordsMatch = $derived(newPassword.length > 0 && newPassword === confirmPassword);

  const canSubmit = $derived(
    !busy && rules.every((r) => r.ok) && passwordsMatch && (!hasPassword || currentPassword.length > 0)
  );

  async function submit() {
    if (!canSubmit) return;
    busy = true;
    error = null;
    try {
      if (hasPassword) {
        await session.verifyCurrentPassword(currentPassword);
      }
      await session.updatePassword(newPassword);
      notify.success(hasPassword ? 'Password updated' : 'Password set');
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (e) {
      // Surface the specific re-auth failure ("Current password is
      // incorrect.") since that's what the user can act on. Hide
      // server internals for everything else.
      const msg = (e as Error).message;
      error = /current password/i.test(msg) ? msg : 'Could not update password. Try again.';
    } finally {
      busy = false;
    }
  }

  // ---------- Email change state ----------
  let emailChangeStage = $state<'idle' | 'verify'>('idle');
  let newEmail = $state('');
  let emailReauthPassword = $state('');
  let emailOtp = $state('');
  let emailBusy = $state(false);
  let emailError = $state<string | null>(null);
  let emailInfo = $state<string | null>(null);

  async function requestEmailChange() {
    if (emailBusy) return;
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      emailError = 'Enter a valid email address.';
      return;
    }
    if (newEmail.toLowerCase() === (session.current?.email ?? '').toLowerCase()) {
      emailError = 'New email must differ from the current one.';
      return;
    }
    emailBusy = true;
    emailError = null;
    emailInfo = null;
    try {
      // Belt-and-braces re-auth before triggering email change. Stops a
      // stolen-session attacker from silently swapping the email out from
      // under the real owner.
      if (hasPassword) {
        await session.verifyCurrentPassword(emailReauthPassword);
      }
      await session.requestEmailChange(newEmail);
      emailChangeStage = 'verify';
      emailInfo = `Code sent to ${newEmail}.`;
      emailReauthPassword = '';
    } catch (e) {
      const msg = (e as Error).message;
      emailError = /current password/i.test(msg) ? msg : 'Could not send the code. Check the address and try again.';
    } finally {
      emailBusy = false;
    }
  }

  async function verifyEmailChange() {
    if (emailBusy || !emailOtp) return;
    emailBusy = true;
    emailError = null;
    emailInfo = null;
    try {
      await session.verifyEmailOtp(newEmail, emailOtp, 'email_change');
      notify.success('Email updated');
      emailChangeStage = 'idle';
      newEmail = '';
      emailOtp = '';
    } catch {
      emailError = 'That code is invalid or expired.';
    } finally {
      emailBusy = false;
    }
  }

  // ---------- Sign out everywhere ----------
  let signOutBusy = $state(false);
  async function signOutAll() {
    if (signOutBusy) return;
    if (!confirm('Sign out of every device this account is signed in on? You\'ll need to sign in again on each.')) return;
    signOutBusy = true;
    try {
      await session.signOutAllDevices();
      notify.success('Signed out everywhere');
      void goto(`${base}/login`);
    } catch {
      notify.error('Could not sign out. Try again.');
    } finally {
      signOutBusy = false;
    }
  }
</script>

{#if featureFlags.authEnabled && session.isSignedIn}
  <!-- ===== Account info ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <Shield size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Account</h2>
    </div>
    <div class="rounded-lg border border-border/60 bg-background/30 p-3 text-sm">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="text-[11px] uppercase tracking-wider text-muted-foreground">Signed in as</div>
          <div class="mt-0.5 flex items-center gap-2">
            <span class="font-mono text-[13px] text-foreground break-all">
              {revealEmail ? (session.current?.email ?? '—') : maskEmail(session.current?.email)}
            </span>
            <button
              type="button"
              onclick={() => (revealEmail = !revealEmail)}
              aria-label={revealEmail ? 'Hide email' : 'Show email'}
              title={revealEmail ? 'Hide email' : 'Show email'}
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              {#if revealEmail}<EyeOff size={12} />{:else}<Eye size={12} />{/if}
            </button>
            <button
              type="button"
              onclick={copyEmail}
              aria-label="Copy email"
              title="Copy email"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              {#if copiedEmail}<Check2 size={12} class="text-emerald-500" />{:else}<Copy size={12} />{/if}
            </button>
          </div>
        </div>
        <!-- Provider badge — small icon + label so OAuth users see how they signed in -->
        <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {#if session.primaryProvider === 'google'}
            <svg viewBox="0 0 18 18" class="h-3 w-3" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.32A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.32z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Google
          {:else if session.primaryProvider === 'github'}
            <svg viewBox="0 0 24 24" class="h-3 w-3 fill-current" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.95 10.95 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
            </svg>
            GitHub
          {:else if session.primaryProvider === 'email'}
            <Mail size={10} /> Email
          {:else}
            Account
          {/if}
        </span>
      </div>
    </div>
  </div>

  <!-- ===== Password ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <KeyRound size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Password</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      {#if hasPassword}
        Change your password — you'll need your current one to confirm.
      {:else if session.primaryProvider === 'google' || session.primaryProvider === 'github'}
        You signed in via {session.primaryProvider === 'google' ? 'Google' : 'GitHub'}. You don't have a password — keep using OAuth, or set one below to enable email + password sign-in as an alternative.
      {:else}
        You signed in via email code. Set a password below to enable email + password sign-in.
      {/if}
    </p>

    <form onsubmit={(e) => { e.preventDefault(); void submit(); }} class="flex flex-col gap-3 max-w-sm">
      {#if hasPassword}
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">Current password</span>
          <div class="relative">
            <input
              bind:value={currentPassword}
              type={showPassword ? 'text' : 'password'}
              required
              autocomplete="current-password"
              placeholder="Your existing password"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
        </label>
      {/if}

      <label class="flex flex-col gap-1.5 text-xs">
        <span class="font-medium text-foreground">New password</span>
        <div class="relative">
          <input
            bind:value={newPassword}
            type={showPassword ? 'text' : 'password'}
            required
            minlength="8"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onclick={() => (showPassword = !showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
          </button>
        </div>
        {#if newPassword.length > 0}
          <ul class="mt-1 flex flex-col gap-0.5 text-[11px]">
            {#each rules as rule}
              <li class={rule.ok ? 'flex items-center gap-1 text-foreground' : 'flex items-center gap-1 text-muted-foreground'}>
                {#if rule.ok}<Check size={12} class="text-emerald-500" />{:else}<X size={12} class="text-muted-foreground/60" />{/if}
                <span>{rule.label}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </label>

      <label class="flex flex-col gap-1.5 text-xs">
        <span class="font-medium text-foreground">Confirm new password</span>
        <input
          bind:value={confirmPassword}
          type={showPassword ? 'text' : 'password'}
          required
          autocomplete="new-password"
          placeholder="Repeat the new password"
          class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {#if confirmPassword.length > 0 && !passwordsMatch}
          <span class="text-[11px] text-destructive">Passwords don't match.</span>
        {/if}
      </label>

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >{busy ? 'Saving…' : (hasPassword ? 'Update password' : 'Set password')}</button>
      </div>

      {#if error}
        <p role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
      {/if}
    </form>
  </div>

  <!-- ===== Email change ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <Mail size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Email address</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      We'll send a 6-digit code to the new address. Enter it to confirm the change.
      {#if hasPassword}
        Re-auth with your current password is required.
      {:else}
        Verifying ownership of the new email is the security check.
      {/if}
    </p>

    {#if emailChangeStage === 'idle'}
      <form onsubmit={(e) => { e.preventDefault(); void requestEmailChange(); }} class="flex flex-col gap-3 max-w-sm">
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">New email</span>
          <input
            bind:value={newEmail}
            type="email"
            required
            autocomplete="email"
            spellcheck="false"
            placeholder="new@example.com"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {#if hasPassword}
          <label class="flex flex-col gap-1.5 text-xs">
            <span class="font-medium text-foreground">Current password</span>
            <input
              bind:value={emailReauthPassword}
              type="password"
              required
              autocomplete="current-password"
              placeholder="Confirms it's really you"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        {/if}

        <div>
          <button
            type="submit"
            disabled={emailBusy || !newEmail || (hasPassword && !emailReauthPassword)}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if emailBusy}
              <Loader size={13} class="animate-spin" /> Sending…
            {:else}
              Send code
            {/if}
          </button>
        </div>
      </form>
    {:else}
      <form onsubmit={(e) => { e.preventDefault(); void verifyEmailChange(); }} class="flex flex-col gap-3 max-w-sm">
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">Verification code</span>
          <input
            bind:value={emailOtp}
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]*"
            maxlength="10"
            placeholder="000000"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-center font-mono text-base tracking-[0.4em] shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={emailBusy || !emailOtp}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if emailBusy}
              <Loader size={13} class="animate-spin" /> Verifying…
            {:else}
              Confirm change
            {/if}
          </button>
          <button
            type="button"
            onclick={() => { emailChangeStage = 'idle'; emailOtp = ''; emailError = null; emailInfo = null; }}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 text-xs text-muted-foreground hover:text-foreground"
          >Cancel</button>
        </div>
      </form>
    {/if}

    {#if emailInfo}
      <p role="status" class="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">{emailInfo}</p>
    {/if}
    {#if emailError}
      <p role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{emailError}</p>
    {/if}
  </div>

  <!-- ===== Sessions / sign out everywhere ===== -->
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <LogOut size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Sessions</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      Sign out of every device this account is signed in on. Use this if you suspect your password was leaked, or you're handing the account off.
    </p>
    <button
      type="button"
      onclick={signOutAll}
      disabled={signOutBusy}
      class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
    >
      {#if signOutBusy}
        <Loader size={13} class="animate-spin" /> Signing out…
      {:else}
        <LogOut size={13} /> Sign out everywhere
      {/if}
    </button>
  </div>
{/if}
