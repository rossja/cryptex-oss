# Cryptex — Google Analytics 4 + AdSense setup (Beginner's Guide)

You already have Cryptex deployed (see [DEPLOY-DOKPLOY-SUPABASE.md](DEPLOY-DOKPLOY-SUPABASE.md))
and (optionally) Supabase auth + OAuth + custom SMTP wired up
(see [DEPLOY-OAUTH-AND-EMAIL.md](DEPLOY-OAUTH-AND-EMAIL.md)). This
guide covers two more optional pieces:

1. **Google Analytics 4** — anonymous page-view counting, consent-gated.
   Loads only when the user accepts the cookie banner.
2. **Google AdSense** — display ads on the Guide / About / Privacy /
   Terms pages only. Tool pages and chat are 100% ad-free.

Both are **completely optional**. Leave the env vars unset and Cryptex
ships with zero analytics, zero ads, zero consent banner. Set one or
both, and the consent banner + reconciliation logic flips on
automatically.

If your **Google verification (Search Console / AdSense site review)
keeps failing**, this guide also covers what Google actually checks:
Privacy Policy, Terms of Service, contact info, and meaningful original
content. Cryptex now ships `/privacy` and `/terms` routes, so you just
need to point Google at them — see Part C below.

Total time: ~15-20 minutes for GA, ~30-60 minutes for AdSense (Google
takes a while to review).

---

## Part A — Google Analytics 4 (10 minutes)

### A.1 Create a GA4 property

1. Go to <https://analytics.google.com> and sign in with the Google
   account you want to own this analytics property.
2. **Admin** (gear icon, bottom-left) → **Create** → **Account** (skip
   if you already have one).
   - **Account name**: `Cryptex` (or whatever).
   - **Data sharing settings**: leave defaults; uncheck "Modeling
     contributions" if you want strict privacy.
3. **Create Property**:
   - **Property name**: `Cryptex Production`
   - **Reporting time zone**: your timezone
   - **Currency**: your currency
   - Click **Next**.
4. **Business details**:
   - **Industry category**: `Software`
   - **Business size**: pick the smallest tier
   - Click **Next**.
5. **Business objectives**: pick **Get baseline reports** — that's
   sufficient for page-view tracking. Click **Create**.
6. **Data collection setup**:
   - Choose **Web**.
   - **Website URL**: `https://cryptex.your-domain.com`
   - **Stream name**: `Cryptex Web`
   - **Enhanced measurement**: leave ON (auto-tracks scrolls, outbound
     clicks, file downloads — useful + privacy-safe).
   - Click **Create stream**.
7. The next page shows your **Measurement ID** — looks like
   `G-XXXXXXXXXX`. **Copy it.** This is the one value Cryptex needs.

> **Privacy hardening:** Cryptex's GA integration already sets
> `anonymize_ip: true`, disables `allow_google_signals`, and disables
> ads-personalization signals. You don't need to toggle anything else
> in the GA dashboard for GDPR-friendly behavior — but you can also
> enable **Admin → Data Settings → Data Collection → Google signals**
> = OFF for belt-and-braces.

### A.2 Add `PUBLIC_GA_ID` to Dokploy

1. In Dokploy, go to your `cryptex` service → **Environment**.
2. Add this line:
   ```env
   PUBLIC_GA_ID=G-XXXXXXXXXX
   ```
   Replace `G-XXXXXXXXXX` with your Measurement ID from A.1.7.
3. Click **Save**.
4. Click **Deployments** → **Rebuild** (NOT Redeploy — Vite inlines
   `PUBLIC_*` at build time, see DEPLOY-DOKPLOY-SUPABASE.md
   troubleshooting if this trips you up).
5. After ~2-3 minutes the new build is live.

### A.3 Verify GA is working

1. Open the live site `https://cryptex.your-domain.com` in **incognito**
   so you start with a fresh consent state.
2. The cookie banner should appear at the bottom. Click **Accept**.
3. Open browser DevTools → **Network** tab → filter on
   `googletagmanager` and `google-analytics`.
4. Navigate around the site — you should see:
   - One `gtag/js?id=G-…` request after consent (GA loader script)
   - A `g/collect?` request per page navigation (page_view event)
5. In GA dashboard, **Reports → Realtime** should show 1 user (you)
   within ~30 seconds.

If nothing appears:

- Confirm the consent banner was actually accepted — `localStorage`
  key `cryptex.consent.v1` should be `"accepted"` (not `"unknown"`).
- Check the build log for `[cryptex-build] PUBLIC_GA_ID=G-…` — if it
  says `MISSING`, the var didn't reach the build (Rebuild, not
  Redeploy).
