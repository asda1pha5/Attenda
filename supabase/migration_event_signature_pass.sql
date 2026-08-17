-- Attendaa Signature Pass: one Stripe payment unlocks Signature for one event.
-- Run once in Supabase SQL Editor before deploying the matching Edge Functions.

alter table public.events
  add column if not exists signature_pass_active boolean not null default false,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists events_stripe_payment_intent_id_key
  on public.events (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
