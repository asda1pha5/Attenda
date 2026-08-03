-- Run this in your Supabase project's SQL Editor if you already ran the
-- original schema.sql and deployed before email/phone fields existed.
-- (New setups: schema.sql already includes this — you don't need this file.)

alter table public.rsvps add column if not exists guest_email text;
alter table public.rsvps add column if not exists guest_phone text;

-- Backfill any existing rows with a placeholder so the NOT NULL below can be applied
update public.rsvps set guest_email = 'unknown@example.com' where guest_email is null;

alter table public.rsvps alter column guest_email set not null;
