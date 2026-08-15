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
  plan text not null default 'free' check (plan in ('free', 'signature', 'pro')),
  plan_expires_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  subscription_status text,
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
  event_end_time text,
  address text,
  registry_link text,
  image_url text,
  audio_url text,
  box_top numeric default 72,
  box_left numeric default 4,
  box_width numeric default 92,
  box_height numeric default 25,
  box_mode text not null default 'below' check (box_mode in ('above', 'below', 'left', 'right', 'overlay')),
  show_image boolean not null default true,
  theme_color text default '#6d7f6a',
  accent_color text default '#d8b98c',
  flyer_background text not null default 'ivory' check (flyer_background in ('ivory', 'sage', 'blush', 'sky', 'butter', 'sand', 'lilac', 'peach', 'mist', 'ocean', 'berry', 'midnight')),
  rsvp_title text not null default 'Please RSVP',
  rsvp_subtitle text,
  registry_position text not null default 'bottom' check (registry_position in ('top', 'bottom')),
  show_event_details boolean not null default true,
  event_details_side text not null default 'right' check (event_details_side in ('left', 'right')),
  template_id text not null default 'classic',
  password_protected boolean not null default false,
  photo_album_enabled boolean not null default false,
  reminder_enabled boolean not null default false,
  reminder_days_before integer not null default 1 check (reminder_days_before in (1, 3, 7)),
  remove_branding boolean not null default false,
  overlay_enabled boolean not null default false,
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
  attending text check (attending in ('Yes','Maybe','No')),
  private_message text check (private_message is null or char_length(private_message) <= 250),
  host_notified_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- COMMENT WALL ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  body text,
  image_url text,
  gif_url text,
  host_notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (coalesce(char_length(trim(body)), 0) > 0 or image_url is not null or gif_url is not null),
  check (body is null or char_length(body) <= 500)
);

