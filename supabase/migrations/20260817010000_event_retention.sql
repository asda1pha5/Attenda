-- Published invitations expire 90 days after their event by default.
-- Admins can change the organization-wide number of days or exempt an event.

alter table public.events
  add column if not exists retention_exempt boolean not null default false;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('event_retention_days', '{"days": 90}'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "admins can manage app settings" on public.app_settings;
create policy "admins can manage app settings" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.get_public_event(target_slug text, provided_password text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  target_event public.events;
  stored_hash text;
  retention_days integer := 90;
begin
  select * into target_event from public.events where slug = target_slug and is_published = true;
  if target_event.id is null then return null; end if;

  select coalesce((value->>'days')::integer, 90) into retention_days
  from public.app_settings where key = 'event_retention_days';
  retention_days := coalesce(retention_days, 90);

  if target_event.event_date is not null
    and not target_event.retention_exempt
    and current_date > target_event.event_date + retention_days then
    return jsonb_build_object('expired', true, 'title', target_event.title);
  end if;

  if target_event.password_protected then
    select password_hash into stored_hash from public.event_access where event_id = target_event.id;
    if stored_hash is null or provided_password is null or crypt(provided_password, stored_hash) <> stored_hash then
      return jsonb_build_object('locked', true, 'title', target_event.title);
    end if;
  end if;
  return to_jsonb(target_event) - 'customer_id';
end;
$$;
