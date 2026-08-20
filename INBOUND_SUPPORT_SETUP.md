# Inbound support email setup

This makes `support@attendaa.com` a real support address. Incoming messages are received by Resend and securely forwarded to `attendaa26@gmail.com`.

## 1. Enable receiving in Resend

1. In Resend, open **Domains → attendaa.com**.
2. In **Receiving**, choose **Enable receiving**.
3. Copy the exact **Receiving MX** record Resend shows. Do not use the existing `send` MX record; that is only for outbound delivery.

## 2. Add the Receiving MX in Namecheap

1. In Namecheap, open **Domain List → attendaa.com → Advanced DNS**.
2. Before changing anything, look for an existing **MX Record** whose Host is `@`.
   - If one exists, stop and share a screenshot before changing it.
   - If there is no `@` MX record, add Resend's new MX record exactly as shown: Type **MX Record**, Host **@**, Value/Mail Server copied from Resend, Priority copied from Resend, TTL **Automatic**.
3. Return to Resend and click the confirmation that the record was added. Wait until Receiving shows verified.

## 3. Add the secure webhook in Resend

1. In Resend, open **Webhooks → Add webhook**.
2. Endpoint URL:

   ```text
   https://jaixqnjgzsrzegbxfdot.supabase.co/functions/v1/forward-inbound-support
   ```

3. Select only the `email.received` event and create it.
4. Copy its signing secret (it begins with `whsec_`).

## 4. Deploy the forwarding handler

In Command Prompt from the project folder:

```bat
set SUPABASE_ACCESS_TOKEN=your_personal_access_token
set RESEND_INBOUND_WEBHOOK_SECRET=whsec_your_webhook_secret
scripts\deploy-supabase.cmd
```

The script saves the secret, applies the delivery-log migration, and deploys the handler.

## 5. Test receiving

Send an email from a different address to `support@attendaa.com`. It should arrive at `attendaa26@gmail.com`.

## 6. Send your replies as Attendaa Support

After the test arrives, in Gmail open **Settings → See all settings → Accounts and Import → Send mail as → Add another email address**.

Use **Attendaa Support** and `support@attendaa.com`. Gmail's verification email will arrive through the forwarding setup. Choose **Send through your SMTP server** and use:

```text
SMTP server: smtp.resend.com
Port: 465
Username: resend
Password: a new Resend API key with sending permission
```

Make the new address your default From address in Gmail. Do not use the Resend API key already stored in Supabase; create a separate one for Gmail.
