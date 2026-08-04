-- Run once in the Supabase SQL Editor before deploying this update.
-- It is safe to run on an existing project.

alter table public.events
  add column if not exists box_mode text not null default 'below',
  add column if not exists show_image boolean not null default true,
  add column if not exists rsvp_title text not null default 'Please RSVP',
  add column if not exists rsvp_subtitle text,
  add column if not exists registry_position text not null default 'bottom',
  add column if not exists audio_url text,
  add column if not exists event_end_time text;

alter table public.events drop constraint if exists events_box_mode_check;
alter table public.events add constraint events_box_mode_check
  check (box_mode in ('above', 'below', 'left', 'right', 'overlay')) not valid;

alter table public.events drop constraint if exists events_registry_position_check;
alter table public.events add constraint events_registry_position_check
  check (registry_position in ('top', 'bottom')) not valid;
