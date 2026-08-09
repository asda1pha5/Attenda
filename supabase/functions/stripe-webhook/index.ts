import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function statusToPlan(status: string | null | undefined) {
  return ['active', 'trialing', 'past_due'].includes(status || '') ? 'signature' : 'free';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
  if (!stripeKey || !signingSecret) return json({ error: 'Stripe webhook is not configured.' }, 503);

  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature.' }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      signingSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error('Invalid Stripe signature', error);
    return json({ error: 'Invalid Stripe signature.' }, 400);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: receiptError } = await admin.from('stripe_webhook_events').insert({ id: event.id, event_type: event.type });
  if (receiptError?.code === '23505') return json({ received: true, duplicate: true });
  if (receiptError) return json({ error: 'Unable to record webhook.' }, 500);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.user_id;
      if (userId) {
        await admin.from('profiles').update({
          plan: 'signature',
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
          stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          subscription_status: session.mode === 'subscription' ? 'active' : 'paid',
        }).eq('id', userId);
        await admin.from('funnel_events').insert({ event_name: 'checkout_completed', visitor_id: `stripe-${userId}`, user_id: userId, path: '/upgrade', properties: { source: 'stripe_webhook' } });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const plan = event.type === 'customer.subscription.deleted' ? 'free' : statusToPlan(subscription.status);
      const update = {
        plan,
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        plan_expires_at: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
      };
      if (userId) await admin.from('profiles').update(update).eq('id', userId);
      else await admin.from('profiles').update(update).eq('stripe_subscription_id', subscription.id);
    }

    return json({ received: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to process webhook.' }, 500);
  }
});
