-- A guest can RSVP without an account, but may later create or sign into an
-- Attendaa account using that same email to withdraw their response.
-- Keeping the row gives hosts an audit trail while removing it from active
-- counts, exports, and reminders.
alter table public.rsvps
  add column if not exists cancelled_at timestamptz;

create index if not exists rsvps_active_event_email_idx
  on public.rsvps (event_id, lower(guest_email))
  where cancelled_at is null;

create or replace function public.cancel_own_rsvp(target_event_slug text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
  caller_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to manage your RSVP.';
  end if;

  caller_email := nullif(lower(trim((select auth.jwt() ->> 'email'))), '');
  if caller_email is null then
    raise exception 'Your account needs a verified email address to manage an RSVP.';
  end if;

  select id into target_event_id
  from public.events
  where slug = trim(target_event_slug);

  if target_event_id is null then
    return false;
  end if;

  update public.rsvps
  set cancelled_at = now()
  where event_id = target_event_id
    and cancelled_at is null
    and lower(guest_email) = caller_email;

  return found;
end;
$$;

revoke all on function public.cancel_own_rsvp(text) from public;
revoke all on function public.cancel_own_rsvp(text) from anon;
grant execute on function public.cancel_own_rsvp(text) to authenticated;

-- A cancelled RSVP cannot be used to add new guest-book content or photos.
create or replace function public.has_rsvped_for_event(target_event_id uuid, target_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.rsvps
    where event_id = target_event_id
      and cancelled_at is null
      and lower(guest_email) = lower(target_email)
  );
$$;

revoke all on function public.has_rsvped_for_event(uuid, text) from public;
grant execute on function public.has_rsvped_for_event(uuid, text) to anon, authenticated;
