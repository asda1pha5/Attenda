# Attenda event reminders

This Signature function emails guests who answered **Yes** or **Maybe** at the host's chosen time: **1 day, 3 days, or 1 week** before an event. Each guest receives only one reminder per event.

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
