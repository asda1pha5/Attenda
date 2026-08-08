-- Attenda Signature bundle. Run once in the Supabase SQL Editor.
create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists plan_expires_at timestamptz;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'signature', 'pro')) not valid;

alter table public.events
  add column if not exists template_id text not null default 'classic',
  add column if not exists password_protected boolean not null default false,
  add column if not exists photo_album_enabled boolean not null default false,
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists remove_branding boolean not null default false;

alter table public.rsvps
  add column if not exists reminder_sent_at timestamptz;

create table if not exists public.event_access (
  event_id uuid primary key references public.events(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table public.event_access enable row level security;
alter table public.event_photos enable row level security;

drop policy if exists "public can view event photos" on public.event_photos;
create policy "public can view event photos" on public.event_photos for select using (true);
drop policy if exists "rsvped guests can add event photos" on public.event_photos;
create policy "rsvped guests can add event photos" on public.event_photos for insert with check (public.has_rsvped_for_event(event_id, guest_email));

insert into storage.buckets (id, name, public) values ('event-photos', 'event-photos', true) on conflict (id) do nothing;
drop policy if exists "public can view event photos storage" on storage.objects;
create policy "public can view event photos storage" on storage.objects for select using (bucket_id = 'event-photos');
drop policy if exists "guests can upload event photos storage" on storage.objects;
create policy "guests can upload event photos storage" on storage.objects for insert with check (bucket_id = 'event-photos');

create or replace function public.set_event_password(target_event_id uuid, new_password text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.events
    where id = target_event_id and (customer_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Not allowed';
  end if;

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
declare
  target_event public.events;
  stored_hash text;
begin
  select * into target_event from public.events
  where slug = target_slug and is_published = true;
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

drop policy if exists "public can view published events" on public.events;
