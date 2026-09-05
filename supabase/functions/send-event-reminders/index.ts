import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => htmlEntities[character] || character);

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'Unauthorized' }, 401);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL');
    if (!resendKey || !fromEmail) return json({ error: 'Email notifications are not configured' }, 503);
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date();
    const reminderDates = [1, 3, 7].map((days) => ({
      days,
      date: new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    }));
    const { data: events, error: eventsError } = await admin
      .from('events')
      .select('id,title,slug,event_date,event_time,address,reminder_days_before')
      .eq('reminder_enabled', true)
      .eq('is_published', true)
      .in('event_date', reminderDates.map(({ date }) => date));
    if (eventsError) throw eventsError;

    let sent = 0;
    for (const event of events || []) {
      const daysBefore = event.reminder_days_before || 1;
      const dueDate = reminderDates.find(({ days }) => days === daysBefore)?.date;
      if (event.event_date !== dueDate) continue;
      const { data: guests, error: guestsError } = await admin.from('rsvps').select('id,guest_name,guest_email').eq('event_id', event.id).in('attending', ['Yes', 'Maybe']).is('cancelled_at', null).is('reminder_sent_at', null);
      if (guestsError) throw guestsError;
      for (const guest of guests || []) {
        const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '');
        const eventUrl = appUrl && event.slug ? `${appUrl}/e/${event.slug}` : '';
        const eventTitle = escapeHtml(event.title || 'your event');
        const guestName = escapeHtml(guest.guest_name || 'there');
        const timing = daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`;
        const details = `${event.event_time ? ` at ${escapeHtml(event.event_time)}` : ''}${event.address ? ` at ${escapeHtml(event.address)}` : ''}`;
        const actionLink = eventUrl ? `<a href="${escapeHtml(eventUrl)}" style="display:inline-block;padding:14px 20px;border-radius:8px;background:#64795f;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;">View event details</a>` : '';
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5ef;color:#26332a;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">A gentle reminder about ${eventTitle}.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5ef;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf9;border:1px solid #dde4d9;border-radius:18px;overflow:hidden;"><tr><td style="padding:30px 32px 20px;border-bottom:1px solid #edf0e9;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-.03em;color:#26332a;">Attendaa</div><div style="margin-top:6px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;color:#72806c;">PLAN · INVITE · CELEBRATE</div></td></tr><tr><td style="padding:34px 32px 32px;"><p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#72806c;">A gentle reminder</p><h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:31px;line-height:1.18;color:#26332a;">${eventTitle} is ${timing}</h1><p style="margin:0 0 26px;font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#4c594d;">Hi ${guestName}, we’re looking forward to gathering with you${details}.</p>${actionLink}<p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#778177;">This reminder was sent by the host through Attendaa.</p></td></tr></table></td></tr></table></body></html>`;
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Attendaa/1.0' },
          body: JSON.stringify({
            from: fromEmail,
            to: [guest.guest_email],
            subject: `Reminder: ${event.title} is in ${daysBefore === 1 ? '1 day' : `${daysBefore} days`}`,
            html,
            text: `Hi ${guest.guest_name || 'there'},\n\n${event.title || 'Your event'} is ${timing}${event.event_time ? ` at ${event.event_time}` : ''}${event.address ? ` at ${event.address}` : ''}.${eventUrl ? `\n\nView event details: ${eventUrl}` : ''}`,
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
