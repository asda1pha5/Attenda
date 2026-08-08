-- Run this once in the Supabase SQL Editor after the comments migration.
-- It records each successful host-email notification so repeat browser requests
-- do not create duplicate emails.

alter table public.rsvps
  add column if not exists host_notified_at timestamptz;

alter table public.comments
  add column if not exists host_notified_at timestamptz;
