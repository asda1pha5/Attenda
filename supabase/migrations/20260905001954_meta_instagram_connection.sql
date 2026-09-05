-- Stores only encrypted server-side credentials for Attendaa's owned Instagram account.
-- There are intentionally no client-facing policies on these tables.

create table if not exists public.meta_oauth_attempts (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meta_oauth_attempts_expires_at_idx
  on public.meta_oauth_attempts (expires_at);

create table if not exists public.meta_instagram_connections (
  id uuid primary key default gen_random_uuid(),
  instagram_account_id text not null unique,
  instagram_username text,
  facebook_page_id text not null unique,
  facebook_page_name text,
  encrypted_page_access_token text not null,
  token_iv text not null,
  token_expires_at timestamptz,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_oauth_attempts enable row level security;
alter table public.meta_instagram_connections enable row level security;

revoke all on table public.meta_oauth_attempts from anon, authenticated;
revoke all on table public.meta_instagram_connections from anon, authenticated;;