create table public.event_access (
  event_id uuid primary key references public.events(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

create table public.notification_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  record_id uuid not null,
  notification_type text not null check (notification_type in ('comment', 'private_message')),
  notification_token uuid not null unique default gen_random_uuid(),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create table public.funnel_events (
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

create index funnel_events_created_at_idx on public.funnel_events (created_at desc);
create index funnel_events_event_name_idx on public.funnel_events (event_name, created_at desc);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.comments enable row level security;
alter table public.event_access enable row level security;
alter table public.event_photos enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.funnel_events enable row level security;
alter table public.notification_requests enable row level security;

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

create trigger protect_profile_access_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_access_fields();

create policy "admin can view funnel events" on public.funnel_events
  for select using (public.is_admin());

create policy "visitors can record funnel events" on public.funnel_events
  for insert with check (user_id is null or user_id = auth.uid());

-- Events: customers manage only their own; admins manage all.
-- Public invitations are served through get_public_event so private events do
-- not expose their contents before an access code has been verified.
create policy "customers manage own events" on public.events
  for all using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

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

-- Allows anonymous guests to create an RSVP and receive only its new ID.
-- This avoids granting public read access to the rsvps table.
create or replace function public.submit_public_rsvp(
  target_event_id uuid,
  target_guest_name text,
  target_guest_email text,
  target_guest_phone text,
  target_number_attending integer,
  target_attending text,
  target_private_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_rsvp_id uuid;
  created_notification_token uuid;
begin
  insert into public.rsvps (event_id, guest_name, guest_email, guest_phone, number_attending, attending, private_message)
  values (target_event_id, target_guest_name, target_guest_email, target_guest_phone, target_number_attending, target_attending, target_private_message)
  returning id into created_rsvp_id;
  if coalesce(length(trim(target_private_message)), 0) > 0 then
    insert into public.notification_requests (event_id, record_id, notification_type)
    values (target_event_id, created_rsvp_id, 'private_message')
    returning notification_token into created_notification_token;
  end if;
  return jsonb_build_object('rsvp_id', created_rsvp_id, 'notification_token', created_notification_token);
end;
$$;

revoke all on function public.submit_public_rsvp(uuid, text, text, text, integer, text, text) from public;
grant execute on function public.submit_public_rsvp(uuid, text, text, text, integer, text, text) to anon, authenticated;

create or replace function public.has_rsvped_for_event(target_event_id uuid, target_email text)
returns boolean as $$
  select exists (
    select 1 from public.rsvps
    where event_id = target_event_id and lower(guest_email) = lower(target_email)
  );
$$ language sql security definer stable;

create or replace function public.submit_public_comment(
  target_event_id uuid,
  target_guest_name text,
  target_guest_email text,
  target_body text,
  target_image_url text,
  target_gif_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_comment public.comments;
  created_notification_token uuid;
begin
  if not public.has_rsvped_for_event(target_event_id, target_guest_email) then
    raise exception 'RSVP required before posting a comment';
  end if;
  insert into public.comments (event_id, guest_name, guest_email, body, image_url, gif_url)
  values (target_event_id, target_guest_name, target_guest_email, target_body, target_image_url, target_gif_url)
  returning * into created_comment;
  insert into public.notification_requests (event_id, record_id, notification_type)
  values (target_event_id, created_comment.id, 'comment')
  returning notification_token into created_notification_token;
  return jsonb_build_object(
    'comment', jsonb_build_object(
      'id', created_comment.id, 'event_id', created_comment.event_id,
      'guest_name', created_comment.guest_name, 'guest_email', created_comment.guest_email,
      'body', created_comment.body, 'image_url', created_comment.image_url,
      'gif_url', created_comment.gif_url, 'created_at', created_comment.created_at
    ),
    'notification_token', created_notification_token
  );
end;
$$;

revoke all on function public.submit_public_comment(uuid, text, text, text, text, text) from public;
grant execute on function public.submit_public_comment(uuid, text, text, text, text, text) to anon, authenticated;

create policy "public can view comments" on public.comments
  for select using (true);

create policy "rsvped guests can leave comments" on public.comments
  for insert with check (public.has_rsvped_for_event(event_id, guest_email));

create policy "public can view event photos" on public.event_photos
  for select using (true);

create policy "rsvped guests can add event photos" on public.event_photos
  for insert with check (public.has_rsvped_for_event(event_id, guest_email));

create or replace function public.set_event_password(target_event_id uuid, new_password text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.events where id = target_event_id and (customer_id = auth.uid() or public.is_admin())
  ) then raise exception 'Not allowed'; end if;
  if coalesce(length(trim(new_password)), 0) = 0 then
    delete from public.event_access where event_id = target_event_id;
    update public.events set password_protected = false where id = target_event_id;
  else
    insert into public.event_access (event_id, password_hash, updated_at)
    values (target_event_id, crypt(new_password, gen_salt('bf')), now())
    on conflict (event_id) do update set password_hash = excluded.password_hash, updated_at = now();
    update public.events set password_protected = true where id = target_event_id;
  end if;
end;
$$;

create or replace function public.get_public_event(target_slug text, provided_password text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare target_event public.events; stored_hash text;
begin
  select * into target_event from public.events where slug = target_slug and is_published = true;
  if target_event.id is null then return null; end if;
  if target_event.password_protected then
    select password_hash into stored_hash from public.event_access where event_id = target_event.id;
    if stored_hash is null or provided_password is null or crypt(provided_password, stored_hash) <> stored_hash then
      return jsonb_build_object('locked', true, 'title', target_event.title);
    end if;
  end if;
  return to_jsonb(target_event) - 'customer_id';
end;
$$;

grant execute on function public.set_event_password(uuid, text) to authenticated;
grant execute on function public.get_public_event(text, text) to anon, authenticated;

-- ---------- STORAGE (flyer images) ----------
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "public can view event images" on storage.objects
  for select using (bucket_id = 'event-images');

create policy "authenticated users can upload event images" on storage.objects
  for insert with check (bucket_id = 'event-images' and auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

create policy "public can view comment images" on storage.objects
  for select using (bucket_id = 'comment-images');

create policy "guests can upload comment images" on storage.objects
  for insert with check (bucket_id = 'comment-images');

insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

create policy "public can view event photos storage" on storage.objects
  for select using (bucket_id = 'event-photos');

create policy "guests can upload event photos storage" on storage.objects
  for insert with check (bucket_id = 'event-photos');

-- ---------- MAKE YOURSELF ADMIN ----------
-- After you sign up once through the app, run this (swap in your email):
-- update public.profiles set role = 'admin' where email = 'you@example.com';
