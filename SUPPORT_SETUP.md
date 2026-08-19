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

## Direct support email later

The help form is the live contact channel. If you also want customers to email an address directly, use Resend Inbound on a dedicated subdomain such as `mail.attendaa.com`; it avoids changing the MX records for the main domain. Once it is configured, `support@mail.attendaa.com` can forward into the same inbox.
