# Stripe webhook

Deploy this function with webhook verification disabled at the gateway; it verifies Stripe's signed payload itself.

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY="sk_live_or_test_..." STRIPE_WEBHOOK_SIGNING_SECRET="whsec_..." STRIPE_SIGNATURE_PRICE_ID="price_..." APP_URL="https://your-attendaa-domain.com"
```

In Stripe, create a **one-time** Attendaa Signature price and copy its `price_...` ID to `STRIPE_SIGNATURE_PRICE_ID`. Run `../../migration_event_signature_pass.sql` in Supabase first. Each checkout includes the selected event ID and unlocks Signature only for that event. Add an event destination pointed at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe it to `checkout.session.completed`. Keep `customer.subscription.updated` and `customer.subscription.deleted` too if older customers are still on a recurring subscription; the webhook supports their access while you transition. No billing-mode secret is needed: Attendaa Signature always uses Stripe's `payment` checkout mode.
