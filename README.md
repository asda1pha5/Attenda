# RSVP Hub

Multi-tenant event invite + RSVP platform.
- **Master admin** sees every customer and every event.
- **Customers** log into their own hub, create events, and only see their own RSVPs.
- **Guests** need no account at all — they just open a public link and submit.

## Stack
- **Frontend:** React + Vite, deployed as a static site on Netlify (drag-and-drop or Git-connected)
- **Auth + Database + Image storage:** Supabase (free tier)

## 1. Create your Supabase project
1. Go to https://supabase.com → New project.
2. Once it's created, open **SQL Editor** → New query.
3. Paste the entire contents of `supabase/schema.sql` and click **Run**.
   This creates the `profiles`, `events`, and `rsvps` tables, sets up
   row-level security so customers only ever see their own data, and
   creates a public `event-images` storage bucket for flyer uploads.
4. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

## 2. Configure the app
1. Copy `.env.example` to `.env`.
2. Paste in your Supabase URL and anon key.

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```

## 3. Run it locally (optional, to test before deploying)
```
npm install
npm run dev
```

## 4. Make yourself the master admin
1. Open the running app and **Sign Up** with your own email.
2. Back in Supabase → SQL Editor, run:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
3. Sign out and back in — you'll now see an "Admin View" link in your hub,
   which lists every customer and every event.

## 5. Deploy to Netlify
**Option A — drag and drop:**
```
npm run build
```
Drag the resulting `dist` folder onto https://app.netlify.com/drop

**Option B — connect your Git repo (recommended for ongoing updates):**
1. Push this project to a GitHub repo.
2. In Netlify: New site → Import from Git → select the repo.
3. Build command: `npm run build`, Publish directory: `dist` (already set in `netlify.toml`).
4. Add your two `VITE_SUPABASE_*` values under **Site settings → Environment variables**.
5. Deploy.

## How customers use it
1. Customer signs up at `yoursite.com/login`.
2. They land in `/hub`, click **+ New Event**, fill in title/date/registry
   link, upload their flyer image, and drag the RSVP-box numbers until
   the preview lines up with the blank space on their flyer.
3. Saving gives them a live link: `yoursite.com/e/their-event-slug` —
   ready to text or post immediately, no export/hosting step needed.
4. RSVPs write straight into Supabase. Customers see them live (with CSV
   export) right inside their hub under **View RSVPs**.

## Where old submissions data went
This replaces the Formspree-based version. If you still have events
running on the old static HTML file pointing at Formspree, those
submissions stay in your Formspree dashboard — they aren't migrated
here automatically.

## Stripe Signature checkout

Before enabling live payments, run [migration_stripe_and_funnel.sql](supabase/migration_stripe_and_funnel.sql) in Supabase's SQL Editor. It adds Stripe billing fields, a secure webhook receipt log, and the funnel tables used by the admin dashboard.

Then create a Stripe **Attendaa Signature** product with a **one-time** price. Signature unlocks paid features for one chosen event; it is not a subscription. Run [migration_event_signature_pass.sql](supabase/migration_event_signature_pass.sql) before deploying the updated checkout and webhook functions.

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY="sk_live_or_test_..." STRIPE_WEBHOOK_SIGNING_SECRET="whsec_..." STRIPE_SIGNATURE_PRICE_ID="price_..." APP_URL="https://your-attendaa-domain.com"
```

In Stripe, create a webhook endpoint at `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook` for `checkout.session.completed`. Keep the subscription events too only if you have existing recurring subscribers; the webhook preserves their access during the transition.

## Funnel and SEO

The public home page is Attendaa's landing page. It records anonymous, non-PII acquisition and conversion events (landing views, signup, event creation, and checkout); admins can view the last 30 days at **Admin View → Growth funnel**. The root page has a descriptive title, meta description, semantic headings, and `robots.txt`; private hubs and invitation pages are kept out of search indexing.

## Notes
- No customer or admin credentials, Formspree keys, or other secrets
  are stored in this code — only the public Supabase URL and anon key,
  which are safe to expose in a frontend app because row-level security
  in `schema.sql` enforces who can read/write what.
- Guests never sign in; the `rsvps` table has an "anyone can insert"
  policy but no public read/update/delete access.
