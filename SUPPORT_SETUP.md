# Attendaa support setup

The `/help` page sends each message to the address stored in the Supabase `SUPPORT_TO_EMAIL` secret. It uses the existing verified Resend sender and sets the customer’s email as Reply-To, so you can simply reply from your inbox.

## One-time setup

1. From the project folder in Command Prompt, run the following with your existing personal access token:

   ```bat
   set SUPABASE_ACCESS_TOKEN=your_personal_access_token
   set SUPPORT_TO_EMAIL=attendaa26@gmail.com
   scripts\deploy-supabase.cmd
   ```

2. The script safely sets the `SUPPORT_TO_EMAIL` secret, applies the database migration, and deploys the support function along with the other functions.
3. Visit `https://attendaa.com/help` and send a test message.

## Direct support email

Namecheap Email Forwarding is already active for `attendaa.com`. Create `support@attendaa.com` in Namecheap's **Domain → Redirect Email** section and forward it to `attendaa26@gmail.com`. This preserves the current mail routing and gives Gmail the confirmation email it needs to send as Attendaa Support.