- AdBlock plugins block GA. Test in a clean browser profile.

### A.4 Bake in better defaults (optional)

GA4's free tier is fine for Cryptex's traffic levels. If you want to
trim further:

- **Admin → Data Settings → Data Retention** — set to "2 months" (the
  shortest option). User-level data is auto-deleted; aggregate reports
  remain.
- **Admin → Data Streams → Web Stream → Configure tag settings →
  Internal traffic** — register your home IP so your own dev visits
  don't pollute the data.
- **Admin → Property Settings → Property Details → Industry** = `Online
  Communities` if you find Software too vague.

---

## Part B — Google AdSense (varies — Google review takes 1-14 days)

AdSense requires Google to review your site before approving you. Most
rejections come from missing **Privacy Policy**, **Terms of Service**,
**About / Contact** pages, or thin/duplicate content. Cryptex ships
all of these, so you're 80% there from a clean install.

### B.1 Pre-check before applying

Before clicking "Apply" in AdSense, verify each of these:

- [ ] **Site is live on HTTPS.** AdSense rejects non-HTTPS sites.
- [ ] **Privacy Policy is accessible.** Visit `https://cryptex.your-domain.com/privacy` — it must load.
- [ ] **Terms of Service is accessible.** Visit `https://cryptex.your-domain.com/terms` — it must load.
- [ ] **About page is accessible.** Visit `/about` — must load.
- [ ] **Contact info is visible.** The Privacy Policy already includes
      a contact email; if you want a dedicated `/contact` route, add it
      (a 3-line stub with your email is fine).
- [ ] **Site has substantive original content.** Cryptex's Guide alone
      covers this — 16+ pages of original technique writeups. Don't
      apply the day you fork; wait until you have the deploy stable
      and the Guide indexed by Google (Search Console will tell you).
- [ ] **No prohibited content.** AdSense disallows: hacking-tutorials
      *aimed at unauthorized targets*, malware, weapons sales, adult
      content. Cryptex's framing as authorized-use security research
      is OK, but make sure your own additions don't cross into "how
      to attack systems you don't own". Section 3 of `/terms` makes
      this explicit; read it once and keep your branding aligned.

### B.2 Apply for AdSense

1. Go to <https://www.google.com/adsense/start/> and sign up with the
   same Google account you used for GA (recommended — they share
   site verification).
2. **Site URL**: `https://cryptex.your-domain.com`
3. **Country**: yours.
4. **Payment recipient details**: your name / address / tax info as
   required by your country.
5. AdSense gives you an **AdSense code snippet** — looks like:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
   You don't paste this manually — Cryptex loads it automatically when
   you set the publisher ID. Just **copy the publisher ID**:
   `ca-pub-XXXXXXXXXXXXXXXX` (the part after `client=`).
6. AdSense also asks you to **verify ownership** of the site. Three
   options:
   - **AdSense code snippet** (default) — Cryptex's automatic loader
     handles this once you set `PUBLIC_ADSENSE_CLIENT`.
   - **Meta tag** — paste a `<meta>` tag into your `<head>`. Skip
     unless option 1 fails.
   - **Ads.txt file** — Google will tell you to add a file later
     (Part B.5). Not required for initial verification.

### B.3 Add `PUBLIC_ADSENSE_CLIENT` to Dokploy

1. Dokploy → your `cryptex` service → **Environment**:
   ```env
   PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
   ```
   Use the publisher ID from B.2.5.
2. Save → **Rebuild** (not Redeploy).
3. After deploy, visit `https://cryptex.your-domain.com` in incognito.
   The cookie banner appears (it now mentions both ads + analytics if
   both are configured). Accept.
4. Open DevTools → Network → filter on `googlesyndication` — you
   should see the `adsbygoogle.js` script load on Guide / About /
   Privacy / Terms pages. (Tool pages and chat will NOT load it by
   design.)

### B.4 Submit your site for Google's review

In AdSense dashboard, the **Sites** tab shows status:
- **Ready** — site loads, AdSense detected the snippet, you're queued
  for review.
- **Getting ready** — site is reachable but verification snippet not
  detected. Wait 24h after deploy; Google's crawler is slow.
- **Needs attention** — Google found a problem. Click for details and
  address each one (most often: thin content, missing privacy/terms,
  or an actual ad-policy violation).

Click **Request Review**. Google takes anywhere from 24 hours to 2
weeks. They'll email you with the verdict.

### B.5 Add ads.txt (after approval)

Once approved, AdSense asks you to host an `ads.txt` file at your
site root. The content looks like:

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Add it to Cryptex's static `app/static/ads.txt` (create the file if it
doesn't exist):

