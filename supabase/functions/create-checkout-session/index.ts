import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before starting checkout.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error: 'Your session has expired. Please sign in again.' }, 401);
    const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();

    const priceId = Deno.env.get('STRIPE_SIGNATURE_PRICE_ID');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '');
    if (!priceId || !stripeKey || !appUrl) return json({ error: 'Checkout is not configured yet.' }, 503);

    const stripe = new Stripe(stripeKey);
    const billingMode = Deno.env.get('STRIPE_SIGNATURE_BILLING_MODE') === 'payment' ? 'payment' : 'subscription';
    const metadata = { user_id: user.id, plan: 'signature' };
    const session = await stripe.checkout.sessions.create({
      mode: billingMode,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      ...(profile?.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email || undefined }),
      metadata,
      ...(billingMode === 'subscription'
        ? { subscription_data: { metadata } }
        : { customer_creation: 'always', payment_intent_data: { metadata } }),
      success_url: `${appUrl}/upgrade?checkout=success`,
      cancel_url: `${appUrl}/upgrade?checkout=cancelled`,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return json({ url: session.url });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to start checkout. Please try again.' }, 500);
  }
});
