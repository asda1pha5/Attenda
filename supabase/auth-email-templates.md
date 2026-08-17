# Attendaa Auth email templates

Supabase Auth sends account confirmations and password resets itself, so those two emails are styled in **Supabase Dashboard → Authentication → Email Templates** rather than in the app code.

Use the subject lines and HTML below. Keep `{{ .ConfirmationURL }}` exactly as written; Supabase replaces it with the secure link.

## Confirm signup

**Subject:** Confirm your Attendaa account

```html
<!doctype html><html><body style="margin:0;padding:0;background:#f4f5ef;color:#26332a;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirm your email and start planning your family milestone.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5ef;"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf9;border:1px solid #dde4d9;border-radius:18px;overflow:hidden;"><tr><td style="padding:30px 32px 20px;border-bottom:1px solid #edf0e9;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-.03em;color:#26332a;">Attendaa</div><div style="margin-top:6px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;color:#72806c;">PLAN · INVITE · CELEBRATE</div></td></tr><tr><td style="padding:34px 32px 32px;"><p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;color:#72806c;">WELCOME</p><h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:31px;line-height:1.18;color:#26332a;">Let’s make the first yes feel special.</h1><p style="margin:0 0 26px;font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#4c594d;">Confirm your email to create a beautiful RSVP page for the family milestone you’re planning.</p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 21px;border-radius:8px;background:#64795f;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">Confirm my email</a><p style="margin:28px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#778177;">If you did not create an Attendaa account, you can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>
```

## Reset password

**Subject:** Reset your Attendaa password

Use the same HTML above, with these three copy changes: eyebrow `ACCOUNT SUPPORT`; heading `A fresh start is one click away.`; body `Use the button below to choose a new Attendaa password. This secure link will expire soon.`; button text `Reset my password`.

## Magic link (if enabled)

**Subject:** Your secure Attendaa sign-in link

Use the confirmation HTML with: eyebrow `SECURE SIGN-IN`; heading `Your invitation hub is ready.`; body `Use this secure link to return to Attendaa and keep planning your event.`; button text `Sign in to Attendaa`.

For all three templates, set the link URL to `{{ .ConfirmationURL }}`. In **Authentication → URL Configuration**, keep `https://attendaa.com/hub` in the Redirect URLs list.
