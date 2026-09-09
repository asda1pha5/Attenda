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

Subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded` for delayed payment methods. Keep `customer.subscription.updated` and `customer.subscription.deleted` too if older customers are still on a recurring subscription. No billing-mode secret is needed: Attendaa Signature always uses Stripe's `payment` checkout mode.

## Conversion readiness release (not deployed)

Apply `../../migrations/20260909133540_conversion_readiness_payments.sql` before deploying these two functions together. Do not run the broad deployment script for this sprint: it includes unrelated functions and pending migrations. Deployment, secrets/settings changes and live tests require owner approval.

Checkout checks the configured price is active, USD 19.00 and one-time. Webhook fulfillment retrieves the canonical Checkout Session with its payment intent and line items, checks settled amount/product/ownership metadata, then invokes a service-only SQL transaction. The transaction locks the owned event and commits entitlement, a unique purchase ledger, sanitized attribution and processed receipt together. Any error returns a retryable failure; a success URL grants nothing. Legacy pre-processing receipts have no `processed_at` and are not discarded as completed.

Legacy webhook replays can backfill the new purchase ledger. Historical frontend purchase counts were not uniquely tied to sessions, so compare post-release ledger counts and Stripe exports; do not claim historical funnel events were deduplicated. Event/account deletion preserves an anonymized revenue record through nullable foreign keys. Subscription synchronization is checked and retryable but does not emit a $19 purchase conversion.

Local checks: `npm run test:conversion`, `npm run test:conversion:sql`, and `npm run test:conversion:browser`. SQL checks use optional PGlite 0.5.8 installed under ignored `.tmp-conversion-test/`, not a production dependency. This runs actual PostgreSQL SQL in one connection; separate simultaneous Postgres sessions, deployed gateway behavior and Stripe delivery remain production/staging verification tasks. See `../../../marketing/CONVERSION_SPRINT.md` for the exact handoff.
