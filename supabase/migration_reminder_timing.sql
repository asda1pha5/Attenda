-- Run this in Supabase SQL Editor to add configurable Signature reminder timing.
alter table public.events
  add column if not exists reminder_days_before integer not null default 1
  check (reminder_days_before in (1, 3, 7));
