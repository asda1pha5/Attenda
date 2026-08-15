-- Run once in the Supabase SQL Editor before deploying the secure email update.
-- Public guests receive a one-time token only for the email created by their own action.

create table if not exists public.notification_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  record_id uuid not null,
  notification_type text not null check (notification_type in ('comment', 'private_message')),
  notification_token uuid not null unique default gen_random_uuid(),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_requests enable row level security;

drop function if exists public.submit_public_rsvp(uuid, text, text, text, integer, text, text);

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
      'id', created_comment.id,
      'event_id', created_comment.event_id,
      'guest_name', created_comment.guest_name,
      'guest_email', created_comment.guest_email,
      'body', created_comment.body,
      'image_url', created_comment.image_url,
      'gif_url', created_comment.gif_url,
      'created_at', created_comment.created_at
    ),
    'notification_token', created_notification_token
  );
end;
$$;

revoke all on function public.submit_public_rsvp(uuid, text, text, text, integer, text, text) from public;
grant execute on function public.submit_public_rsvp(uuid, text, text, text, integer, text, text) to anon, authenticated;
revoke all on function public.submit_public_comment(uuid, text, text, text, text, text) from public;
grant execute on function public.submit_public_comment(uuid, text, text, text, text, text) to anon, authenticated;
