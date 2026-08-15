import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const htmlEntities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
};
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => htmlEntities[character] || character);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { eventId, recordId, notificationType, notificationToken } = await request.json();
    if (!eventId || !recordId || !notificationToken || !['comment', 'private_message'].includes(notificationType)) {
      return new Response('Invalid notification request', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL');
    if (!resendKey || !fromEmail) {
      return new Response('Email notifications are not configured', { status: 503, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: notification, error: notificationError } = await admin
      .from('notification_requests')
      .select('id, event_id, record_id, notification_type')
      .eq('event_id', eventId)
      .eq('record_id', recordId)
      .eq('notification_type', notificationType)
      .eq('notification_token', notificationToken)
      .is('consumed_at', null)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification) {
      return new Response(JSON.stringify({ sent: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: claimedNotification, error: claimError } = await admin
      .from('notification_requests')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', notification.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimedNotification) return new Response(JSON.stringify({ sent: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const table = notification.notification_type === 'comment' ? 'comments' : 'rsvps';

    const { data: event, error: eventError } = await admin
      .from('events')
      .select('title, customer_id')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError || !event) throw eventError || new Error('Event not found');

    const { data: host, error: hostError } = await admin
      .from('profiles')
      .select('email')
      .eq('id', event.customer_id)
      .maybeSingle();
    if (hostError || !host?.email) throw hostError || new Error('Host email not found');

    const label = notification.notification_type === 'comment' ? 'guest-book comment' : 'private message';
    const eventTitle = escapeHtml(event.title || 'your invitation');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Attendaa/1.0',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [host.email],
        subject: `New ${label} for ${event.title || 'your invitation'}`,
        html: `<p>Someone left a new ${label} on <strong>${eventTitle}</strong>.</p><p>Open Attendaa to view it.</p>`,
      }),
    });
    if (!emailResponse.ok) throw new Error(`Resend rejected the email: ${await emailResponse.text()}`);

    const { error: updateError } = await admin
      .from(table)
      .update({ host_notified_at: new Date().toISOString() })
      .eq('id', recordId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(error);
    return new Response('Unable to send host notification', { status: 500, headers: corsHeaders });
  }
});
