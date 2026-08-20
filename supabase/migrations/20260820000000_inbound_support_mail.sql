create table if not exists public.inbound_support_mail (
  svix_id text primary key,
  received_email_id text not null,
  received_at timestamptz not null default now(),
  forwarded_at timestamptz
);

alter table public.inbound_support_mail enable row level security;

revoke all on table public.inbound_support_mail from anon, authenticated;
