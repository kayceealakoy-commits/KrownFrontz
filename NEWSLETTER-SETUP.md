# Newsletter signup (Resend)

The homepage subscribe form adds contacts to your Resend audience so you can send marketing broadcasts.

## One-time Resend setup

1. Log in at [resend.com](https://resend.com) (same account used for order notification emails).
2. **Verify your sending domain** (`krownfrontz.com`) under **Domains** if not already done — required before sending broadcasts.
3. Go to **Audiences → Topics** and create a topic, e.g. **News & drops**, with default subscription **opt_in**.
4. Copy the **Topic ID** (starts with `topic_`).

## Environment variables

Set these in **Netlify → Site settings → Environment variables** (and in local `.env` for `npm run dev`):

| Variable | Description |
| --- | --- |
| `RESEND_API_KEY` | Resend API key (already used for order notifications) |
| `RESEND_NEWSLETTER_TOPIC_ID` | Topic ID from step 4 above |

See [`.env.example`](.env.example) for the template.

## Sending campaigns

1. Open **Resend → Broadcasts → New broadcast**.
2. Filter by your **News & drops** topic.
3. Compose and send or schedule your email.

Resend handles unsubscribe links. Your [privacy policy](privacy-policy.html) already covers marketing consent and opt-out.

## Local testing

```powershell
cd c:\Users\blais\Projects\figma\krown-frontz
npm run dev
```

Submit the form on the homepage with consent checked, then confirm the contact appears under **Resend → Audiences → Contacts** with the topic opted in.

## API endpoint

`POST /api/subscribe-newsletter`

```json
{ "email": "you@example.com", "consent": true }
```

Returns `{ "ok": true }` on success. Rate-limited to 5 requests per 5 minutes per IP.
