-- Run this in the Supabase SQL Editor for existing Attenda projects.
-- Existing overlay invitations remain safe: false renders them below the flyer.
alter table public.events
  add column if not exists overlay_enabled boolean not null default false;
