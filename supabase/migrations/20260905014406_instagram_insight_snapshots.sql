-- Aggregate performance snapshots for Attendaa's owned Instagram account.
-- No DMs, commenters, profiles, captions, or guest/customer data are stored.

create table public.instagram_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.meta_instagram_connections(id) on delete cascade,
  metric_date date not null,
  metric_name text not null,
  metric_period text not null default 'day',
  metric_value numeric not null check (metric_value >= 0),
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (connection_id, metric_date, metric_name, metric_period)
);

create index instagram_insight_snapshots_connection_date_idx
  on public.instagram_insight_snapshots (connection_id, metric_date desc);

alter table public.instagram_insight_snapshots enable row level security;

revoke all on table public.instagram_insight_snapshots from anon, authenticated;

;