```bash
echo 'google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0' > app/static/ads.txt
```

(Replace `pub-XXX…` with your publisher ID without the `ca-` prefix —
AdSense shows you the exact line.)

Commit, push, Dokploy rebuilds, the file appears at
`https://cryptex.your-domain.com/ads.txt`. AdSense's crawler picks it
up within a day.

### B.6 Where ads actually render

Cryptex deliberately puts AdSense **only** on these routes:

- `/guide` and all `/guide/*` topic pages
- `/about`
- `/privacy`
- `/terms`

Tool pages, the chat surface, the Dataset Inspector, and Settings are
all 100% ad-free. The AdSense script tag isn't even loaded on those
routes — there's no slowdown, no third-party tracker on tool surfaces.
This is enforced in code (`$lib/ads/AdSlot.svelte` only renders on the
allowed routes); it's not a soft guideline.

If you want to add ad slots to additional routes, edit
`app/src/lib/ads/AdSlot.svelte` and update the policy comment in
`docs/AD-POLICY.md` so future maintainers stay consistent.

---

## Part C — Why Google verification keeps failing (and how the new pages fix it)

Google's verification gates (Search Console, AdSense, Merchant) all
look for the same baseline signals. The most common rejections:

| Rejection reason | What Google means | Where Cryptex now satisfies it |
|---|---|---|
| "Insufficient content" | Site is mostly empty / 1-2 pages / very thin text | `/guide` has 16+ original technique writeups; `/about` describes the project; `/privacy` + `/terms` are full pages |
| "Missing Privacy Policy" | No discoverable page explaining data handling | `/privacy` route, linked from footer on every page, surfaced from cookie banner |
| "Missing Terms of Service" | No published terms users agree to | `/terms` route, linked from footer on every page |
| "No contact information" | Can't find a way to reach the operator | Email in `/privacy` and `/terms` ("Contact" sections); GitHub link in footer |
| "Site doesn't comply with policies" | Could be many things — review the email carefully | Section 3 of `/terms` explicitly scopes use to authorized security research, distancing the site from "how to attack systems you don't own" content |
| "Site not navigable" | Pages don't link to each other; no clear nav | Footer now contains Privacy / Terms / About / GitHub links; HeaderBar always shows ModePill |
| "Verification snippet not found" | AdSense couldn't find the loader | Set `PUBLIC_ADSENSE_CLIENT` and Rebuild — the snippet loads automatically on `/`, `/guide`, `/about`, `/privacy`, `/terms`. Wait 24h after deploy before re-requesting verification |

Pre-flight checklist before re-requesting Google verification:

1. **Privacy Policy reachable?** Open
   `https://cryptex.your-domain.com/privacy` in incognito. It loads,
   has substantive content, includes a contact email, mentions cookies.
2. **Terms of Service reachable?** Open `/terms`. Same checks.
3. **About page reachable?** Open `/about`. Same.
4. **Footer has all four links?** Check the footer of any non-auth
   page — Privacy / Terms / About / GitHub.
5. **Site has been live for at least a few days.** Google sometimes
   declines fresh sites under "still being assessed".
6. **You're not blocking Googlebot.** Open
   `https://cryptex.your-domain.com/robots.txt` if you have one — make
   sure `User-agent: Googlebot` is not disallowed.
7. **Search Console is verified for the same domain.** The fastest
   verification is the same Google account owning Search Console (with
   a verified domain) AND AdSense — Google trusts that domain
   automatically.

---

## Part D — Search Console verification (5 minutes — recommended first)

Verify Search Console **before** AdSense. Same Google account, same
property, fewer false-rejections downstream.

1. Go to <https://search.google.com/search-console>.
2. Click **Add Property** → **URL prefix**.
3. URL: `https://cryptex.your-domain.com`
4. Pick a verification method:
   - **HTML tag** (easiest for static sites) — Google gives you a
     `<meta name="google-site-verification" content="...">` tag.
   - **DNS TXT record** (works regardless of hosting) — Google gives
     you a `TXT` record value to add to your DNS.

#### HTML tag method

Edit `app/src/app.html` and paste the meta tag inside `<head>`:

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="google-site-verification" content="abc123def456..." />
  <!-- ...rest of the head... -->
</head>
```

Commit, push, rebuild. Once deployed, click **Verify** in Search
Console — it should turn green.

#### DNS TXT method

Add a TXT record to your domain:
```
Type   Name   Value                                        TTL
TXT    @      google-site-verification=abc123def456...     Auto
```

Wait 1-5 minutes for propagation, click **Verify**.

#### Submit a sitemap (recommended)

After verification, in Search Console click **Sitemaps** → submit
`https://cryptex.your-domain.com/sitemap.xml` (Cryptex doesn't ship a
sitemap by default — see Part E).

