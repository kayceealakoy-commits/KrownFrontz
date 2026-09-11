# Hostinger DNS setup for krownfrontz.com → Netlify

After deploying to Netlify, add your custom domain in **Netlify → Domain management**.

## Hostinger hPanel steps

1. Log in at https://hpanel.hostinger.com
2. Go to **Domains** → **krownfrontz.com** → **DNS / Nameservers**
3. Ensure you are using **Hostinger nameservers** (not Netlify nameservers)
4. Add or update these records (use exact values from Netlify domain setup page):

| Type  | Name | Value                              | TTL  |
|-------|------|------------------------------------|------|
| A     | @    | 75.2.60.5                          | 3600 |
| CNAME | www  | krown-frontz.netlify.app         | 3600 |

Replace `krown-frontz.netlify.app` with your actual Netlify subdomain (already set for this project).

5. Remove conflicting records:
   - Delete any existing A record for `@` pointing elsewhere
   - Delete any CNAME for `www` pointing to Hostinger parking page

## Netlify steps

1. **Domain management → Add domain** → `krownfrontz.com`
2. **Add domain alias** → `www.krownfrontz.com`
3. Wait for DNS verification (Netlify shows status)
4. **HTTPS** → Verify certificate (automatic Let's Encrypt)
5. Set **Primary domain** to `krownfrontz.com`
6. Enable **Redirect www to primary** (or apex to www — prefer apex as primary)

## Verify DNS propagation

```powershell
nslookup krownfrontz.com
nslookup www.krownfrontz.com
```

Or use https://dnschecker.org

Propagation: usually 1–2 hours, can take up to 48 hours.

## After DNS is live

1. Confirm https://krownfrontz.com loads your site
2. Create Stripe live webhook: `https://krownfrontz.com/api/stripe-webhook`
3. Set `STRIPE_WEBHOOK_SECRET` in Netlify env vars
4. Redeploy: `npx netlify deploy --prod`
