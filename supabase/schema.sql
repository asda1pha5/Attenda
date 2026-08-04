-- Run this entire file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create extension if not exists "pgcrypto";

-- ---------- PROFILES ----------
-- Mirrors auth.users, adds a role so we know admin vs customer
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'customer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- EVENTS ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  slug text unique not null,
  title text not null,
  subtitle text,
  event_date date,
  event_time text,
  address text,
  registry_link text,
  image_url text,
  box_top numeric default 72,
  box_left numeric default 4,
  box_width numeric default 92,
  box_height numeric default 25,
  theme_color text default '#6d7f6a',
  accent_color text default '#d8b98c',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- RSVPS ----------
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  number_attending int default 1,
  attending text check (attending in ('Yes','No')),
  created_at timestamptz not null default now()
);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Profiles: a user sees their own row; admins see everyone
create policy "view own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "update own profile" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- Events: customers manage only their own; admins manage all;
-- anyone (no login) can view a PUBLISHED event, needed for the public RSVP page
create policy "customers manage own events" on public.events
  for all using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy "public can view published events" on public.events
  for select using (is_published = true);

-- RSVPs: anyone can submit (no account needed), but only the event's
-- owner (or admin) can read the submissions back
create policy "anyone can submit rsvp" on public.rsvps
  for insert with check (true);

create policy "owner can view rsvps" on public.rsvps
  for select using (
    exists (
      select 1 from public.events
      where events.id = rsvps.event_id
      and (events.customer_id = auth.uid() or public.is_admin())
    )
  );

-- ---------- STORAGE (flyer images) ----------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "public can view event images" on storage.objects
  for select using (bucket_id = 'event-images');

create policy "authenticated users can upload event images" on storage.objects
  for insert with check (bucket_id = 'event-images' and auth.role() = 'authenticated');

-- ---------- MAKE YOURSELF ADMIN ----------
-- After you sign up once through the app, run this (swap in your email):
-- update public.profiles set role = 'admin' where email = 'you@example.com';
