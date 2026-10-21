-- =====================================================================
-- Fan Inbox — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================
--
-- Privacy model
--   * Both tables have RLS ENABLED and ZERO policies, and anon/authenticated
--     roles have no grants. The public API key can therefore read nothing.
--   * All reads/writes go through Next.js server routes using the
--     service-role key (which bypasses RLS).
--   * A fan can only load the thread whose secret 64-char `tracking_token`
--     they hold — so they only ever see their own message and its replies.
--   * Images live in a PRIVATE bucket and are served with short-lived
--     signed URLs generated server-side.
-- =====================================================================

-- ---------- Status enum ----------
do $$ begin
  create type public.message_status as enum ('received', 'read', 'replied');
exception when duplicate_object then null;
end $$;

-- ---------- messages ----------
create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  -- secret capability token used in the fan's tracking link (/t/<token>)
  tracking_token text not null unique
                 default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  nickname       text not null default 'Anonymous'
                 check (char_length(nickname) between 1 and 40),
  body           text not null default ''
                 check (char_length(body) <= 2000),
  image_paths    text[] not null default '{}'
                 check (cardinality(image_paths) <= 4),
  status         public.message_status not null default 'received',
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  replied_at     timestamptz,
  constraint messages_has_content
    check (char_length(body) > 0 or cardinality(image_paths) > 0)
);

create index if not exists messages_created_idx on public.messages (created_at desc);
create index if not exists messages_inbox_idx   on public.messages (archived, status, created_at desc);

-- ---------- replies ----------
create table if not exists public.replies (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists replies_message_idx on public.replies (message_id, created_at);

-- ---------- Row Level Security: deny everything to public roles ----------
alter table public.messages enable row level security;
alter table public.replies  enable row level security;

-- Intentionally NO policies. Belt and braces: also remove table grants.
revoke all on public.messages from anon, authenticated;
revoke all on public.replies  from anon, authenticated;

-- ---------- Storage bucket for fan images (private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fan-media',
  'fan-media',
  false,                      -- private: only signed URLs can read
  8388608,                    -- 8 MB per file
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are needed:
--   * uploads use one-time signed upload URLs minted by the server
--   * reads use signed download URLs minted by the server
-- With RLS on and no policies, the anon key cannot list/read/write objects.
