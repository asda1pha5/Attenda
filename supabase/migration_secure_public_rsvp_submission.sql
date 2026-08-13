-- Run once in the Supabase SQL Editor before deploying this update.
-- Guests can submit an RSVP and receive only its ID; they still cannot read RSVP records.

create or replace function public.submit_public_rsvp(
  target_event_id uuid,
  target_guest_name text,
  target_guest_email text,
  target_guest_phone text,
  target_number_attending integer,
  target_attending text,
  target_private_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_rsvp_id uuid;
begin
  insert into public.rsvps (
    event_id,
    guest_name,
    guest_email,
    guest_phone,
    number_attending,
    attending,
    private_message
  ) values (
    target_event_id,
    target_guest_name,
    target_guest_email,
    target_guest_phone,
    target_number_attending,
    target_attending,
    target_private_message
  ) returning id into created_rsvp_id;

  return created_rsvp_id;
end;
$$;

revoke all on function public.submit_public_rsvp(uuid, text, text, text, integer, text, text) from public;
grant execute on function public.submit_public_rsvp(uuid, text, text, text, integer, text, text) to anon, authenticated;