---

## Part E — Optional: ship a sitemap.xml

Helps Google index the Guide pages faster. Three quick options:

**Option 1: Static sitemap (simplest)** — create `app/static/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://cryptex.your-domain.com/</loc><priority>1.0</priority></url>
  <url><loc>https://cryptex.your-domain.com/about/</loc><priority>0.8</priority></url>
  <url><loc>https://cryptex.your-domain.com/privacy/</loc><priority>0.6</priority></url>
  <url><loc>https://cryptex.your-domain.com/terms/</loc><priority>0.6</priority></url>
  <url><loc>https://cryptex.your-domain.com/guide/</loc><priority>0.9</priority></url>
  <url><loc>https://cryptex.your-domain.com/guide/getting-started/</loc><priority>0.8</priority></url>
  <url><loc>https://cryptex.your-domain.com/transforms/</loc><priority>0.8</priority></url>
  <url><loc>https://cryptex.your-domain.com/decode/</loc><priority>0.8</priority></url>
  <!-- add more entries as needed -->
</urlset>
```

Files in `app/static/` are served verbatim — `sitemap.xml` will be live
at `https://cryptex.your-domain.com/sitemap.xml` after the next deploy.

**Option 2: Generated sitemap** — drop in a sitemap generator like
`@svelteuit/sitemap`. Out of scope for this guide but easy if you
already have a custom build pipeline.

**Option 3: Skip it.** Google will eventually crawl the site anyway.
You just get faster initial indexing with a sitemap.

---

## Troubleshooting

### GA shows zero traffic in real-time

1. Did you accept the cookie banner? Open DevTools → Application →
   Local Storage → `cryptex.consent.v1` should be `"accepted"`.
2. AdBlock / privacy extensions block GA. Test in a clean browser.
3. The Network tab should show `https://www.googletagmanager.com/gtag/js?id=G-XXX`
   loading. If it's blocked by CSP, you missed the
   `nginx.conf` update — pull latest.
4. The `g/collect` POST should fire on each navigation. If it doesn't,
   check the browser console for `gtag is not defined` — means the
   loader script didn't load. Check Network for 404s.

### AdSense says "Site not approved" with no details

Common causes (in order):

1. **Domain not old enough.** Google sometimes silently rejects fresh
   domains for ~30 days. Wait, then re-request review.
2. **Privacy / Terms / About not findable from any page.** Footer
   should link to all three. Confirm in incognito.
3. **Search Console not yet verified.** Verify Search Console first
   (Part D), wait a few days for Google to index, then request
   AdSense review.
4. **You're applying with a CDN-only domain (e.g. github.io)** — some
   subdomain TLDs are blocklisted. Use your own domain.

### Ads load on `/transforms` or other tool pages

That should never happen — `AdSlot.svelte` is only mounted on the
allowed routes. If you see ads on a tool page, you've added an
`<AdSlot/>` to that page yourself; remove it. Cryptex's policy is
ad-free tool surfaces (see `docs/AD-POLICY.md`).

### Ads don't appear on Guide / About / Privacy / Terms even after approval

1. Confirm `PUBLIC_ADSENSE_CLIENT` is set + the build log shows
   `[cryptex-build] PUBLIC_ADSENSE_CLIENT=ca-pub-XXX…` (not `MISSING`).
2. Confirm cookie banner accepted (consent gates the loader).
3. AdSense's "Auto ads" mode takes ~10 minutes after the publisher ID
   is detected. Check after a coffee.
4. AdBlock browser extensions hide them client-side — test in
   incognito with extensions disabled.

### Both GA and AdSense load on the same page — is that OK?

Yes. Both share the same consent gate. If a user accepts, both load.
If they reject, neither loads. The cookie banner copy adapts to
whichever services are configured.

---

## Quick reference — env var matrix

| Env var | What it enables | Where to set | Used by |
|---|---|---|---|
| `PUBLIC_GA_ID=G-XXXXXXXXXX` | Google Analytics 4 (anonymous, IP-anonymized) | Dokploy → Environment + Rebuild | Layout effect → `ensureGaState()` |
| `PUBLIC_ADSENSE_CLIENT=ca-pub-XXX...` | Google AdSense ads on Guide/About/Privacy/Terms only | Dokploy → Environment + Rebuild | `ensureAdSenseState()` + `<AdSlot/>` |
| Both unset | Zero analytics, zero ads, no consent banner | n/a | Self-hosted noob default |

That's it. The hardest part of this whole flow is waiting for Google's
review queue.
