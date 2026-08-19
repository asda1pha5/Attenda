create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null
);

create index if not exists support_requests_email_created_at_idx
  on public.support_requests (email, created_at desc);

alter table public.support_requests enable row level security;

revoke all on table public.support_requests from anon, authenticated;
