-- Local migration, created with Supabase CLI. Apply only after owner approval.
-- Receipt, activation, purchase ledger and conversion event commit together.
begin;
alter table public.stripe_webhook_events add column if not exists processed_at timestamptz;
-- Legacy received_at values deliberately do NOT become processed_at values.
alter table public.funnel_events add column if not exists content text;

create table if not exists public.signature_purchases (
  session_id text primary key,
  payment_intent_id text not null unique,
  event_id uuid references public.events(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  amount integer not null check (amount = 1900),
  currency text not null check (currency = 'usd'),
  visitor_id text not null,
  source text, medium text, campaign text, content text,
  created_at timestamptz not null default now()
);
alter table public.signature_purchases enable row level security;
revoke all on public.signature_purchases from public, anon, authenticated;
grant select, insert, update, delete on public.signature_purchases to service_role;
create index if not exists signature_purchases_event_id_idx on public.signature_purchases(event_id);
create index if not exists signature_purchases_user_id_idx on public.signature_purchases(user_id);

create or replace function public.clean_campaign_token(value text)
returns text language sql immutable security invoker set search_path = public as $$
  select case when value ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' and value !~ '[0-9]{7}' then lower(value) else null end;
$$;

create or replace function public.activate_signature_purchase(purchase jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  target public.events;
  prior public.signature_purchases;
  buyer public.profiles;
  target_id uuid := (purchase->>'event_id')::uuid;
  buyer_id uuid := (purchase->>'user_id')::uuid;
  visitor text;
  already_counted boolean := false;
begin
  if current_user <> 'service_role' then raise exception 'Service role required'; end if;
  if coalesce(purchase->>'session_id', '') !~ '^cs_[A-Za-z0-9_]+' or
     coalesce(purchase->>'payment_intent_id', '') !~ '^pi_[A-Za-z0-9_]+' or
     coalesce(purchase->>'webhook_id', '') !~ '^evt_[A-Za-z0-9_]+' or
     coalesce(purchase->>'webhook_type', '') not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') or
     (purchase->>'amount')::integer is distinct from 1900 or purchase->>'currency' is distinct from 'usd'
  then raise exception 'Invalid purchase'; end if;

  -- Serializes deliveries for the same event and prevents an ownership change
  -- between authorization and entitlement mutation. Network calls happen earlier.
  select * into target from public.events where id = target_id for update;
  if not found or target.customer_id is distinct from buyer_id then raise exception 'Purchase owner mismatch'; end if;
  select * into buyer from public.profiles where id = buyer_id for update;
  if not found then raise exception 'Buyer profile missing'; end if;
  -- Checkout can legitimately create more than one Stripe customer when two
  -- events are checked out before either webhook arrives. Ownership is the
  -- signed, intent-matched user/event pair, not the profile's billing shortcut.
  if target.signature_pass_active and target.stripe_payment_intent_id is distinct from purchase->>'payment_intent_id'
  then raise exception 'Event already has another Signature payment'; end if;

  select * into prior from public.signature_purchases
    where session_id = purchase->>'session_id' or payment_intent_id = purchase->>'payment_intent_id';
  if found then
    if prior.session_id is distinct from purchase->>'session_id' or prior.event_id is distinct from target_id or
       prior.user_id is distinct from buyer_id or prior.payment_intent_id is distinct from purchase->>'payment_intent_id'
    then raise exception 'Purchase identity mismatch'; end if;
    already_counted := true;
  end if;
  visitor := case when coalesce(purchase->>'visitor_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then purchase->>'visitor_id' else gen_random_uuid()::text end;

  update public.events set signature_pass_active = true, stripe_payment_intent_id = purchase->>'payment_intent_id' where id = target_id;
  if not found then raise exception 'Activation update failed'; end if;
  update public.profiles set stripe_customer_id = coalesce(stripe_customer_id, purchase->>'customer_id'),
    subscription_status = case when stripe_subscription_id is null then 'paid' else subscription_status end where id = buyer_id;
  if not found then raise exception 'Profile update failed'; end if;

  if not already_counted then
    insert into public.signature_purchases(session_id, payment_intent_id, event_id, user_id, amount, currency, visitor_id, source, medium, campaign, content)
    values (purchase->>'session_id', purchase->>'payment_intent_id', target_id, buyer_id, 1900, 'usd', visitor,
      public.clean_campaign_token(purchase->>'utm_source'), public.clean_campaign_token(purchase->>'utm_medium'),
      public.clean_campaign_token(purchase->>'utm_campaign'), public.clean_campaign_token(purchase->>'utm_content'));
    insert into public.funnel_events(event_name, visitor_id, user_id, path, source, medium, campaign, content, properties)
    values ('checkout_completed', visitor, buyer_id, '/upgrade', public.clean_campaign_token(purchase->>'utm_source'),
      public.clean_campaign_token(purchase->>'utm_medium'), public.clean_campaign_token(purchase->>'utm_campaign'),
      public.clean_campaign_token(purchase->>'utm_content'), '{"source":"stripe_webhook","amount":1900,"currency":"usd"}'::jsonb);
  end if;
  -- Failure at ANY step rolls back ALL writes, including this completion marker.
  insert into public.stripe_webhook_events(id, event_type, processed_at)
    values (purchase->>'webhook_id', purchase->>'webhook_type', now())
    on conflict (id) do update set processed_at = excluded.processed_at;
  if not exists(select 1 from public.events where id = target_id and signature_pass_active and stripe_payment_intent_id = purchase->>'payment_intent_id')
  then raise exception 'Activation not confirmed'; end if;
  return jsonb_build_object('active', true, 'duplicate', already_counted);
end;
$$;
revoke all on function public.activate_signature_purchase(jsonb) from public, anon, authenticated;
grant execute on function public.activate_signature_purchase(jsonb) to service_role;

-- Preserve existing recurring accounts; delivery state is recorded only after
-- a checked update. No $19 purchase conversion is emitted for subscriptions.
create or replace function public.sync_legacy_signature_subscription(subscription_data jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare buyer public.profiles; requested_user uuid := nullif(subscription_data->>'user_id', '')::uuid;
begin
  if current_user <> 'service_role' then raise exception 'Service role required'; end if;
  select * into buyer from public.profiles where stripe_subscription_id = subscription_data->>'id' for update;
  if not found and requested_user is not null then
    select * into buyer from public.profiles where id = requested_user for update;
  end if;
  if buyer.id is null or (requested_user is not null and buyer.id <> requested_user) or
    (buyer.stripe_customer_id is not null and buyer.stripe_customer_id is distinct from subscription_data->>'customer_id') or
    (buyer.stripe_subscription_id is not null and buyer.stripe_subscription_id is distinct from subscription_data->>'id')
  then raise exception 'Legacy subscription owner mismatch'; end if;
  update public.profiles set
    plan = case when subscription_data->>'status' in ('active','trialing','past_due') then 'signature' else 'free' end,
    stripe_customer_id = subscription_data->>'customer_id', stripe_subscription_id = subscription_data->>'id',
    subscription_status = subscription_data->>'status',
    plan_expires_at = case when subscription_data->>'period_end' is not null then to_timestamp((subscription_data->>'period_end')::double precision) else null end
    where id = buyer.id;
  if not found then raise exception 'Legacy profile update failed'; end if;
  insert into public.stripe_webhook_events(id, event_type, processed_at)
    values (subscription_data->>'webhook_id', subscription_data->>'webhook_type', now())
    on conflict (id) do update set processed_at = excluded.processed_at;
  return '{"processed":true}'::jsonb;
end;
$$;
revoke all on function public.sync_legacy_signature_subscription(jsonb) from public, anon, authenticated;
grant execute on function public.sync_legacy_signature_subscription(jsonb) to service_role;

create or replace function public.protect_event_signature_fields()
returns trigger language plpgsql security invoker set search_path = public as $$
declare paid boolean; protected_keys text[] := array['template_id','audio_url','password_protected','photo_album_enabled','reminder_enabled','remove_branding','overlay_enabled']; item text;
begin
  if current_user = 'service_role' or (session_user in ('postgres','supabase_admin') and nullif(current_setting('request.jwt.claims', true),'') is null) then return new; end if;
  if tg_op = 'INSERT' then
    if new.signature_pass_active or new.stripe_payment_intent_id is not null then raise exception 'Payment fields are service managed'; end if;
  elsif new.signature_pass_active is distinct from old.signature_pass_active or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id then
    raise exception 'Payment fields are service managed';
  end if;
  select exists(select 1 from public.profiles where id = new.customer_id and plan in ('signature','pro') and (plan_expires_at is null or plan_expires_at > now())) into paid;
  paid := paid or (tg_op = 'UPDATE' and old.signature_pass_active) or public.is_admin();
  if not coalesce(paid, false) then
    if tg_op = 'INSERT' then
      if coalesce(new.template_id,'classic') <> 'classic' or coalesce(new.audio_url,'') <> '' or new.password_protected or
        new.photo_album_enabled or new.reminder_enabled or new.remove_branding or new.overlay_enabled or new.box_mode = 'overlay'
      then raise exception 'Signature purchase required'; end if;
    else
      -- Unchanged admin-prepared settings survive a Free host's normal edits.
      foreach item in array protected_keys loop
        if to_jsonb(new)->item is distinct from to_jsonb(old)->item then raise exception 'Signature purchase required'; end if;
      end loop;
      if new.box_mode = 'overlay' and new.box_mode is distinct from old.box_mode then raise exception 'Signature purchase required'; end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_event_signature_fields on public.events;
create trigger protect_event_signature_fields before insert or update on public.events for each row execute function public.protect_event_signature_fields();
revoke all on function public.protect_event_signature_fields() from public, anon, authenticated;

-- Client event names are not purchase evidence. Only service fulfillment may
-- write the purchase conversion; service_role bypasses this RLS policy.
drop policy if exists "visitors can record funnel events" on public.funnel_events;
create policy "visitors can record funnel events" on public.funnel_events for insert to anon, authenticated
  with check ((user_id is null or user_id = auth.uid()) and event_name <> 'checkout_completed');
commit;
