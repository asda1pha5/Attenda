import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const htmlEntities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
};
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => htmlEntities[character] || character);
const escapeAttribute = escapeHtml;

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
    const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '');
    const hubUrl = appUrl ? `${appUrl}/hub` : '';
    const actionTitle = notification.notification_type === 'comment' ? 'A guest signed your guest book' : 'You received a private guest message';
    const bodyCopy = notification.notification_type === 'comment'
      ? `A guest left a note on ${eventTitle}. Open your hub to read it and keep the conversation going.`
      : `A guest sent a private message about ${eventTitle}. Open your hub to read it and reply if needed.`;
    const actionLink = hubUrl
      ? `<a href="${escapeAttribute(hubUrl)}" style="display:inline-block;padding:14px 20px;border-radius:8px;background:#243328;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;">Open your event hub</a>`
      : '';
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5ef;color:#243328;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${actionTitle} for ${eventTitle}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5ef;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dde4d9;border-radius:16px;overflow:hidden;"><tr><td style="padding:28px 32px 18px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#243328;">Attendaa</td></tr><tr><td style="padding:0 32px 28px;"><p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#72806c;">Guest activity</p><h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#243328;">${actionTitle}</h1><p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#4c594d;">${bodyCopy}</p>${actionLink}<p style="margin:26px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#778177;">You received this email because you host ${eventTitle} on Attendaa.</p></td></tr></table></td></tr></table></body></html>`;
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
        html,
        text: `${actionTitle}\n\n${notification.notification_type === 'comment' ? `A guest left a note on ${event.title || 'your invitation'}.` : `A guest sent a private message about ${event.title || 'your invitation'}.`}${hubUrl ? `\n\nOpen your event hub: ${hubUrl}` : ''}`,
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
