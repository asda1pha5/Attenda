import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const entities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
};
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => entities[character] || character);
const cleanLine = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLength) : '';
const cleanMessage = (value: unknown) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 5000) : '';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const body = await request.json();
    const name = cleanLine(body.name, 100);
    const email = cleanLine(body.email, 254).toLowerCase();
    const subject = cleanLine(body.subject, 160);
    const message = cleanMessage(body.message);
    const company = cleanLine(body.company, 200);
    if (company) return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!name || !emailPattern.test(email) || !subject || message.length < 8) {
      return new Response('Please complete every field with a valid email address.', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL');
    const supportToEmail = Deno.env.get('SUPPORT_TO_EMAIL');
    if (!resendKey || !fromEmail || !supportToEmail) {
      return new Response('Support email is not configured yet.', { status: 503, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentRequest, error: rateError } = await admin
      .from('support_requests')
      .select('id')
      .eq('email', email)
      .gte('created_at', fiveMinutesAgo)
      .limit(1)
      .maybeSingle();
    if (rateError) throw rateError;
    if (recentRequest) return new Response('Please wait a few minutes before sending another message.', { status: 429, headers: corsHeaders });

    const { error: requestError } = await admin.from('support_requests').insert({ name, email, subject, message });
    if (requestError) throw requestError;

    const appUrl = Deno.env.get('APP_URL')?.replace(/\/$/, '') || 'https://attendaa.com';
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5ef;color:#26332a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5ef;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf9;border:1px solid #dde4d9;border-radius:18px;overflow:hidden;"><tr><td style="padding:30px 32px 20px;border-bottom:1px solid #edf0e9;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-.03em;color:#26332a;">Attendaa</div><div style="margin-top:6px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;color:#72806c;">SUPPORT REQUEST</div></td></tr><tr><td style="padding:34px 32px 32px;"><p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#72806c;">From ${safeName}</p><h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:1.18;color:#26332a;">${safeSubject}</h1><p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#4c594d;">${safeMessage}</p><p style="margin:0;font-family:Arial,sans-serif;font-size:13px;line-height:1.55;color:#778177;">Reply directly to ${safeEmail}, or open <a href="${appUrl}/help" style="color:#526c50;">Attendaa support</a>.</p></td></tr></table></td></tr></table></body></html>`;
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'User-Agent': 'Attendaa/1.0' },
      body: JSON.stringify({
        from: fromEmail,
        to: [supportToEmail],
        reply_to: email,
        subject: `[Attendaa support] ${subject}`,
        html,
        text: `Attendaa support request\n\nFrom: ${name} <${email}>\nSubject: ${subject}\n\n${message}\n\nReply directly to the sender, or visit ${appUrl}/help.`,
      }),
    });
    if (!emailResponse.ok) throw new Error(`Resend rejected the email: ${await emailResponse.text()}`);

    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(error);
    return new Response('Unable to send your message', { status: 500, headers: corsHeaders });
  }
});
