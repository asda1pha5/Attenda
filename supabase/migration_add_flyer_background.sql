-- Run once in the Supabase SQL Editor before deploying this update.
alter table public.events
  add column if not exists flyer_background text not null default 'ivory';

alter table public.events drop constraint if exists events_flyer_background_check;
alter table public.events add constraint events_flyer_background_check
  check (flyer_background in ('ivory', 'sage', 'blush', 'sky', 'butter', 'sand', 'lilac', 'peach', 'mist', 'ocean', 'berry', 'midnight')) not valid;
