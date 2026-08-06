-- Run once in Supabase SQL Editor before deploying this update.

alter table public.events
  add column if not exists show_event_details boolean not null default true,
  add column if not exists event_details_side text not null default 'right';

alter table public.events drop constraint if exists events_event_details_side_check;
alter table public.events add constraint events_event_details_side_check
  check (event_details_side in ('left', 'right')) not valid;

alter table public.rsvps
  add column if not exists private_message text;

alter table public.rsvps drop constraint if exists rsvps_attending_check;
alter table public.rsvps add constraint rsvps_attending_check
  check (attending in ('Yes', 'Maybe', 'No')) not valid;

alter table public.rsvps drop constraint if exists rsvps_private_message_length_check;
alter table public.rsvps add constraint rsvps_private_message_length_check
  check (private_message is null or char_length(private_message) <= 250) not valid;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  body text,
  image_url text,
  gif_url text,
  created_at timestamptz not null default now(),
  constraint comments_content_check check (
    coalesce(char_length(trim(body)), 0) > 0 or image_url is not null or gif_url is not null
  ),
  constraint comments_body_length_check check (body is null or char_length(body) <= 500)
);

alter table public.comments enable row level security;

create or replace function public.has_rsvped_for_event(target_event_id uuid, target_email text)
returns boolean as $$
  select exists (
    select 1 from public.rsvps
    where event_id = target_event_id
      and lower(guest_email) = lower(target_email)
  );
$$ language sql security definer stable set search_path = public;

grant execute on function public.has_rsvped_for_event(uuid, text) to anon, authenticated;

drop policy if exists "public can view comments" on public.comments;
create policy "public can view comments" on public.comments
  for select using (true);

drop policy if exists "rsvped guests can leave comments" on public.comments;
create policy "rsvped guests can leave comments" on public.comments
  for insert with check (public.has_rsvped_for_event(event_id, guest_email));

insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

drop policy if exists "public can view comment images" on storage.objects;
create policy "public can view comment images" on storage.objects
  for select using (bucket_id = 'comment-images');

drop policy if exists "guests can upload comment images" on storage.objects;
create policy "guests can upload comment images" on storage.objects
  for insert with check (bucket_id = 'comment-images');
