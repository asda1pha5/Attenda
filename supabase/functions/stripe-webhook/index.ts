import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fulfillWebhook } from '../_shared/payment-core.mjs';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey || !signingSecret || !url || !key) return json({ error: 'Webhook is not configured.' }, 503);
  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature.' }, 400);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, signingSecret, undefined, Stripe.createSubtleCryptoProvider());
  } catch { return json({ error: 'Invalid Stripe signature.' }, 400); }
  try {
    const admin = createClient(url, key);
    return json(await fulfillWebhook({ stripe, admin, event, priceId: Deno.env.get('STRIPE_SIGNATURE_PRICE_ID') }));
  } catch {
    console.error('Stripe fulfillment failed', { webhook_id: event.id, event_type: event.type });
    return json({ error: 'Activation not confirmed. Webhook can be retried.' }, 500);
  }
});
