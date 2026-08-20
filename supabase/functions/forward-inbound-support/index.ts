import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@6.6.0';
import { Webhook } from 'npm:svix@1.75.0';

type InboundEvent = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
  };
};

const supportAddress = 'support@attendaa.com';
const forwardFrom = 'Attendaa Support <support@attendaa.com>';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('RESEND_INBOUND_WEBHOOK_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supportInbox = Deno.env.get('SUPPORT_TO_EMAIL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !resendKey || !supportInbox || !supabaseUrl || !serviceRoleKey) {
    return new Response('Inbound support forwarding is not configured', { status: 503 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) return new Response('Missing webhook signature', { status: 400 });

  let event: InboundEvent;
  try {
    const rawPayload = await request.text();
    event = new Webhook(webhookSecret).verify(rawPayload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as InboundEvent;
  } catch (error) {
    console.error('Rejected inbound email webhook', error);
    return new Response('Invalid webhook signature', { status: 401 });
  }

  if (event.type !== 'email.received' || !event.data?.email_id) {
    return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  const wasSentToSupport = event.data.to?.some((address) => address.trim().toLowerCase() === supportAddress);
  if (!wasSentToSupport) {
    return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: existing, error: existingError } = await admin
    .from('inbound_support_mail')
    .select('forwarded_at')
    .eq('svix_id', svixId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.forwarded_at) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (!existing) {
    const { error: insertError } = await admin
      .from('inbound_support_mail')
      .insert({ svix_id: svixId, received_email_id: event.data.email_id });
    if (insertError?.code === '23505') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (insertError) throw insertError;
  }

  try {
    const resend = new Resend(resendKey);
    const { error: forwardError } = await resend.emails.receiving.forward({
      emailId: event.data.email_id,
      to: supportInbox,
      from: forwardFrom,
      passthrough: false,
      text: 'Forwarded message received by Attendaa Support.',
      html: '<p>Forwarded message received by Attendaa Support.</p>',
    });
    if (forwardError) throw new Error(forwardError.message);

    const { error: updateError } = await admin
      .from('inbound_support_mail')
      .update({ forwarded_at: new Date().toISOString() })
      .eq('svix_id', svixId);
    if (updateError) throw updateError;
  } catch (error) {
    await admin.from('inbound_support_mail').delete().eq('svix_id', svixId).is('forwarded_at', null);
    throw error;
  }

  return new Response(JSON.stringify({ received: true, forwarded: true }), { headers: { 'Content-Type': 'application/json' } });
});
