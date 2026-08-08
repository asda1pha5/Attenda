import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'Unauthorized' }, 401);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL');
    if (!resendKey || !fromEmail) return json({ error: 'Email notifications are not configured' }, 503);
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: events, error: eventsError } = await admin.from('events').select('id,title,event_date,event_time,address').eq('event_date', tomorrow).eq('reminder_enabled', true).eq('is_published', true);
    if (eventsError) throw eventsError;

    let sent = 0;
    for (const event of events || []) {
      const { data: guests, error: guestsError } = await admin.from('rsvps').select('id,guest_name,guest_email').eq('event_id', event.id).in('attending', ['Yes', 'Maybe']).is('reminder_sent_at', null);
      if (guestsError) throw guestsError;
      for (const guest of guests || []) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Attenda/1.0' },
          body: JSON.stringify({
            from: fromEmail,
            to: [guest.guest_email],
            subject: `Reminder: ${event.title} is tomorrow`,
            html: `<p>Hi ${guest.guest_name},</p><p>This is a friendly reminder that <strong>${event.title}</strong> is tomorrow${event.event_time ? ` at ${event.event_time}` : ''}${event.address ? ` at ${event.address}` : ''}.</p>`,
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        await admin.from('rsvps').update({ reminder_sent_at: new Date().toISOString() }).eq('id', guest.id);
        sent += 1;
      }
    }
    return json({ sent });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to send reminders' }, 500);
  }
});
