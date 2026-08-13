# Stripe webhook

Deploy this function with webhook verification disabled at the gateway; it verifies Stripe's signed payload itself.

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY="sk_live_or_test_..." STRIPE_WEBHOOK_SIGNING_SECRET="whsec_..." STRIPE_SIGNATURE_PRICE_ID="price_..." APP_URL="https://your-attendaa-domain.com"
```

In Stripe, create a **recurring** Signature price and copy its `price_...` ID to `STRIPE_SIGNATURE_PRICE_ID`. Add an event destination pointed at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe it to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. For a one-time offer instead, use a one-time Stripe price and set `STRIPE_SIGNATURE_BILLING_MODE="payment"`.
