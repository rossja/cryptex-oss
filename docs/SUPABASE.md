# Cloud Sync setup (BYO Supabase)

Cryptex OSS supports opt-in cross-device sync of two data classes:

1. **History runs** — every tool invocation gets logged to `synced_runs`.
2. **Vault custom items** — items you add via any tool's Vault drawer go to `synced_vault_items`.

**Never synced:** your BYOK provider keys (OpenAI, Anthropic, OpenRouter, local-server URLs). Those stay in `localStorage` on the device that entered them, by design.

This guide is a one-time setup: create a Supabase project, run the schema, paste the URL + anon key into Settings -> Cloud Sync.

## 1. Create a Supabase project (5 minutes)

1. Sign up at <https://supabase.com> (free tier is plenty for personal use).
2. Click **New project**. Pick a name and a strong DB password (you will not need it again for Cryptex).
3. Wait ~60 seconds for provisioning.

## 2. Apply the schema

1. In your project dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Paste the entire block below and click **Run**.

```sql
-- Cryptex OSS Cloud Sync schema (v2.2)
-- Tables: synced_runs, synced_vault_items
-- RLS posture: this is YOUR project. The anon key has full access.
--   Do not share the anon key with people you do not trust.

-- ============================================================
-- Table: synced_runs
-- One row per tool invocation. Idempotent on `id`.
-- ============================================================
create table if not exists public.synced_runs (
  id              text primary key,
  tool_id         text not null,
  started_at      bigint not null,
  finished_at     bigint not null,
  duration_ms     bigint,
  status          text not null check (status in ('done', 'error', 'cancelled')),
  input_summary   text,
  output_summary  text,
  params          jsonb default '{}'::jsonb,
  size_bytes      integer,
  pinned          boolean default false,
  annotation      text,
  error_category  text,
  error_message   text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_synced_runs_tool      on public.synced_runs(tool_id);
create index if not exists idx_synced_runs_started   on public.synced_runs(started_at desc);
create index if not exists idx_synced_runs_pinned    on public.synced_runs(pinned) where pinned = true;

-- Updated_at trigger
create or replace function public.touch_synced_runs() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_synced_runs on public.synced_runs;
create trigger trg_touch_synced_runs
  before update on public.synced_runs
  for each row execute procedure public.touch_synced_runs();

-- ============================================================
-- Table: synced_vault_items
-- One row per Vault custom item the user added in any tool.
-- ============================================================
create table if not exists public.synced_vault_items (
  id              text primary key,
  tool_id         text not null,
  title           text not null,
  description     text,
  payload         jsonb not null,
  tags            text[] default '{}'::text[],
  source          text not null check (source in ('bundled', 'user')),
  source_url      text,
  license         text,
  added_at        bigint not null,
  pinned          boolean default false,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_synced_vault_tool   on public.synced_vault_items(tool_id);
create index if not exists idx_synced_vault_added  on public.synced_vault_items(added_at desc);

create or replace function public.touch_synced_vault() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_synced_vault on public.synced_vault_items;
create trigger trg_touch_synced_vault
  before update on public.synced_vault_items
  for each row execute procedure public.touch_synced_vault();

-- ============================================================
-- Row Level Security
-- This is YOUR project. The anon role has full access to both tables.
-- Keep the anon key private to you; do not share it.
-- ============================================================
alter table public.synced_runs        enable row level security;
alter table public.synced_vault_items enable row level security;

drop policy if exists "Anon full access on runs"  on public.synced_runs;
drop policy if exists "Anon full access on vault" on public.synced_vault_items;

create policy "Anon full access on runs"
  on public.synced_runs
  for all
  to anon
  using (true)
  with check (true);

create policy "Anon full access on vault"
  on public.synced_vault_items
  for all
  to anon
  using (true)
  with check (true);
```

When you click **Run**, you should see "Success. No rows returned." That is the expected outcome.

## 3. Copy your project URL and anon key

1. In the Supabase dashboard, go to **Settings** -> **API** (left sidebar).
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon / public** key (a long JWT-shaped string starting with `eyJ...`). NOT the service-role key. The anon key is project-scoped and safe to keep on your own device.

## 4. Wire it up in Cryptex

1. Open Cryptex (`docker run` or your hosted instance).
2. Settings -> Cloud Sync.
3. Paste the URL and anon key.
4. Click **Test connection**. You should see "Supabase connection OK".
5. Click **Save & enable**.
6. Optional: click **Sync everything now** to push your existing local history and Vault customs in one batch.

From this point on, every tool run + every Vault custom item you add syncs in the background to your Supabase project.

## What gets synced

| Source | Destination | Contents |
|---|---|---|
| `history.record()` | `synced_runs` | toolId, timestamps, status, truncated input/output summaries, params, pin/annotation state |
| Vault `add` / `edit` / `togglePin` | `synced_vault_items` | id, toolId, title, description, payload, tags, license, addedAt |

## What does NOT sync

- BYOK provider keys (OpenAI / Anthropic / OpenRouter / local). They live in `localStorage` only.
- Theme, favorites, lastUsed (per-device preferences).
- Bundled Vault seeds (we do not pollute your Supabase with our own seed data; only `source: 'user'` items sync).
- Full input/output payloads beyond the 2 KB summary. The full payload lives in your browser's IndexedDB. If you want cross-device full-payload sync, that's a follow-on; today the summary is what crosses the wire.

## How the sync behaves

- **Fire-and-forget.** Local writes never wait on the network. If your Supabase project is unreachable, the local UX is unchanged; the SyncStatus chip in Settings flips to `error` with the reason.
- **Idempotent upsert.** Records are keyed by Cryptex's own `id` (`r_xxx` for runs, `v_xxx` for Vault items). Multiple syncs of the same record overwrite by id.
- **Last-write-wins.** On conflict, the most recent `updated_at` wins. There is no per-field merge.
- **Soft deletion is not implemented yet.** When you delete locally, we issue a `DELETE` immediately. Records on Supabase removed this way are gone.

## Security model

You provide the Supabase project. Cryptex sends data only to the URL you paste. There is no Cryptex-side server.

The anon key has full row access in your project (see RLS policy above). Anyone with the anon key can read and write your two tables. Treat it as a credential.

If you want strict access control beyond "the anon key is private to me," extend the schema with Supabase Auth (email/password or OAuth) and tighten the RLS policies to require `auth.uid()`. That is out of scope for v2.2 but the schema is structured to accommodate a `user_id` column if you want to add one yourself.

## Removing Cloud Sync later

In Settings -> Cloud Sync, click **Disable**. Local data is untouched. To wipe your Supabase project's data, drop the two tables in the SQL Editor:

```sql
drop table if exists public.synced_runs cascade;
drop table if exists public.synced_vault_items cascade;
```

## Troubleshooting

- **"Anon key rejected (401/403)"** — the key was copied from the wrong place. Settings -> API in your Supabase dashboard, copy the `anon` key (not the service role key).
- **"Table not found"** — the SQL block above was not run (or only partly run). Re-run the entire block in the SQL Editor.
- **"HTTP 502 / 503 / network unreachable"** — Supabase is hiccupping or your network is blocked. Cryptex retries silently on the next sync; nothing breaks.
- **"Sync queue stays stuck at N pending"** — the request is hanging. Check the Network tab in DevTools for the failing call. Disable + re-enable Cloud Sync to reset the queue.

## What if I'm not technical?

Cloud Sync is opt-in. Cryptex works perfectly without it. Skip this entire page; your data still lives on your browser via `localStorage` + IndexedDB.
