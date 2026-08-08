# Attenda event reminders

This Signature function emails guests who answered **Yes** or **Maybe** one day before an event when the host enabled reminders.

## Deploy

```powershell
supabase secrets set CRON_SECRET="create-a-long-random-value"
supabase functions deploy send-event-reminders --no-verify-jwt
```

Schedule a daily request from a protected scheduler (Supabase Cron, GitHub Actions, or another scheduler) to the deployed function URL. Include this header:

```text
x-cron-secret: the-same-CRON_SECRET-value
```

The function uses the existing `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` secrets.
