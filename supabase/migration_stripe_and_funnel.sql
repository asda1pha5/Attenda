-- Stripe billing state and privacy-conscious funnel measurement for Attenda.
-- Run once in the Supabase SQL Editor before deploying the related functions.

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(event_name) between 1 and 64),
  visitor_id text not null check (char_length(visitor_id) between 1 and 100),
  user_id uuid references public.profiles(id) on delete set null,
  path text,
  referrer_host text,
  source text,
  medium text,
  campaign text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_created_at_idx on public.funnel_events (created_at desc);
create index if not exists funnel_events_event_name_idx on public.funnel_events (event_name, created_at desc);

alter table public.stripe_webhook_events enable row level security;
alter table public.funnel_events enable row level security;

drop policy if exists "admin can view funnel events" on public.funnel_events;
create policy "admin can view funnel events" on public.funnel_events
  for select using (public.is_admin());

drop policy if exists "visitors can record funnel events" on public.funnel_events;
create policy "visitors can record funnel events" on public.funnel_events
  for insert with check (user_id is null or user_id = auth.uid());

-- The frontend never needs to change roles, plans, or Stripe identifiers.
-- This prevents direct API calls from granting a user paid/admin access.
create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not public.is_admin() and (
    new.role is distinct from old.role
    or new.plan is distinct from old.plan
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
  ) then
    raise exception 'Plan and role changes are not allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields on public.profiles;
create trigger protect_profile_access_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_access_fields();
